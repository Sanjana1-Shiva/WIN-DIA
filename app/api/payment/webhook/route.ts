import { NextResponse } from 'next/server';
import { container, ServiceTokens } from '@/src/backend/providers/container.provider';
import { PaymentService } from '@/src/backend/services/payment.service';
import { handleServiceResult } from '@/src/backend/utils/route-helper.util';
import { createErrorResponse } from '@/src/backend/types/api-response.types';
import { logger } from '@/src/backend/utils/logger.util';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Exact raw body: the signature is computed over these bytes. Never parse + re-stringify before verifying.
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid JSON payload'),
        { status: 400 }
      );
    }

    const paymentService = container.resolve<PaymentService>(ServiceTokens.PaymentService);
    const result = await paymentService.handleWebhook(payload, signature);

    return handleServiceResult(result);
  } catch (err: any) {
    logger.error('[payment/webhook] Unexpected error', err);
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}