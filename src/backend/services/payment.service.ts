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
  RECONCILE: 'payment.reconcile_required',
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

export interface ConfirmPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Internal order UUID the caller claims this payment belongs to (verify route). Optional for webhooks. */
  expectedOrderId?: string;
  source: 'verify' | 'webhook';
}

export type ConfirmPaymentResult =
  | { outcome: 'confirmed'; orderId: string }
  | { outcome: 'already_processed'; orderId: string }
  | { outcome: 'rejected'; reason: string };

export interface PaymentService {
  initiateRazorpayPayment(orderId: string, amount: number, orderNumber: string): Promise<Result<{ payment: Payment; razorpayOrderId: string }, AppError>>;
  verifySignature(dto: VerifyPaymentDTO): Promise<Result<boolean, AppError>>;
  confirmVerifiedRazorpayPayment(input: ConfirmPaymentInput): Promise<Result<ConfirmPaymentResult, AppError>>;
  processFailedPayment(paymentId: string, reason?: string, rawPayload?: Record<string, unknown>): Promise<Result<Payment, AppError>>;
  logPaymentEvent(paymentId: string, eventType: string, payload: Record<string, unknown>): Promise<Result<PaymentEvent, AppError>>;
  handleWebhook(rawBody: string, signature: string, eventId?: string | null): Promise<Result<boolean, AppError>>;
}

export class PaymentServiceImpl implements PaymentService {
  private paymentRepo: PaymentRepository;
  private paymentEventRepo: PaymentEventRepository;
  private orderRepo: OrderRepository;
  private inventoryService: InventoryService;

  constructor(
    paymentRepo?: PaymentRepository,
    paymentEventRepo?: PaymentEventRepository,
    orderRepo?: OrderRepository,
    _orderItemRepo?: OrderItemRepository, // kept so container wiring doesn't change; stock is now handled in the DB
    inventoryService?: InventoryService
  ) {
    this.paymentRepo = paymentRepo || container.resolve<PaymentRepository>(RepositoryTokens.PaymentRepository);
    this.paymentEventRepo = paymentEventRepo || container.resolve<PaymentEventRepository>(RepositoryTokens.PaymentEventRepository);
    this.orderRepo = orderRepo || container.resolve<OrderRepository>(RepositoryTokens.OrderRepository);
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
      logger.error('[PaymentService.verifySignature] RAZORPAY_KEY_SECRET is not set — cannot verify payment signature, rejecting');
      return failure(new PaymentError('Payment verification is not configured (missing RAZORPAY_KEY_SECRET)'));
    }

    try {
      const expected = this.computeHmacHex(secret, `${dto.razorpay_order_id}|${dto.razorpay_payment_id}`);
      const isValid = this.safeEqual(expected, dto.razorpay_signature);

      if (!isValid) {
        logger.warn(`[PaymentService.verifySignature] Signature mismatch for razorpay order ${dto.razorpay_order_id}`);
      }

      return success(isValid);
    } catch (err) {
      logger.error('[PaymentService.verifySignature] Error while verifying signature', err);
      return failure(new PaymentError('Payment signature verification failed'));
    }
  }

  /**
   * THE single successful-payment path (used by both /payment/verify and the webhook).
   *
   * 1. Fetch the payment from Razorpay and confirm it is captured, in INR, on the right order, for the right amount.
   * 2. Match it to our payment row.
   * 3. Call confirm_windia_razorpay_payment_and_deduct_stock (status updates + stock deduction, one DB transaction).
   *
   * Nothing here writes payments.status / orders.payment_status directly.
   *
   * Result semantics:
   *  - success(confirmed | already_processed): fine.
   *  - success(rejected): a definite mismatch/not-captured; retrying will not help.
   *  - failure: provider or RPC error; may be retried (webhook returns non-2xx so Razorpay retries).
   */
  public async confirmVerifiedRazorpayPayment(input: ConfirmPaymentInput): Promise<Result<ConfirmPaymentResult, AppError>> {
    const { razorpayOrderId, razorpayPaymentId, expectedOrderId, source } = input;
    const tag = `[PaymentService.confirm:${source}]`;

    const payment = await this.findPaymentByProviderOrderId(razorpayOrderId);
    if (!payment || !payment.order_id) {
      logger.error(`${tag} No payment record for razorpay order ${razorpayOrderId} — needs reconciliation`);
      return success({ outcome: 'rejected', reason: 'unknown_order' });
    }
    const orderId = payment.order_id;

    if (expectedOrderId && expectedOrderId !== orderId) {
      logger.warn(`${tag} Order id mismatch for razorpay order ${razorpayOrderId}`);
      return success({ outcome: 'rejected', reason: 'order_mismatch' });
    }

    // Already confirmed by the other path (webhook vs verify) — nothing more to do.
    if (payment.status === PaymentStatus.PAID) {
      if (payment.transaction_id === razorpayPaymentId) {
        return success({ outcome: 'already_processed', orderId });
      }
      logger.error(`${tag} Order ${orderId} already paid with a different payment id — manual review`);
      return success({ outcome: 'rejected', reason: 'payment_id_mismatch' });
    }

    // Ask Razorpay directly; a frontend success callback alone is not proof.
    let rp: any;
    try {
      rp = await getRazorpayClient().payments.fetch(razorpayPaymentId);
    } catch (err: any) {
      logger.error(`${tag} Could not fetch payment ${razorpayPaymentId} from Razorpay: ${err?.message || 'unknown error'}`);
      return failure(new PaymentError('Could not verify payment with Razorpay'));
    }

    if (rp.order_id !== razorpayOrderId) {
      logger.error(`${tag} Razorpay order id mismatch for payment ${razorpayPaymentId}`);
      return success({ outcome: 'rejected', reason: 'provider_order_mismatch' });
    }
    if (rp.currency !== RAZORPAY_CURRENCY) {
      logger.error(`${tag} Unexpected currency "${rp.currency}" for payment ${razorpayPaymentId}`);
      return success({ outcome: 'rejected', reason: 'currency_mismatch' });
    }
    if (rp.status !== 'captured') {
      logger.warn(`${tag} Payment ${razorpayPaymentId} not captured (status: ${rp.status})`);
      return success({ outcome: 'rejected', reason: 'not_captured' });
    }

    // Compare in paise (integers) to avoid float issues, then convert to INR for the RPC.
    const expectedPaise = Math.round(Number(payment.amount) * 100);
    const capturedPaise = Number(rp.amount);
    if (!Number.isFinite(capturedPaise) || capturedPaise !== expectedPaise) {
      logger.error(`${tag} Amount mismatch for order ${orderId}: expected ${expectedPaise} paise, Razorpay ${capturedPaise}`);
      return success({ outcome: 'rejected', reason: 'amount_mismatch' });
    }
    const amountInr = capturedPaise / 100;

    const rpcRes = await this.inventoryService.confirmPaymentAndDeductStock({
      orderId,
      providerOrderId: razorpayOrderId,
      transactionId: razorpayPaymentId,
      amountInr,
    });

    if (!rpcRes.success) {
      // Race: the other path may have committed between our status check and the RPC.
      const latest = await this.findPaymentByProviderOrderId(razorpayOrderId);
      if (latest?.status === PaymentStatus.PAID && latest.transaction_id === razorpayPaymentId) {
        return success({ outcome: 'already_processed', orderId });
      }

      // Payment is captured but the DB rolled back (e.g. stock validation). Do NOT report fulfilled.
      logger.error(
        `${tag} Confirm+deduct RPC failed for order ${orderId} / payment ${razorpayPaymentId} — captured payment needs reconciliation: ${rpcRes.error.message}`
      );
      await this.logPaymentEvent(payment.id, PAYMENT_EVENT.RECONCILE, {
        transaction_id: razorpayPaymentId,
        provider_order_id: razorpayOrderId,
        source,
        reason: rpcRes.error.message,
      });
      return failure(rpcRes.error);
    }

    await this.logPaymentEvent(payment.id, PAYMENT_EVENT.SUCCEEDED, {
      transaction_id: razorpayPaymentId,
      provider_order_id: razorpayOrderId,
      source,
    });

    // Non-fatal: payment already succeeded; admin "Retry shipment" is the fallback. autoBookShipment is idempotent.
    try {
      await autoBookShipment(orderId, `[PaymentService.confirm:${source}]`);
    } catch (err: any) {
      logger.error(`${tag} Shipment booking failed for order ${orderId}: ${err?.message || 'unknown error'}`);
    }

    return success({ outcome: 'confirmed', orderId });
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

    const paymentRes = await this.paymentRepo.findByOrderId(orderId);
    if (!paymentRes.success || !paymentRes.value || paymentRes.value.length === 0) {
      return failure(new ValidationError('Payment record not found for this order'));
    }

    const payment = paymentRes.value[0];

    if (payment.status === PaymentStatus.REFUNDED) {
      logger.info(`[PaymentService.processRefund] Payment ${payment.id} already refunded`);
      return success(payment);
    }

    if (payment.status !== PaymentStatus.PAID) {
      logger.warn(`[PaymentService.processRefund] Payment ${payment.id} is not in PAID status (current: ${payment.status}), skipping refund`);
      return success(payment);
    }

    try {
      const razorpay = getRazorpayClient();
      const refundResponse = await razorpay.payments.refund(payment.transaction_id!, {
        amount: Math.round(payment.amount * 100),
        notes: {
          reason: reason || 'Order cancelled by customer',
          order_id: orderId,
        },
      });

      logger.info(`[PaymentService.processRefund] Razorpay refund created: ${refundResponse.id}`);

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

      await this.logPaymentEvent(payment.id, 'payment.refunded', {
        refund_id: refundResponse.id,
        amount: payment.amount,
        reason: reason || 'Order cancelled by customer',
        razorpay_response: refundResponse,
      });

      await this.orderRepo.update(orderId, {
        payment_status: PaymentStatus.REFUNDED,
      } as any);

      logger.info(`[PaymentService.processRefund] Refund successful for order ${orderId}, payment ${payment.id}`);
      return success(updateRes.value);
    } catch (error: any) {
      logger.error(`[PaymentService.processRefund] Razorpay refund failed for order ${orderId}:`, error);

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

  /**
   * @param rawBody  exact request body string (signature is computed over these bytes)
   * @param eventId  value of the x-razorpay-event-id header, when present
   */
  public async handleWebhook(rawBody: string, signature: string, eventId?: string | null): Promise<Result<boolean, AppError>> {
    logger.info('[PaymentService.handleWebhook] Webhook received from Razorpay');

    if (!signature) {
      return failure(new ValidationError('Missing webhook signature'));
    }

    // Verify BEFORE parsing; fails closed when the secret is missing.
    const signatureCheck = this.verifyWebhookSignature(rawBody, signature);
    if (!signatureCheck.success) return signatureCheck;

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return failure(new ValidationError('Invalid webhook payload'));
    }

    const event = (payload.event as string) || 'payment.event';

    // Best-effort dedupe on the real Razorpay event id. The hard guarantee against
    // double deduction is the DB RPC + unique indexes, not this check.
    if (eventId && (await this.isDuplicateWebhookEvent(event, eventId))) {
      logger.info(`[PaymentService.handleWebhook] Duplicate webhook event ${eventId} ignored`);
      return success(true);
    }

    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      logger.info(`[PaymentService.handleWebhook] No payment entity in "${event}" webhook — ignoring`);
      return success(true);
    }

    const razorpayOrderId = paymentEntity.order_id as string | undefined;
    const razorpayPaymentId = paymentEntity.id as string | undefined;
    const paymentRecord = razorpayOrderId ? await this.findPaymentByProviderOrderId(razorpayOrderId) : null;

    if (event === WEBHOOK_EVENT.PAYMENT_CAPTURED || event === WEBHOOK_EVENT.ORDER_PAID) {
      if (!razorpayOrderId || !razorpayPaymentId) {
        logger.warn('[PaymentService.handleWebhook] Captured event without order/payment id — ignoring');
        return success(true);
      }

      const confirmRes = await this.confirmVerifiedRazorpayPayment({
        razorpayOrderId,
        razorpayPaymentId,
        source: 'webhook',
      });

      // failure => non-2xx so Razorpay retries (handler is idempotent).
      if (!confirmRes.success) return failure(confirmRes.error);

      if (confirmRes.value.outcome === 'rejected') {
        // Definite mismatch — retrying won't help. Logged inside confirm; ack so Razorpay stops retrying.
        logger.error(`[PaymentService.handleWebhook] Payment ${razorpayPaymentId} rejected: ${confirmRes.value.reason}`);
      }
    } else if (event === WEBHOOK_EVENT.PAYMENT_FAILED) {
      // Log only. Razorpay lets a customer retry on the same order after a failed attempt,
      // so a failed attempt must not permanently mark the payment row failed.
      logger.info(`[PaymentService.handleWebhook] payment.failed received for razorpay order ${razorpayOrderId}`);
    }

    // Record the event (ids/status only — no customer data) so the event id is traceable.
    if (paymentRecord) {
      await this.logPaymentEvent(paymentRecord.id, event, {
        event_id: eventId || null,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        payment_status: paymentEntity.status,
        amount: paymentEntity.amount,
        currency: paymentEntity.currency,
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

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private resolveEventStatus(eventType: string): 'failed' | 'success' | 'pending' {
    if (eventType.includes('failed') || eventType.includes('reconcile')) return 'failed';
    if (eventType.includes('succeeded')) return 'success';
    return 'pending';
  }

  /**
   * Webhook signature over the exact raw body. Fails closed if the secret is missing/placeholder.
   */
  private verifyWebhookSignature(rawBody: string, signature: string): Result<true, AppError> {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.startsWith('REPLACE_ME')) {
      logger.error('[PaymentService.handleWebhook] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook');
      return failure(new PaymentError('Webhook verification is not configured'));
    }

    const expected = this.computeHmacHex(webhookSecret, rawBody);
    if (!this.safeEqual(expected, signature)) {
      logger.warn('[PaymentService.handleWebhook] Webhook signature mismatch — rejecting');
      return failure(new ValidationError('Invalid webhook signature'));
    }

    return success(true);
  }

  private async isDuplicateWebhookEvent(event: string, eventId: string): Promise<boolean> {
    const existingEventsRes = await this.paymentEventRepo.findAll({ event_type: event });
    if (!existingEventsRes.success) return false;

    return existingEventsRes.value.some((e) => {
      const p = (e as any).raw_payload || (e as any).payload;
      return p && (p as any).event_id === eventId;
    });
  }

  private async findPaymentByProviderOrderId(razorpayOrderId: string): Promise<Payment | null> {
    const lookupRes = await this.paymentRepo.findByProviderOrderId(razorpayOrderId);
    return lookupRes.success && lookupRes.value ? lookupRes.value : null;
  }
}