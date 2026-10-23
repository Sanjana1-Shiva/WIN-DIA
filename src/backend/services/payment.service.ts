import { createHmac, timingSafeEqual } from 'crypto';
import { Result, failure, success } from '../types/result.types';
import { AppError } from '../errors/app-error';
import { ValidationError } from '../errors/domain-errors';
import { Payment, PaymentEvent } from '../models/domain-models.types';
import { PaymentProvider, PaymentStatus } from '../enums/entity.enums';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentEventRepository } from '../repositories/payment-event.repository';
import { OrderRepository } from '../repositories/order.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { InventoryService } from './inventory.service';
import { getEnv } from '../config/env.config';
import { logger } from '../utils/logger.util';
import { container, RepositoryTokens, ServiceTokens } from '../providers/container.provider';
import { getRazorpayClient } from '../lib/razorpay.js';
import { PaymentError } from '../errors/domain-errors';
import { autoBookShipment } from './auto-shipment.util';

const RAZORPAY_CURRENCY = 'INR';

const PAYMENT_EVENT = {
  INITIATED: 'payment.initiated',
  SUCCEEDED: 'payment.succeeded',
  FAILED: 'payment.failed',
} as const;

const WEBHOOK_EVENT = {
  PAYMENT_CAPTURED: 'payment.captured',
  ORDER_PAID: 'order.paid',
  PAYMENT_FAILED: 'payment.failed',
} as const;

export interface VerifyPaymentDTO {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentService {
  initiateRazorpayPayment(orderId: string, amount: number, orderNumber: string): Promise<Result<{ payment: Payment; razorpayOrderId: string }, AppError>>;
  verifySignature(dto: VerifyPaymentDTO): Promise<Result<boolean, AppError>>;
  processSuccessfulPayment(paymentId: string, transactionId: string, rawPayload?: Record<string, unknown>): Promise<Result<Payment, AppError>>;
  processFailedPayment(paymentId: string, reason?: string, rawPayload?: Record<string, unknown>): Promise<Result<Payment, AppError>>;
  logPaymentEvent(paymentId: string, eventType: string, payload: Record<string, unknown>): Promise<Result<PaymentEvent, AppError>>;
  handleWebhook(payload: Record<string, unknown>, signature: string): Promise<Result<boolean, AppError>>;
}

export class PaymentServiceImpl implements PaymentService {
  private paymentRepo: PaymentRepository;
  private paymentEventRepo: PaymentEventRepository;
  private orderRepo: OrderRepository;
  private orderItemRepo: OrderItemRepository;
  private inventoryService: InventoryService;

  constructor(
    paymentRepo?: PaymentRepository,
    paymentEventRepo?: PaymentEventRepository,
    orderRepo?: OrderRepository,
    orderItemRepo?: OrderItemRepository,
    inventoryService?: InventoryService
  ) {
    this.paymentRepo = paymentRepo || container.resolve<PaymentRepository>(RepositoryTokens.PaymentRepository);
    this.paymentEventRepo = paymentEventRepo || container.resolve<PaymentEventRepository>(RepositoryTokens.PaymentEventRepository);
    this.orderRepo = orderRepo || container.resolve<OrderRepository>(RepositoryTokens.OrderRepository);
    this.orderItemRepo = orderItemRepo || container.resolve<OrderItemRepository>(RepositoryTokens.OrderItemRepository);
    this.inventoryService = inventoryService || container.resolve<InventoryService>(ServiceTokens.InventoryService);
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  public async initiateRazorpayPayment(
    orderId: string,
    amount: number,
    orderNumber: string
  ): Promise<Result<{ payment: Payment; razorpayOrderId: string }, AppError>> {
    logger.info(`[PaymentService.initiateRazorpayPayment] Initiating payment for order ${orderId}, amount ${amount}`);

    const razorpayOrderId = await this.createRazorpayOrder(orderId, amount, orderNumber);
    if (!razorpayOrderId.success) return failure(razorpayOrderId.error);

    const createPaymentRes = await this.paymentRepo.create({
      order_id: orderId,
      payment_provider: PaymentProvider.RAZORPAY,
      transaction_id: null,
      provider_order_id: razorpayOrderId.value,
      amount,
      currency: RAZORPAY_CURRENCY,
      status: PaymentStatus.PENDING,
      payment_method: 'card/upi/netbanking',
      raw_response: { provider_order_id: razorpayOrderId.value },
    });

    if (!createPaymentRes.success) return failure(createPaymentRes.error);

    await this.logPaymentEvent(createPaymentRes.value.id, PAYMENT_EVENT.INITIATED, {
      amount,
      order_number: orderNumber,
      provider_order_id: razorpayOrderId.value,
    });

    return success({
      payment: createPaymentRes.value,
      razorpayOrderId: razorpayOrderId.value,
    });
  }

  public async verifySignature(dto: VerifyPaymentDTO): Promise<Result<boolean, AppError>> {
    const env = getEnv();
    const secret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      // Fail closed: without a secret we cannot verify the signature at all.
      // Silently accepting the payment here would let anyone forge a "successful"
      // payment callback, so we reject instead of trusting it.
      logger.error('[PaymentService.verifySignature] RAZORPAY_KEY_SECRET is not set — cannot verify payment signature, rejecting');
      return failure(new PaymentError('Payment verification is not configured (missing RAZORPAY_KEY_SECRET)'));
    }

    try {
      const isValid = this.computeHmacHex(secret, `${dto.razorpay_order_id}|${dto.razorpay_payment_id}`) === dto.razorpay_signature;

      if (!isValid) {
        logger.warn(`[PaymentService.verifySignature] Signature mismatch for order ${dto.razorpay_order_id}`);
      }

      return success(isValid);
    } catch (err) {
      // Fail closed on unexpected errors (e.g. malformed signature) rather than
      // treating the payment as verified.
      logger.error('[PaymentService.verifySignature] Error while verifying signature', err);
      return failure(new PaymentError('Payment signature verification failed'));
    }
  }

  public async processSuccessfulPayment(
    paymentId: string,
    transactionId: string,
    rawPayload?: Record<string, unknown>
  ): Promise<Result<Payment, AppError>> {
    logger.info(`[PaymentService.processSuccessfulPayment] Processing payment ${paymentId} success with transaction ${transactionId}`);

    const updateRes = await this.paymentRepo.update(paymentId, {
      status: PaymentStatus.PAID,
      transaction_id: transactionId,
      raw_response: rawPayload || null,
    });

    if (!updateRes.success) return updateRes;

    await this.logPaymentEvent(paymentId, PAYMENT_EVENT.SUCCEEDED, {
      transaction_id: transactionId,
      payload: rawPayload,
    });

    return success(updateRes.value);
  }

  public async processFailedPayment(
    paymentId: string,
    reason?: string,
    rawPayload?: Record<string, unknown>
  ): Promise<Result<Payment, AppError>> {
    logger.warn(`[PaymentService.processFailedPayment] Payment ${paymentId} failed: ${reason}`);

    const updateRes = await this.paymentRepo.update(paymentId, {
      status: PaymentStatus.FAILED,
      raw_response: rawPayload || { reason },
    });

    if (!updateRes.success) return updateRes;

    await this.logPaymentEvent(paymentId, PAYMENT_EVENT.FAILED, {
      reason: reason || 'Payment failed',
      payload: rawPayload,
    });

    return success(updateRes.value);
  }

  /**
   * Process refund for a cancelled order.
   * Initiates a Razorpay refund and updates payment status to REFUNDED.
   */
  public async processRefund(orderId: string, reason?: string): Promise<Result<Payment, AppError>> {
    logger.info(`[PaymentService.processRefund] Processing refund for order ${orderId}`);

    // Find the payment record
    const paymentRes = await this.paymentRepo.findByOrderId(orderId);
    if (!paymentRes.success || !paymentRes.value || paymentRes.value.length === 0) {
      return failure(new ValidationError('Payment record not found for this order'));
    }

    const payment = paymentRes.value[0]; // Get the first (should be only one)

    // Check if already refunded
    if (payment.status === PaymentStatus.REFUNDED) {
      logger.info(`[PaymentService.processRefund] Payment ${payment.id} already refunded`);
      return success(payment);
    }

    // Only refund if payment was successful
    if (payment.status !== PaymentStatus.PAID) {
      logger.warn(`[PaymentService.processRefund] Payment ${payment.id} is not in PAID status (current: ${payment.status}), skipping refund`);
      return success(payment);
    }

    try {
      // Initiate Razorpay refund
      const razorpay = getRazorpayClient();
      const refundResponse = await razorpay.payments.refund(payment.transaction_id!, {
        amount: Math.round(payment.amount * 100), // Full refund in paise
        notes: {
          reason: reason || 'Order cancelled by customer',
          order_id: orderId,
        },
      });

      logger.info(`[PaymentService.processRefund] Razorpay refund created: ${refundResponse.id}`);

      // Update payment status to REFUNDED
      const updateRes = await this.paymentRepo.update(payment.id, {
        status: PaymentStatus.REFUNDED,
        raw_response: {
          ...(payment.raw_response || {}),
          refund: refundResponse,
          refund_id: refundResponse.id,
          refunded_at: new Date().toISOString(),
        },
      });

      if (!updateRes.success) return updateRes;

      // Log refund event
      await this.logPaymentEvent(payment.id, 'payment.refunded', {
        refund_id: refundResponse.id,
        amount: payment.amount,
        reason: reason || 'Order cancelled by customer',
        razorpay_response: refundResponse,
      });

      // Update order payment_status to REFUNDED
      await this.orderRepo.update(orderId, {
        payment_status: PaymentStatus.REFUNDED,
      } as any);

      logger.info(`[PaymentService.processRefund] Refund successful for order ${orderId}, payment ${payment.id}`);
      return success(updateRes.value);
    } catch (error: any) {
      logger.error(`[PaymentService.processRefund] Razorpay refund failed for order ${orderId}:`, error);
      
      // Log the failure
      await this.logPaymentEvent(payment.id, 'payment.refund_failed', {
        error: error.message,
        reason: reason || 'Order cancelled by customer',
      });

      return failure(new PaymentError(`Refund failed: ${error.message || 'Unknown error'}`));
    }
  }
  public async logPaymentEvent(
    paymentId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<Result<PaymentEvent, AppError>> {
    try {
      const paymentRes = await this.paymentRepo.findById(paymentId);
      const payment = paymentRes.success ? paymentRes.value : null;
      const eventStatus = this.resolveEventStatus(eventType);

      // The live payment_events table stores order/payment provider IDs and
      // raw_payload, rather than the newer payment_id/payload names.
      return await this.paymentEventRepo.create({
        order_id: payment?.order_id || null,
        razorpay_order_id: payment?.provider_order_id || payload.provider_order_id || payload.razorpay_order_id || null,
        razorpay_payment_id: payload.transaction_id || payload.razorpay_payment_id || null,
        event_type: eventType,
        status: eventStatus,
        raw_payload: { payment_id: paymentId, ...payload },
      } as Partial<PaymentEvent>);
    } catch (err) {
      logger.warn(`[PaymentService.logPaymentEvent] Could not log payment event: ${(err as any)?.message}`);
      return success({} as PaymentEvent);
    }
  }

  public async handleWebhook(payload: Record<string, unknown>, signature: string): Promise<Result<boolean, AppError>> {
    logger.info('[PaymentService.handleWebhook] Webhook received from Razorpay');

    if (!signature) {
      return failure(new ValidationError('Missing webhook signature'));
    }

    const signatureCheck = await this.verifyWebhookSignature(payload, signature);
    if (!signatureCheck.success) return signatureCheck;

    const event = (payload.event as string) || 'payment.event';
    const eventId = (payload.event_id || payload.id || `evt_${Date.now()}`) as string;

    if (await this.isDuplicateWebhookEvent(event, eventId)) {
      logger.info(`[PaymentService.handleWebhook] Duplicate webhook event ${eventId} ignored (idempotent)`);
      return success(true);
    }

    const paymentEntity = (payload.payload as any)?.payment?.entity;
    if (!paymentEntity) {
      logger.warn('[PaymentService.handleWebhook] No payment entity in webhook payload');
      // Log the event and return success (don't fail on non-payment webhooks)
      return success(true);
    }

    const razorpayOrderId = paymentEntity.order_id as string;
    const razorpayPaymentId = paymentEntity.id as string;
    const paymentRecord = razorpayOrderId ? await this.findPaymentByProviderOrderId(razorpayOrderId) : null;

    if (event === WEBHOOK_EVENT.PAYMENT_CAPTURED || event === WEBHOOK_EVENT.ORDER_PAID) {
      await this.handlePaymentCapturedEvent(paymentRecord, razorpayOrderId, razorpayPaymentId, paymentEntity);
    } else if (event === WEBHOOK_EVENT.PAYMENT_FAILED) {
      if (paymentRecord && paymentRecord.status !== 'paid') {
        await this.processFailedPayment(paymentRecord.id, paymentEntity.error_description || 'Payment failed via webhook', paymentEntity);
      }
    }

    if (paymentRecord) {
      await this.logPaymentEvent(paymentRecord.id, event, {
        event_id: eventId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        webhook_payload: paymentEntity,
      });
    }

    return success(true);
  }

  // ---------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------

  private async createRazorpayOrder(orderId: string, amount: number, orderNumber: string): Promise<Result<string, AppError>> {
    try {
      const razorpayOrder = await getRazorpayClient().orders.create({
        amount: Math.round(amount * 100),
        currency: RAZORPAY_CURRENCY,
        receipt: orderNumber,
        notes: { internal_order_id: orderId },
      });
      return success(razorpayOrder.id);
    } catch (error) {
      logger.error('[PaymentService.initiateRazorpayPayment] Razorpay order creation failed', error);
      return failure(new PaymentError('Could not create Razorpay order'));
    }
  }

  private computeHmacHex(secret: string, text: string): string {
    return createHmac('sha256', secret).update(text).digest('hex');
  }

  private resolveEventStatus(eventType: string): 'failed' | 'success' | 'pending' {
    if (eventType.includes('failed')) return 'failed';
    if (eventType.includes('succeeded')) return 'success';
    return 'pending';
  }

  /**
   * Verifies the Razorpay webhook signature against RAZORPAY_WEBHOOK_SECRET (when configured).
   * Uses a timing-safe comparison to avoid leaking signature validity via timing.
   */
  private async verifyWebhookSignature(payload: Record<string, unknown>, signature: string): Promise<Result<true, AppError>> {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.startsWith('REPLACE_ME')) {
      return success(true);
    }

    const rawBody = JSON.stringify(payload);
    const expectedSignature = this.computeHmacHex(webhookSecret, rawBody);

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      logger.warn('[PaymentService.handleWebhook] Webhook signature length mismatch — rejecting');
      return failure(new ValidationError('Invalid webhook signature'));
    }

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.warn('[PaymentService.handleWebhook] Webhook signature mismatch — rejecting');
      return failure(new ValidationError('Invalid webhook signature'));
    }

    return success(true);
  }

  private async isDuplicateWebhookEvent(event: string, eventId: string): Promise<boolean> {
    const existingEventsRes = await this.paymentEventRepo.findAll({ event_type: event });
    if (!existingEventsRes.success) return false;

    return existingEventsRes.value.some((e) => {
      const p = (e as any).raw_payload || e.payload;
      return p && ((p as any).event_id === eventId || (p as any).id === eventId);
    });
  }

  private async findPaymentByProviderOrderId(razorpayOrderId: string): Promise<Payment | null> {
    const lookupRes = await this.paymentRepo.findByProviderOrderId(razorpayOrderId);
    return lookupRes.success && lookupRes.value ? lookupRes.value : null;
  }

  private async handlePaymentCapturedEvent(
    paymentRecord: Payment | null,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    paymentEntity: any
  ): Promise<void> {
    if (!paymentRecord) {
      logger.warn(`[PaymentService.handleWebhook] No payment record found for Razorpay order ${razorpayOrderId} — needs reconciliation`);
      return;
    }

    // Only process if not already paid (prevents double-processing)
    if (paymentRecord.status === 'paid') {
      logger.info(`[PaymentService.handleWebhook] Payment ${paymentRecord.id} already marked paid — skipping`);
      return;
    }

    await this.processSuccessfulPayment(paymentRecord.id, razorpayPaymentId, paymentEntity);

    const orderId = paymentRecord.order_id;
    if (!orderId) return;

    await this.orderRepo.update(orderId, {
      order_status: 'processing' as any,
      payment_status: 'paid' as any,
      razorpay_payment_id: razorpayPaymentId,
    } as any);

    await this.deductStockForOrder(orderId);

    // Payment confirmed via webhook (may arrive before or instead of the
    // client-side verify call, e.g. if the user closed their browser) —
    // book the DTDC shipment automatically here too. autoBookShipment
    // is idempotent (checks order.awb_code first), so this is safe even if
    // payment/verify already booked it.
    await autoBookShipment(orderId, '[PaymentService.handleWebhook]');
  }

  /**
   * STOCK DEDUCTION: Deduct inventory after successful payment via webhook.
   * This ensures stock is deducted even if the client-side verify call never completes
   * (e.g., user closes browser). The atomic_deduct_stock RPC is idempotent in the sense
   * that if verify already ran and deducted, the order items' stock is already gone.
   * However, we guard against double-deduction by only calling this when payment
   * transitions from non-paid → paid (see handlePaymentCapturedEvent).
   */
  private async deductStockForOrder(orderId: string): Promise<void> {
    const itemsRes = await this.orderItemRepo.findByOrderId(orderId);

    if (!itemsRes.success) {
      logger.error(`[PaymentService.handleWebhook] Could not load order_items for order ${orderId}: ${itemsRes.error.message}`);
      return;
    }

    for (const item of itemsRes.value) {
      if (item.product_id && item.qty > 0) {
        const deductRes = await this.inventoryService.deductStockAfterSuccessfulPayment(item.product_id, item.qty);
        if (!deductRes.success) {
          logger.error(
            `[PaymentService.handleWebhook] Stock deduction failed for product ${item.product_id}: ${deductRes.error.message}`
          );
        }
      }
    }
  }
}