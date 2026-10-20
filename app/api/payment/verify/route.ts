import { NextResponse } from 'next/server';
import { container, ServiceTokens } from '@/src/backend/providers/container.provider';
import { PaymentService } from '@/src/backend/services/payment.service';
import { getAuthUserContext, handleServiceResult } from '@/src/backend/utils/route-helper.util';
import { createErrorResponse } from '@/src/backend/types/api-response.types';
import { logger } from '@/src/backend/utils/logger.util';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const authRes = await getAuthUserContext(request);
    if (!authRes.success) {
      return handleServiceResult(authRes);
    }

    const body = await request.json().catch(() => ({}));
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (
      typeof orderId !== 'string' ||
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string' ||
      !orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature
    ) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Missing payment verification fields'),
        { status: 400 }
      );
    }

    const paymentService = container.resolve<PaymentService>(ServiceTokens.PaymentService);

    // 1. Checkout signature (server-side, fail closed).
    // A bad signature does NOT mark the payment failed: this endpoint is
    // callable by anyone, so it must never be able to flip a real payment's status.
    const verifyRes = await paymentService.verifySignature({
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });
    if (!verifyRes.success) return handleServiceResult(verifyRes);
    if (!verifyRes.value) {
      logger.warn(`[payment/verify] Invalid signature for razorpay order ${razorpay_order_id}`);
      return NextResponse.json(
        createErrorResponse('PAYMENT_ERROR', 'Payment verification failed'),
        { status: 400 }
      );
    }

    // 2. Provider check + DB match + atomic confirm-and-deduct (single path shared with webhook)
    const confirmRes = await paymentService.confirmVerifiedRazorpayPayment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      expectedOrderId: orderId,
      source: 'verify',
    });

    if (!confirmRes.success) {
      // Payment may be captured but not yet confirmed (provider/RPC error). Details are logged server-side.
      return NextResponse.json(
        createErrorResponse(
          'PAYMENT_ERROR',
          'We could not confirm your order yet. If you were charged, please contact support with your order ID.'
        ),
        { status: 500 }
      );
    }

    const result = confirmRes.value;
    if (result.outcome === 'rejected') {
      return NextResponse.json(
        createErrorResponse('PAYMENT_ERROR', 'Payment could not be verified'),
        { status: result.reason === 'not_captured' ? 409 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      orderId,
      ...(result.outcome === 'already_processed' ? { note: 'Payment was already processed' } : {}),
    });
  } catch (err: any) {
    logger.error('[payment/verify] Unexpected error', err);
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}