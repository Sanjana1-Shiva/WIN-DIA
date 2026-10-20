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
import { container, RepositoryTokens } from '../providers/container.provider';

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
}

export class OrderServiceImpl implements OrderService {
  private orderRepo: OrderRepository;
  private orderItemRepo: OrderItemRepository;
  private statusHistoryRepo: OrderStatusHistoryRepository;
  private shipmentRepo: ShipmentRepository;

  constructor(
    orderRepo?: OrderRepository,
    orderItemRepo?: OrderItemRepository,
    statusHistoryRepo?: OrderStatusHistoryRepository,
    _inventoryService?: InventoryService // unused now (stock lives in the DB) — kept so container wiring is unchanged
  ) {
    this.orderRepo = orderRepo || container.resolve<OrderRepository>(RepositoryTokens.OrderRepository);
    this.orderItemRepo = orderItemRepo || container.resolve<OrderItemRepository>(RepositoryTokens.OrderItemRepository);
    this.statusHistoryRepo = statusHistoryRepo || container.resolve<OrderStatusHistoryRepository>(RepositoryTokens.OrderStatusHistoryRepository);
    this.shipmentRepo = container.resolve<ShipmentRepository>(RepositoryTokens.ShipmentRepository);
  }

  /**
   * NOTE: not used by checkout any more. Checkout goes through create_checkout_order_transaction,
   * which generates the order number itself. Do not use this for customer orders.
   */
  public async createOrder(userId: string, orderData: Partial<Order>): Promise<Result<Order, AppError>> {
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

    const newOrderRes = await this.orderRepo.create(payload);
    if (!newOrderRes.success) {
      logger.error(`[OrderService.createOrder] Failed: ${newOrderRes.error.message}`);
      return newOrderRes;
    }

    await this.writeStatusHistory(newOrderRes.value.id, OrderStatus.PLACED, 'Order placed successfully', userId);
    return success(newOrderRes.value);
  }

  public async createOrderItems(orderId: string, items: Partial<OrderItem>[]): Promise<Result<OrderItem[], AppError>> {
    logger.info(`[OrderService.createOrderItems] Adding ${items.length} items to order ${orderId}`);
    const prepared = items.map((i) => ({ ...i, order_id: orderId }));

    const res = await this.orderItemRepo.createMany(prepared);
    if (!res.success) {
      logger.error(`[OrderService.createOrderItems] Failed: ${res.error.message}`);
    }
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

    // Stock is deducted per flavour, in packets, by the DB (confirm_windia_razorpay_payment_and_deduct_stock).
    // The old atomic_restore_stock is obsolete and no app-side restore may touch inventory, so a paid
    // order that gets cancelled needs manual reconciliation until the DB owner provides a restore function.
    if (status === OrderStatus.CANCELLED && existing.value.payment_status === PaymentStatus.PAID) {
      logger.warn(
        `[OrderService.updateOrderStatus] Paid order ${orderId} cancelled — stock was deducted and is NOT restored automatically; manual reconciliation required`
      );
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
   * Customer-initiated cancellation. Only the order's owner may call this
   * (ownership is enforced via getOrderById's userId check). Reuses the same
   * transition logic as the admin path via updateOrderStatus, and marks
   * payment_status as FAILED when the customer backed out before completing
   * payment so an abandoned order doesn't sit forever looking like a live,
   * pending payment.
   *
   * CANCELLATION POLICY: Customers can cancel their order ONLY until 2 days
   * before shipping is assigned. If shipped_at is set, the cutoff is 2 days
   * before that date at 12:00 PM (noon).
   */
  public async cancelOrder(orderId: string, userId: string, reason?: string): Promise<Result<Order, AppError>> {
    const existing = await this.getOrderById(orderId, userId);
    if (!existing.success) return existing;

    const shipmentRes = await this.shipmentRepo.findByOrderId(orderId);
    if (shipmentRes.success && shipmentRes.value && shipmentRes.value.shipped_at) {
      const shippedAt = new Date(shipmentRes.value.shipped_at);
      const cutoffDate = new Date(shippedAt);
      cutoffDate.setDate(cutoffDate.getDate() - 2); // 2 days before shipping
      cutoffDate.setHours(12, 0, 0, 0); // 12:00 PM

      const now = new Date();
      if (now > cutoffDate) {
        return failure(
          new ValidationError(
            `Cancellation deadline has passed. Orders must be cancelled at least 2 days before shipping date (by ${cutoffDate.toLocaleDateString('en-IN')} 12:00 PM).`
          )
        );
      }
    }

    const updateRes = await this.updateOrderStatus(
      orderId,
      OrderStatus.CANCELLED,
      reason || 'Cancelled by customer',
      userId
    );
    if (!updateRes.success) return updateRes;

    // If payment never completed, reflect that instead of leaving it on "pending".
    // If it was already paid, leave PAID — refunding is a separate admin-initiated step.
    if (updateRes.value.payment_status === PaymentStatus.PENDING) {
      const paymentUpdateRes = await this.orderRepo.update(orderId, { payment_status: PaymentStatus.FAILED });
      if (paymentUpdateRes.success) {
        return success(paymentUpdateRes.value);
      }
      logger.error(`[OrderService.cancelOrder] Could not update payment_status for order ${orderId}: ${paymentUpdateRes.error.message}`);
    }

    return success(updateRes.value);
  }
}