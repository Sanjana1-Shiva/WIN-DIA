import { Result, failure, success } from '../types/result.types';
import { AppError } from '../errors/app-error';
import { NotFoundError, ValidationError } from '../errors/domain-errors';
import { Cart, CartItem } from '../models/domain-models.types';
import { AddToCartDTO, UpdateCartItemDTO } from '../types/dto.types';
import { CartRepository } from '../repositories/cart.repository';
import { CartItemRepository } from '../repositories/cart-item.repository';
import { ProductRepository } from '../repositories/product.repository';
import { logger } from '../utils/logger.util';
import { container, RepositoryTokens } from '../providers/container.provider';

export interface CartService {
  getCart(userId?: string, sessionId?: string): Promise<Result<{ cart: Cart; items: CartItem[] }, AppError>>;
  addItem(cartId: string, dto: AddToCartDTO, userId?: string): Promise<Result<CartItem, AppError>>;
  updateItemQuantity(cartId: string, productId: string, dto: UpdateCartItemDTO, userId?: string): Promise<Result<CartItem, AppError>>;
  removeItem(cartId: string, productId: string, userId?: string): Promise<Result<boolean, AppError>>;
  clearCart(cartId: string, userId?: string): Promise<Result<boolean, AppError>>;
  mergeGuestCart(sessionId: string, userId: string): Promise<Result<{ cart: Cart; items: CartItem[] }, AppError>>;
  calculateSubtotal(items: CartItem[]): Promise<Result<number, AppError>>;
}

export class CartServiceImpl implements CartService {
  private cartRepo: CartRepository;
  private cartItemRepo: CartItemRepository;
  private productRepo: ProductRepository;

  constructor(
    cartRepo?: CartRepository,
    cartItemRepo?: CartItemRepository,
    productRepo?: ProductRepository
  ) {
    this.cartRepo = cartRepo || container.resolve<CartRepository>(RepositoryTokens.CartRepository);
    this.cartItemRepo = cartItemRepo || container.resolve<CartItemRepository>(RepositoryTokens.CartItemRepository);
    this.productRepo = productRepo || container.resolve<ProductRepository>(RepositoryTokens.ProductRepository);
  }

  public async getCart(userId?: string, sessionId?: string): Promise<Result<{ cart: Cart; items: CartItem[] }, AppError>> {
    if (!userId && !sessionId) {
      return failure(new ValidationError('Either userId or sessionId is required to access cart'));
    }

    let cartRes: Result<Cart | null, AppError>;
    if (userId) {
      cartRes = await this.cartRepo.findByUserId(userId);
    } else {
      cartRes = await this.cartRepo.findBySessionId(sessionId!);
    }

    if (!cartRes.success) return failure(cartRes.error);

    let cart = cartRes.value;
    if (!cart) {
      const createRes = await this.cartRepo.create({
        user_id: userId || null,
        session_id: sessionId || null,
      });
      if (!createRes.success) return failure(createRes.error);
      cart = createRes.value;
    }

    const itemsRes = await this.cartItemRepo.findByCartId(cart.id);
    if (!itemsRes.success) return failure(itemsRes.error);

    return success({ cart, items: itemsRes.value });
  }

  public async addItem(cartId: string, dto: AddToCartDTO, userId?: string): Promise<Result<CartItem, AppError>> {
    logger.info(`[CartService.addItem] Adding product ${dto.product_id} to cart ${cartId}`);

    // Ownership check: if userId is provided, verify cart belongs to this user
    if (userId) {
      const ownershipCheck = await this.verifyCartOwnership(cartId, userId);
      if (!ownershipCheck.success) return failure(ownershipCheck.error);
    }

    // Validate the product exists and is active using ProductRepository
    const productRes = await this.productRepo.findById(dto.product_id);
    if (!productRes.success) return failure(productRes.error);
    if (!productRes.value || !productRes.value.is_active) {
      return failure(new NotFoundError('Product is no longer active or available'));
    }

    const existingRes = await this.cartItemRepo.findItem(cartId, dto.product_id);
    if (!existingRes.success) return failure(existingRes.error);

    if (existingRes.value) {
      const newQty = existingRes.value.quantity + dto.quantity;
      return this.cartItemRepo.update(existingRes.value.id, { quantity: newQty });
    }

    return this.cartItemRepo.create({
      cart_id: cartId,
      product_id: dto.product_id,
      quantity: dto.quantity,
    });
  }

  public async updateItemQuantity(cartId: string, productId: string, dto: UpdateCartItemDTO, userId?: string): Promise<Result<CartItem, AppError>> {
    // Ownership check
    if (userId) {
      const ownershipCheck = await this.verifyCartOwnership(cartId, userId);
      if (!ownershipCheck.success) return failure(ownershipCheck.error);
    }

    const itemRes = await this.cartItemRepo.findItem(cartId, productId);
    if (!itemRes.success) return failure(itemRes.error);
    if (!itemRes.value) {
      return failure(new NotFoundError('Item not found in cart'));
    }

    if (dto.quantity <= 0) {
      await this.cartItemRepo.delete(itemRes.value.id);
      return failure(new ValidationError('Item removed from cart because quantity was set to 0'));
    }

    return this.cartItemRepo.update(itemRes.value.id, { quantity: dto.quantity });
  }

  public async removeItem(cartId: string, productId: string, userId?: string): Promise<Result<boolean, AppError>> {
    // Ownership check
    if (userId) {
      const ownershipCheck = await this.verifyCartOwnership(cartId, userId);
      if (!ownershipCheck.success) return failure(ownershipCheck.error);
    }

    // The browser can send a slug (e.g. "everyday-jeera") instead of a UUID. product_id is a uuid
    // column, so querying it with a slug throws a 500. Resolve the slug first.
    let resolvedProductId = productId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);
    if (!isUuid) {
      const base = productId.trim().toLowerCase();
      const stripped = base.replace(/^(gluten-free|everyday)-/, '');
      const candidates = Array.from(new Set([base, stripped, `${stripped}-thins`, `${stripped}s-thins`]));
      let found: string | null = null;
      for (const slug of candidates) {
        const prodRes = await this.productRepo.findBySlug(slug);
        if (prodRes.success && prodRes.value) {
          found = prodRes.value.id;
          break;
        }
      }
      if (!found) {
        return success(true); // Nothing stored under this id — idempotent
      }
      resolvedProductId = found;
    }

    const itemRes = await this.cartItemRepo.findItem(cartId, resolvedProductId);
    if (!itemRes.success) return failure(itemRes.error);
    if (!itemRes.value) {
      return success(true); // Already removed — idempotent
    }
    return this.cartItemRepo.delete(itemRes.value.id);
  }

  public async clearCart(cartId: string, userId?: string): Promise<Result<boolean, AppError>> {
    // Ownership check
    if (userId) {
      const ownershipCheck = await this.verifyCartOwnership(cartId, userId);
      if (!ownershipCheck.success) return failure(ownershipCheck.error);
    }

    return this.cartItemRepo.deleteByCartId(cartId);
  }

  /**
   * Verifies that the given cartId belongs to the given userId.
   * Prevents one user from mutating another user's cart.
   */
  private async verifyCartOwnership(cartId: string, userId: string): Promise<Result<boolean, AppError>> {
    const cartRes = await this.cartRepo.findByUserId(userId);
    if (!cartRes.success) return failure(cartRes.error);
    if (!cartRes.value || cartRes.value.id !== cartId) {
      return failure(new ValidationError('You do not have access to this cart'));
    }
    return success(true);
  }

  public async mergeGuestCart(sessionId: string, userId: string): Promise<Result<{ cart: Cart; items: CartItem[] }, AppError>> {
    logger.info(`[CartService.mergeGuestCart] Merging guest cart ${sessionId} for user ${userId}`);
    const guestCartRes = await this.getCart(undefined, sessionId);
    const userCartRes = await this.getCart(userId);

    if (!userCartRes.success) return userCartRes;
    const userCart = userCartRes.value.cart;

    if (guestCartRes.success && guestCartRes.value.items.length > 0) {
      for (const item of guestCartRes.value.items) {
        await this.addItem(userCart.id, { product_id: item.product_id, quantity: item.quantity });
      }
      await this.cartRepo.delete(guestCartRes.value.cart.id);
    }

    return this.getCart(userId);
  }

  public async calculateSubtotal(items: CartItem[]): Promise<Result<number, AppError>> {
    if (!items || items.length === 0) {
      return success(0);
    }

    // Batched query — fetch all active products and build a map to avoid N+1 queries
    const productsRes = await this.productRepo.findAll({ is_active: true });
    if (!productsRes.success) return failure(productsRes.error);

    const productMap = new Map(productsRes.value.map((p) => [p.id, p]));
    let total = 0;

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (product) {
        total += Number(product.price) * item.quantity;
      }
    }

    return success(Math.round(total * 100) / 100);
  }
}