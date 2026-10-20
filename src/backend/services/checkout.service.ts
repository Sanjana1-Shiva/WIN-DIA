import { Result, failure, success } from '../types/result.types';
import { AppError } from '../errors/app-error';
import { NotFoundError, ValidationError } from '../errors/domain-errors';
import { Order, OrderItem, Payment, Shipment } from '../models/domain-models.types';
import { OrderStatus } from '../enums/entity.enums';
import { CreateOrderDTO } from '../types/dto.types';
import { UserService } from './user.service';
import { CartService } from './cart.service';
import { InventoryService } from './inventory.service';
import { CouponService } from './coupon.service';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { ShipmentService } from './shipment.service';
import { ProductRepository } from '../repositories/product.repository';
import { OrderRepository } from '../repositories/order.repository';
import { logger } from '../utils/logger.util';
import { container, RepositoryTokens, ServiceTokens } from '../providers/container.provider';
import { BundlePricing, calculateOrderTotal } from '../constants/bundle-pricing.constants';
import { autoBookShipment } from './auto-shipment.util';

export interface CheckoutResult {
  order: Order;
  items: OrderItem[];
  payment: Payment;
  razorpayOrderId: string;
  shipment: Shipment;
  pricing: {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  };
}

export interface CheckoutService {
  processCheckout(userId: string, dto: CreateOrderDTO): Promise<Result<CheckoutResult, AppError>>;
}

// ---------------------------------------------------------------------
// Catalog + bundle rules (from the DB handoff). Price is NEVER computed here:
// calculate_windia_price is the only source of truth.
// ---------------------------------------------------------------------
const PACKETS_PER_BUNDLE = 6;
const COMBO_PACKETS = 6; // one assorted combo = 6 packets (1 bundle)

const COMBO_PRODUCT_ID = '9d17cedd-4abd-4765-af1e-f368d17bad32';

const SLUG_TO_PRODUCT_ID: Record<string, string> = {
  'curry-leaves-thins': '0b225519-b378-4e45-bc13-5bfa41459c81',
  'garlic-thins': 'f30e1bc4-a532-42b2-b59a-3244521c4ce6',
  'jeera-thins': 'dca9fd97-c09d-44f2-8af7-b02c0670593c',
  'onion-thins': 'c640d38c-2422-4082-a132-99d393648f21',
  'windia-assorted-combo-v2': COMBO_PRODUCT_ID,
};

const REGULAR_PRODUCT_IDS = new Set<string>([
  '0b225519-b378-4e45-bc13-5bfa41459c81',
  'f30e1bc4-a532-42b2-b59a-3244521c4ce6',
  'dca9fd97-c09d-44f2-8af7-b02c0670593c',
  'c640d38c-2422-4082-a132-99d393648f21',
]);
const SUPPORTED_PRODUCT_IDS = new Set<string>([...REGULAR_PRODUCT_IDS, COMBO_PRODUCT_ID]);

/**
 * ASSUMPTION — CONFIRM WITH DB OWNER: key under which each combo item carries its
 * flavour picks inside the `items` jsonb of create_checkout_order_transaction.
 * Expected shape: [{ product_id, bundles }]. Change this one constant (and
 * buildItemPayloads) if the RPC expects something different.
 */
const COMBO_SELECTIONS_KEY = 'combo_selections';

interface ComboSelection {
  product_id: string;
  bundles: number;
}

interface PreparedLine {
  kind: 'regular' | 'combo';
  productId: string;
  qty: number; // regular: bundles ordered; combo: always 1
  bundles: number; // total bundles this line represents (regular: qty; combo: 6)
  name: string;
  flavor: string | null;
  image: string | null;
  netWeightGrams: number;
  selections?: ComboSelection[];
}

interface CouponOutcome {
  discount: number;
  validatedCouponId: string | null;
}

interface OrderCreationOutcome {
  createdOrder: Order;
  createdPayment: Payment;
  createdShipment: Shipment;
}

export class CheckoutServiceImpl implements CheckoutService {
  private userService: UserService;
  private cartService: CartService;
  private productRepo: ProductRepository;
  private orderRepo: OrderRepository;
  private inventoryService: InventoryService;
  private couponService: CouponService;
  private paymentService: PaymentService;

  constructor(
    userService?: UserService,
    cartService?: CartService,
    productRepo?: ProductRepository,
    orderRepo?: OrderRepository,
    inventoryService?: InventoryService,
    couponService?: CouponService,
    _orderService?: OrderService, // unused now (no fallback path) — kept so container wiring is unchanged
    paymentService?: PaymentService,
    _shipmentService?: ShipmentService // unused now — kept so container wiring is unchanged
  ) {
    this.userService = userService || container.resolve<UserService>(ServiceTokens.UserService);
    this.cartService = cartService || container.resolve<CartService>(ServiceTokens.CartService);
    this.productRepo = productRepo || container.resolve<ProductRepository>(RepositoryTokens.ProductRepository);
    this.orderRepo = orderRepo || container.resolve<OrderRepository>(RepositoryTokens.OrderRepository);
    this.inventoryService = inventoryService || container.resolve<InventoryService>(ServiceTokens.InventoryService);
    this.couponService = couponService || container.resolve<CouponService>(ServiceTokens.CouponService);
    this.paymentService = paymentService || container.resolve<PaymentService>(ServiceTokens.PaymentService);
  }

  // ---------------------------------------------------------------------
  // Address / cart
  // ---------------------------------------------------------------------

  private async resolveShippingAddress(userId: string, dto: CreateOrderDTO): Promise<Result<any, AppError>> {
    let selectedAddress: any = null;
    const rawAddr = (dto as any).shippingAddress || (dto as any).shipping_address;

    if (rawAddr) {
      selectedAddress = {
        full_name: rawAddr.name || rawAddr.full_name || 'Valued Customer',
        phone: String(rawAddr.phone || ''),
        address_line1: rawAddr.street || rawAddr.address_line1 || '',
        address_line2: rawAddr.address_line2 || null,
        city: rawAddr.city || '',
        state: rawAddr.state || '',
        pincode: String(rawAddr.pincode || rawAddr.postal_code || ''),
        country: rawAddr.country || 'India',
      };
    } else {
      const addrRes = await this.userService.getUserAddresses(userId);
      if (addrRes.success && addrRes.value.length > 0) {
        selectedAddress = addrRes.value.find((a) => a.id === (dto as any).shipping_address_id) || addrRes.value[0];
      }
    }

    if (!selectedAddress || !selectedAddress.address_line1 || !selectedAddress.city) {
      return failure(new ValidationError('Valid shipping address is required for checkout'));
    }
    return success(selectedAddress);
  }

  private async resolveCartItems(userId: string, dto: CreateOrderDTO): Promise<Result<any[], AppError>> {
    let rawItems: any[] = (dto as any).items || [];
    if (!rawItems || rawItems.length === 0) {
      const cartRes = await this.cartService.getCart(userId);
      if (cartRes.success && cartRes.value.items) {
        rawItems = cartRes.value.items;
      }
    }

    if (!rawItems || rawItems.length === 0) {
      return failure(new ValidationError('Cart is empty. Cannot process checkout.'));
    }
    return success(rawItems);
  }

  // ---------------------------------------------------------------------
  // Product resolution + validation
  // ---------------------------------------------------------------------

  /**
   * Exact matching only (UUID or known slug). The old fuzzy flavour/name matching is gone:
   * `searchFlavor.includes('')` is true for any product with an empty flavour (e.g. the combo),
   * so a bad cart item could resolve to the wrong product.
   */
  private resolveProductId(item: any): Result<string, AppError> {
    const rawId = item?.productId || item?.product_id || item?.id || item?._id || item?.slug;
    const flavor = item?.flavor || item?.flavour;
    const candidates: string[] = [];

    if (typeof rawId === 'string' && rawId.trim()) {
      const id = rawId.trim().toLowerCase();
      const stripped = id.replace(/^(gluten-free|everyday)-/, '');
      candidates.push(id, stripped, `${id}-thins`, `${stripped}-thins`);
    }
    if (typeof flavor === 'string' && flavor.trim()) {
      candidates.push(`${flavor.trim().toLowerCase().replace(/\s+/g, '-')}-thins`);
    }

    for (const c of candidates) {
      if (SUPPORTED_PRODUCT_IDS.has(c)) return success(c);
      const bySlug = SLUG_TO_PRODUCT_ID[c];
      if (bySlug) return success(bySlug);
    }

    logger.warn('[CheckoutService] Cart item did not match a supported product');
    return failure(new NotFoundError(
      `Product "${item?.name || 'item'}" could not be found. Please refresh and try again.`
    ));
  }

  private parseWholeNumber(value: unknown): number | null {
    const n = typeof value === 'string' ? Number(value) : (value as number);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  /** A flavour counts as available when active and holding at least one bundle (6 packets). */
  private async getAvailableFlavourIds(): Promise<Result<Set<string>, AppError>> {
    const res = await this.productRepo.findAll({ is_active: true });
    if (!res.success) return failure(res.error);

    const available = new Set<string>();
    for (const p of res.value) {
      if (REGULAR_PRODUCT_IDS.has(p.id) && p.count_in_stock >= PACKETS_PER_BUNDLE) {
        available.add(p.id);
      }
    }
    return success(available);
  }

  /**
   * One combo = exactly 6 bundles; every currently available flavour at least once;
   * unavailable flavours never selected; repeats allowed.
   */
  private validateComboSelections(item: any, available: Set<string>): Result<ComboSelection[], AppError> {
    // Accept flavorSelections (object format from frontend) or combo_selections/comboSelections (array format)
    let raw = item?.combo_selections ?? item?.comboSelections ?? item?.selections;
    
    // If flavorSelections is an object (e.g. { "curry-leaves": 2, "garlic": 1 }), convert to array format
    if (!raw && item?.flavorSelections) {
      raw = Object.entries(item.flavorSelections)
        .filter(([_, count]) => (count as number) > 0)
        .map(([flavorKey, count]) => {
          // Map flavor keys to product IDs
          const flavorToProductId: Record<string, string> = {
            'curry-leaves': '0b225519-b378-4e45-bc13-5bfa41459c81',
            'garlic': 'f30e1bc4-a532-42b2-b59a-3244521c4ce6',
            'jeera': 'dca9fd97-c09d-44f2-8af7-b02c0670593c',
            'onion': 'c640d38c-2422-4082-a132-99d393648f21',
          };
          return {
            productId: flavorToProductId[flavorKey] || flavorKey,
            bundles: count as number,
          };
        });
    }
    
    if (!Array.isArray(raw) || raw.length === 0) {
      return failure(new ValidationError('Please choose the flavours for your assorted combo.'));
    }
    if (available.size === 0) {
      return failure(new ValidationError('The assorted combo is currently unavailable.'));
    }

    const counts = new Map<string, number>();
    for (const entry of raw) {
      const sel = typeof entry === 'string' ? { productId: entry } : entry;
      const idRes = this.resolveProductId(sel);
      if (!idRes.success) return failure(idRes.error);

      const productId = idRes.value;
      if (!REGULAR_PRODUCT_IDS.has(productId)) {
        return failure(new ValidationError('Invalid flavour selection for the assorted combo.'));
      }
      if (!available.has(productId)) {
        return failure(new ValidationError('A selected flavour is currently unavailable. Please update your combo.'));
      }

      const rawBundles = sel?.bundles ?? sel?.qty;
      const bundles = rawBundles === undefined ? 1 : this.parseWholeNumber(rawBundles);
      if (bundles === null) {
        return failure(new ValidationError('Invalid flavour selection for the assorted combo.'));
      }
      counts.set(productId, (counts.get(productId) || 0) + bundles);
    }

    const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
    if (total !== COMBO_PACKETS) {
      return failure(new ValidationError(`An assorted combo must have exactly ${COMBO_PACKETS} packets selected.`));
    }
    for (const id of available) {
      if (!counts.has(id)) {
        return failure(new ValidationError('Every available flavour must be included at least once in the combo.'));
      }
    }

    return success(Array.from(counts, ([product_id, bundles]) => ({ product_id, bundles })));
  }

  /**
   * Validates every cart line and checks stock per flavour, in packets, aggregated across the
   * whole order (regular lines + combo picks). This is a friendly pre-check only; the DB deduction
   * RPC remains the authority after payment. Client prices/totals are ignored entirely.
   */
  private async prepareLines(rawItems: any[]): Promise<Result<PreparedLine[], AppError>> {
    const lines: PreparedLine[] = [];
    const packetsByProduct = new Map<string, number>();
    const addPackets = (productId: string, packets: number) =>
      packetsByProduct.set(productId, (packetsByProduct.get(productId) || 0) + packets);

    let availableFlavours: Set<string> | null = null;

    for (const item of rawItems) {
      const idRes = this.resolveProductId(item);
      if (!idRes.success) return failure(idRes.error);
      const productId = idRes.value;

      const rawWeight = Number(item.net_weight_grams || item.net_weight || item.netWeight || 200);
      const perPacketGrams = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 200;
      const name = item.name || item.product_name || 'WIN-DIA Product';
      const image = item.image || item.image_url || null;

      if (productId === COMBO_PRODUCT_ID) {
        // Each combo is its own line with its own selection set.
        if (this.parseWholeNumber(item.qty ?? item.quantity ?? 1) !== 1) {
          return failure(new ValidationError('Each assorted combo must be added separately with its own flavour selection.'));
        }

        const comboRes = await this.productRepo.findById(COMBO_PRODUCT_ID);
        if (!comboRes.success || !comboRes.value || !comboRes.value.is_active) {
          return failure(new NotFoundError('The assorted combo is not available. Please refresh and try again.'));
        }

        if (!availableFlavours) {
          const availRes = await this.getAvailableFlavourIds();
          if (!availRes.success) return failure(availRes.error);
          availableFlavours = availRes.value;
        }

        const selRes = this.validateComboSelections(item, availableFlavours);
        if (!selRes.success) return failure(selRes.error);
        for (const sel of selRes.value) addPackets(sel.product_id, sel.bundles * PACKETS_PER_BUNDLE);

        lines.push({
          kind: 'combo',
          productId,
          qty: 1,
          bundles: 1, // 1 bundle = 6 packets for combo
          name,
          flavor: null,
          image,
          netWeightGrams: perPacketGrams * COMBO_PACKETS, // 6 packets × 40g = 240g
          selections: selRes.value,
        });
        continue;
      }

      // Regular product: qty = bundles of 6 packets, whole numbers only (rejected, never clamped).
      const qty = this.parseWholeNumber(item.qty ?? item.quantity);
      if (qty === null || qty > BundlePricing.MAX_BUNDLES_PER_ITEM) {
        return failure(new ValidationError('Invalid quantity. Please order whole bundles of 6 packets.'));
      }
      addPackets(productId, qty * PACKETS_PER_BUNDLE);

      lines.push({
        kind: 'regular',
        productId,
        qty,
        bundles: qty,
        name,
        flavor: item.flavor || item.flavour || null,
        image,
        netWeightGrams: perPacketGrams * qty * PACKETS_PER_BUNDLE,
      });
    }

    for (const [productId, packets] of packetsByProduct) {
      const stockRes = await this.inventoryService.validateStock(productId, packets);
      if (!stockRes.success) {
        logger.warn(`[CheckoutService] Stock pre-check failed for product ${productId} (${packets} packets)`);
        return failure(new ValidationError(
          'One or more items in your order are out of stock or unavailable. Please review your cart.'
        ));
      }
    }

    return success(lines);
  }

  // ---------------------------------------------------------------------
  // Pricing (database is authoritative)
  // ---------------------------------------------------------------------

  private async getDbPrice(bundleCount: number): Promise<number> {
    const { getAdminClient } = require('../config/supabase.config');
    const client = getAdminClient();

    const { data, error } = await client.rpc('calculate_windia_price', { bundle_count: bundleCount });
    if (error) {
      logger.error(`[CheckoutService] calculate_windia_price(${bundleCount}) failed: ${error.message}`);
      throw new Error('Could not calculate order price');
    }

    // ASSUMPTION: the function returns a scalar number/numeric.
    const price = Number(data);
    if (!Number.isFinite(price) || price <= 0) {
      logger.error(`[CheckoutService] calculate_windia_price(${bundleCount}) returned an unusable value`);
      throw new Error('Could not calculate order price');
    }
    return price;
  }

  /** Subtotal from the DB for the order's TOTAL bundle count, plus the item payloads for the checkout RPC. */
  private async priceLines(lines: PreparedLine[]): Promise<{ subtotal: number; orderItems: Record<string, unknown>[] }> {
    const totalBundles = lines.reduce((sum, l) => sum + l.bundles, 0);
    const subtotal = await this.getDbPrice(totalBundles);

    // Per-line `price` is only a list-price snapshot (1 bundle / 1 combo); the order total is `subtotal`.
    const unitPrices = new Map<number, number>();
    const orderItems: Record<string, unknown>[] = [];

    for (const line of lines) {
      const unitBundles = line.kind === 'combo' ? 1 : 1; // Combo is 1 bundle now
      if (!unitPrices.has(unitBundles)) unitPrices.set(unitBundles, await this.getDbPrice(unitBundles));

      const payload: Record<string, unknown> = {
        product_id: line.productId,
        name: line.name,
        price: unitPrices.get(unitBundles),
        qty: line.qty,
        flavor: line.flavor,
        net_weight_grams: line.netWeightGrams,
        image: line.image,
      };
      if (line.selections) payload[COMBO_SELECTIONS_KEY] = line.selections;
      orderItems.push(payload);
    }

    return { subtotal, orderItems };
  }

  private async applyCoupon(dto: CreateOrderDTO, subtotal: number): Promise<Result<CouponOutcome, AppError>> {
    let discount = 0;
    let validatedCouponId: string | null = null;
    if (dto.coupon_code) {
      const couponRes = await this.couponService.calculateDiscount({
        code: dto.coupon_code,
        cart_total: subtotal,
      });
      if (!couponRes.success) {
        // Invalid/expired coupon — reject checkout, do not silently ignore
        return failure(couponRes.error);
      }
      discount = couponRes.value.discountAmount;
      validatedCouponId = couponRes.value.coupon.id;
    }
    return success({ discount, validatedCouponId });
  }

  // ---------------------------------------------------------------------
  // Order creation — create_checkout_order_transaction ONLY (no fallback inserts)
  // ---------------------------------------------------------------------

  private async createOrder(
    userId: string,
    dto: CreateOrderDTO,
    selectedAddress: any,
    orderItems: Record<string, unknown>[],
    selectedPaymentMethod: string,
    pricing: { subtotal: number; discount: number; tax: number; shipping: number; total: number },
    pendingPaymentPlaceholderId: string
  ): Promise<Result<OrderCreationOutcome, AppError>> {
    const { subtotal, discount, tax, shipping, total } = pricing;

    // No order_number is passed: the RPC generates it.
    const txRes = await this.orderRepo.createCheckoutTransaction(
      userId,
      {
        items_price: subtotal,
        discount_price: discount,
        tax_price: tax,
        shipping_price: shipping,
        total_price: total,
        order_status: OrderStatus.PLACED,
        payment_method: selectedPaymentMethod,
        shipping_address: selectedAddress,
        order_notes: dto.order_notes || (dto as any).orderNotes || null,
      },
      orderItems,
      {
        payment_provider: 'razorpay',
        provider_order_id: pendingPaymentPlaceholderId,
        amount: total,
        currency: 'INR',
        status: 'pending',
        payment_method: selectedPaymentMethod,
      },
      {
        courier_name: 'DTDC',
        status: 'pending',
      }
    );

    if (!txRes.success) {
      // A second, hand-rolled insert path would bypass combo selections and the DB's order numbering.
      logger.error(`[CheckoutService] create_checkout_order_transaction failed: ${txRes.error.message}`);
      return failure(txRes.error);
    }
    if (!txRes.value || !txRes.value.order) {
      logger.error('[CheckoutService] create_checkout_order_transaction returned no order');
      return failure(new ValidationError('Could not create your order. Please try again.'));
    }

    const createdOrder = txRes.value.order as Order;
    let createdPayment = txRes.value.payment as Payment;
    const createdShipment = txRes.value.shipment as Shipment;

    // Fail closed if the DB stored a different total than the one we priced.
    const storedTotal = Number(createdOrder.total_price);
    if (Number.isFinite(storedTotal) && Math.round(storedTotal * 100) !== Math.round(total * 100)) {
      logger.error(`[CheckoutService] Stored total differs from calculated total for order ${createdOrder.id}`);
      return failure(new ValidationError('Order total mismatch. Please try again.'));
    }

    // Online payments get their real Razorpay order only after the DB order exists.
    if (!createdPayment && selectedPaymentMethod !== 'cod') {
      const payRes = await this.paymentService.initiateRazorpayPayment(
        createdOrder.id,
        total,
        createdOrder.order_number
      );
      if (!payRes.success) return failure(payRes.error);
      createdPayment = payRes.value.payment;
    }

    return success({ createdOrder, createdPayment, createdShipment });
  }

  private async finalizeCartAndCoupon(userId: string, validatedCouponId: string | null): Promise<void> {
    const cartRes = await this.cartService.getCart(userId);
    if (cartRes.success && cartRes.value.cart) {
      await this.cartService.clearCart(cartRes.value.cart.id);
    }

    if (validatedCouponId) {
      await this.couponService.incrementUsage(validatedCouponId);
    }
  }

  // ---------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------

  public async processCheckout(userId: string, dto: CreateOrderDTO): Promise<Result<CheckoutResult, AppError>> {
    const startTime = Date.now();

    try {
      if (!userId) {
        return failure(new ValidationError('User ID is required for checkout'));
      }

      const addressRes = await this.resolveShippingAddress(userId, dto);
      if (!addressRes.success) return failure(addressRes.error);
      const selectedAddress = addressRes.value;

      const cartItemsRes = await this.resolveCartItems(userId, dto);
      if (!cartItemsRes.success) return failure(cartItemsRes.error);

      const linesRes = await this.prepareLines(cartItemsRes.value);
      if (!linesRes.success) return failure(linesRes.error);

      // Database-calculated price is authoritative; nothing from the client is trusted.
      const { subtotal, orderItems } = await this.priceLines(linesRes.value);

      const couponRes = await this.applyCoupon(dto, subtotal);
      if (!couponRes.success) return failure(couponRes.error);
      const { discount, validatedCouponId } = couponRes.value;

      // Shipping/tax rules stay in the existing helper (free delivery enforced server-side).
      const { shipping, tax, total } = calculateOrderTotal(subtotal, discount);

      // Placeholder only; never returned to the client as a Razorpay order id.
      const pendingPaymentPlaceholderId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const selectedPaymentMethod = (dto as any).paymentMethod || (dto as any).payment_method || 'razorpay';

      const orderCreationRes = await this.createOrder(
        userId,
        dto,
        selectedAddress,
        orderItems,
        selectedPaymentMethod,
        { subtotal, discount, tax, shipping, total },
        pendingPaymentPlaceholderId
      );
      if (!orderCreationRes.success) return failure(orderCreationRes.error);
      const { createdOrder, createdPayment, createdShipment } = orderCreationRes.value;

      await this.finalizeCartAndCoupon(userId, validatedCouponId);

      // COD: no payment to wait for, so book the shipment now. COD stock is NOT deducted here
      // (the business hasn't agreed the deduction point). Online orders are booked after
      // verified payment inside PaymentService.
      if (selectedPaymentMethod === 'cod') {
        await autoBookShipment(createdOrder.id, '[CheckoutService.processCheckout:COD]');
      }

      if (selectedPaymentMethod !== 'cod' && !createdPayment?.provider_order_id) {
        return failure(new ValidationError('Payment initialization failed: no Razorpay order was created'));
      }

      logger.info(`[CheckoutService] Order ${createdOrder.order_number} created in ${Date.now() - startTime}ms`);

      return success({
        order: createdOrder,
        items: orderItems as any,
        payment: createdPayment,
        razorpayOrderId: createdPayment?.provider_order_id || '',
        shipment: createdShipment,
        pricing: { subtotal, discount, tax, shipping, total },
      });
    } catch (err: any) {
      logger.error(`[CheckoutService] Unhandled checkout error after ${Date.now() - startTime}ms: ${err?.message || 'unknown error'}`);
      throw err;
    }
  }
}