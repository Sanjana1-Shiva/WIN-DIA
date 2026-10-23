import { Result, failure, success } from '../types/result.types';
import { AppError } from '../errors/app-error';
import { NotFoundError, ValidationError } from '../errors/domain-errors';
import { Order, OrderItem, OrderStatusHistory } from '../models/domain-models.types';
import { OrderStatus, PaymentStatus } from '../enums/entity.enums';
import { OrderRepository } from '../repositories/order.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { OrderStatusHistoryRepository } from '../repositories/order-status-history.repository';
import { ShipmentRepository } from '../repositories/shipment.repository';
import { InventoryService } from './inventory.service';
import { logger } from '../utils/logger.util';
import { container, RepositoryTokens, ServiceTokens } from '../providers/container.provider';

/**
 * Valid order status transitions map.
 * An order can only move FORWARD through these defined paths.
 * Cancellation is allowed from placed/confirmed/processing but NOT after shipped.
 * Refund is only allowed from cancelled state.
 */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  placed: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: ['refunded'],
  refunded: [],
};

function isValidStatusTransition(from: string, to: string): boolean {
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

function getAllowedTransitions(from: string): string[] {
  return STATUS_TRANSITIONS[from] || [];
}

function generateOrderNumber(): string {
  return `WIN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export interface OrderService {
  createOrder(userId: string, orderData: Partial<Order>): Promise<Result<Order, AppError>>;
  createOrderItems(orderId: string, items: Partial<OrderItem>[]): Promise<Result<OrderItem[], AppError>>;
  getOrderById(orderId: string, userId?: string): Promise<Result<Order, AppError>>;
  getOrderByNumber(orderNumber: string, userId?: string): Promise<Result<Order, AppError>>;
  getUserOrders(userId: string, options?: { page?: number; pageSize?: number; status?: string }): Promise<Result<{ items: Order[]; total: number }, AppError>>;
  updateOrderStatus(orderId: string, status: OrderStatus, note?: string, updatedBy?: string): Promise<Result<Order, AppError>>;
  writeStatusHistory(orderId: string, status: OrderStatus, note?: string, createdBy?: string): Promise<Result<OrderStatusHistory, AppError>>;
  cancelOrder(orderId: string, userId: string, reason?: string): Promise<Result<Order, AppError>>;
  markOrderPaid(orderId: string, note?: string, updatedBy?: string): Promise<Result<Order, AppError>>;
}

export class OrderServiceImpl implements OrderService {
  private orderRepo: OrderRepository;
  private orderItemRepo: OrderItemRepository;
  private statusHistoryRepo: OrderStatusHistoryRepository;
  private shipmentRepo: ShipmentRepository;
  private inventoryService: InventoryService;

  constructor(
    orderRepo?: OrderRepository,
    orderItemRepo?: OrderItemRepository,
    statusHistoryRepo?: OrderStatusHistoryRepository,
    inventoryService?: InventoryService
  ) {
    this.orderRepo = orderRepo || container.resolve<OrderRepository>(RepositoryTokens.OrderRepository);
    this.orderItemRepo = orderItemRepo || container.resolve<OrderItemRepository>(RepositoryTokens.OrderItemRepository);
    this.statusHistoryRepo = statusHistoryRepo || container.resolve<OrderStatusHistoryRepository>(RepositoryTokens.OrderStatusHistoryRepository);
    this.shipmentRepo = container.resolve<ShipmentRepository>(RepositoryTokens.ShipmentRepository);
    this.inventoryService = inventoryService || container.resolve<InventoryService>(ServiceTokens.InventoryService);
  }

  public async createOrder(userId: string, orderData: Partial<Order>): Promise<Result<Order, AppError>> {
    const start = Date.now();
    logger.info(`[OrderService.createOrder] Creating order for user ${userId}`);
    const orderNumber = orderData.order_number || generateOrderNumber();

    const payload: any = {
      order_number: orderNumber,
      user_id: userId,
      order_status: orderData.order_status || OrderStatus.PLACED,
      payment_status: orderData.payment_status || PaymentStatus.PENDING,
      payment_method: orderData.payment_method || (orderData as any).paymentMethod || 'razorpay',
      items_price: orderData.items_price || 0,
      discount_price: orderData.discount_price || 0,
      tax_price: orderData.tax_price || 0,
      shipping_price: orderData.shipping_price || 0,
      total_price: orderData.total_price || 0,
      shipping_address: orderData.shipping_address || {},
      order_notes: orderData.order_notes || null,
    };

    console.log(`[OrderService.createOrder] Repository: OrderRepository | Method: create | Payload:`, payload);
    const newOrderRes = await this.orderRepo.create(payload);
    const elapsed = Date.now() - start;

    if (!newOrderRes.success) {
      console.error(`[OrderService.createOrder] FAILURE | Time: ${elapsed}ms | Repository Error:`, {
        name: newOrderRes.error.name,
        message: newOrderRes.error.message,
        stack: newOrderRes.error.stack,
        details: newOrderRes.error.details,
      });
      return newOrderRes;
    }

    console.log(`[OrderService.createOrder] SUCCESS | Time: ${elapsed}ms | Created Order ID: ${newOrderRes.value.id}`);
    await this.writeStatusHistory(newOrderRes.value.id, OrderStatus.PLACED, 'Order placed successfully', userId);
    return success(newOrderRes.value);
  }

  public async createOrderItems(orderId: string, items: Partial<OrderItem>[]): Promise<Result<OrderItem[], AppError>> {
    const start = Date.now();
    logger.info(`[OrderService.createOrderItems] Adding ${items.length} items to order ${orderId}`);
    const prepared = items.map((i) => ({ ...i, order_id: orderId }));

    console.log(`[OrderService.createOrderItems] Repository: OrderItemRepository | Method: createMany | Items:`, prepared);
    const res = await this.orderItemRepo.createMany(prepared);
    const elapsed = Date.now() - start;

    if (!res.success) {
      console.error(`[OrderService.createOrderItems] FAILURE | Time: ${elapsed}ms | Repository Error:`, {
        name: res.error.name,
        message: res.error.message,
        stack: res.error.stack,
        details: res.error.details,
      });
      return res;
    }

    console.log(`[OrderService.createOrderItems] SUCCESS | Time: ${elapsed}ms | Items Count: ${res.value.length}`);
    return res;
  }

  public async getOrderById(orderId: string, userId?: string): Promise<Result<Order, AppError>> {
    const res = await this.orderRepo.findById(orderId);
    if (!res.success) return res;
    if (!res.value) {
      return failure(new NotFoundError(`Order ID ${orderId} not found`));
    }
    if (userId && res.value.user_id !== userId) {
      return failure(new NotFoundError(`Order ID ${orderId} not found for this user`));
    }
    return success(res.value);
  }

  public async getOrderByNumber(orderNumber: string, userId?: string): Promise<Result<Order, AppError>> {
    const res = await this.orderRepo.findByOrderNumber(orderNumber);
    if (!res.success) return res;
    if (!res.value) {
      return failure(new NotFoundError(`Order Number ${orderNumber} not found`));
    }
    if (userId && res.value.user_id !== userId) {
      return failure(new NotFoundError(`Order Number ${orderNumber} not found for this user`));
    }
    return success(res.value);
  }

  public async getUserOrders(userId: string, options?: { page?: number; pageSize?: number; status?: string }): Promise<Result<{ items: Order[]; total: number }, AppError>> {
    // If userId is empty, return ALL orders (admin use case)
    const filter: Record<string, unknown> = {};
    if (userId) {
      filter.user_id = userId;
    }
    if (options?.status) {
      filter.order_status = options.status;
    }
    return this.orderRepo.findWithPagination(options?.page || 1, options?.pageSize || 20, filter, 'created_at', 'desc');
  }

  public async updateOrderStatus(orderId: string, status: OrderStatus, note?: string, updatedBy?: string): Promise<Result<Order, AppError>> {
    const existing = await this.getOrderById(orderId);
    if (!existing.success) return existing;

    // Validate status transition — status can only move FORWARD in proper sequence
    const currentStatus = existing.value.order_status;
    if (!isValidStatusTransition(currentStatus, status)) {
      return failure(new ValidationError(
        `Invalid status transition: cannot move from "${currentStatus}" to "${status}". ` +
        `Allowed transitions from "${currentStatus}": ${getAllowedTransitions(currentStatus).join(', ') || 'none'}`
      ));
    }

    const updateRes = await this.orderRepo.update(orderId, { order_status: status });
    if (!updateRes.success) return updateRes;

    // STOCK RESTORATION: When an order is cancelled and payment was already processed
    // (i.e., stock was deducted), restore inventory for each order item.
    if (status === OrderStatus.CANCELLED) {
      const paymentStatus = existing.value.payment_status;
      // Stock is deducted only after successful payment, so restore only if paid
      const stockWasDeducted = paymentStatus === PaymentStatus.PAID;
      // Also restore if order was in processing/shipped (meaning payment went through)
      const orderWasProcessed = ['processing', 'confirmed'].includes(currentStatus);

      if (stockWasDeducted || orderWasProcessed) {
        logger.info(`[OrderService.updateOrderStatus] Order ${orderId} cancelled — restoring stock for all items`);
        const itemsRes = await this.orderItemRepo.findByOrderId(orderId);
        if (itemsRes.success && itemsRes.value.length > 0) {
          for (const item of itemsRes.value) {
            if (item.product_id && item.qty > 0) {
              const restoreRes = await this.inventoryService.restoreStockAfterCancellation(item.product_id, item.qty);
              if (!restoreRes.success) {
                logger.error(
                  `[OrderService.updateOrderStatus] Stock restoration failed for product ${item.product_id}: ${restoreRes.error.message}`
                );
              }
            }
          }
        } else if (!itemsRes.success) {
          logger.error(`[OrderService.updateOrderStatus] Could not load order items for stock restoration: ${itemsRes.error.message}`);
        }
      }
    }

    await this.writeStatusHistory(orderId, status, note || `Status updated to ${status}`, updatedBy);
    return success(updateRes.value);
  }

  public async writeStatusHistory(orderId: string, status: OrderStatus, note?: string, createdBy?: string): Promise<Result<OrderStatusHistory, AppError>> {
    return this.statusHistoryRepo.create({
      order_id: orderId,
      status,
    });
  }

  /**
   * Marks an order's payment_status as PAID and advances order_status to
   * PROCESSING, in one place. The client-side Razorpay verify flow
   * (app/api/payment/verify/route.ts) previously only called
   * updateOrderStatus(), which updates order_status but never touches
   * payment_status — so orders stayed stuck on "pending" in the admin
   * dashboard forever unless the Razorpay webhook happened to fire and
   * update it separately. This keeps both fields in sync for every
   * successful-payment code path.
   */
  public async markOrderPaid(orderId: string, note?: string, updatedBy?: string): Promise<Result<Order, AppError>> {
    const statusRes = await this.updateOrderStatus(orderId, OrderStatus.CONFIRMED, note, updatedBy);
    if (!statusRes.success) return statusRes;

    const paymentUpdateRes = await this.orderRepo.update(orderId, { payment_status: PaymentStatus.PAID });
    if (!paymentUpdateRes.success) return paymentUpdateRes;

    return success(paymentUpdateRes.value);
  }

  /**
   * Customer-initiated cancellation. Only the order's owner may call this
   * (ownership is enforced via getOrderById's userId check). Reuses the same
   * transition/stock-restoration logic as the admin path via updateOrderStatus,
   * and additionally marks payment_status as FAILED when the customer backed
   * out before ever completing payment (e.g. closed the Razorpay checkout),
   * so an abandoned order doesn't sit forever looking like a live, pending
   * payment — this is what previously showed as "Placed / Pending" with no
   * way to distinguish it from a genuinely in-progress order.
   * 
   * CANCELLATION POLICY: Customers can cancel their order ONLY until 2 days
   * before shipping is assigned. If shipped_at is set, the cutoff is 2 days
   * before that date at 12:00 PM (noon).
   */
  public async cancelOrder(orderId: string, userId: string, reason?: string): Promise<Result<Order, AppError>> {
    const existing = await this.getOrderById(orderId, userId);
    if (!existing.success) return existing;

    const order = existing.value;

    // Check if shipment has been assigned - only allow cancel before shipment
    const shipmentRes = await this.shipmentRepo.findByOrderId(orderId);
    if (shipmentRes.success && shipmentRes.value && shipmentRes.value.shipped_at) {
      return failure(
        new ValidationError(
          `Cannot cancel - order has already been shipped. Please contact support for assistance.`
        )
      );
    }

    const updateRes = await this.updateOrderStatus(
      orderId,
      OrderStatus.CANCELLED,
      reason || 'Cancelled by customer',
      userId
    );
    if (!updateRes.success) return updateRes;

    // Handle payment status based on current state
    let newPaymentStatus = order.payment_status;
    
    if (order.payment_status === PaymentStatus.PENDING) {
      // Payment never completed - mark as failed
      newPaymentStatus = PaymentStatus.FAILED;
    } else if (order.payment_status === PaymentStatus.PAID) {
      // Online payment was completed - initiate refund
      newPaymentStatus = PaymentStatus.REFUND_INITIATED;
      logger.info(`[OrderService.cancelOrder] Initiating refund for paid order ${orderId}`);
      // TODO: Integrate with Razorpay refund API here
    } else if (order.payment_status === PaymentStatus.COD_PENDING) {
      // COD order cancelled before delivery - no payment collected, just mark as failed
      newPaymentStatus = PaymentStatus.FAILED;
    }

    // Update payment status
    const paymentUpdateRes = await this.orderRepo.update(orderId, { payment_status: newPaymentStatus });
    if (paymentUpdateRes.success) {
      return success(paymentUpdateRes.value);
    }
    
    // Non-fatal: the order is cancelled either way, just log and return what we have.
    logger.error(`[OrderService.cancelOrder] Could not update payment_status for order ${orderId}: ${paymentUpdateRes.error.message}`);

    return success(updateRes.value);
  }
}
