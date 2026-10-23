import { NextResponse } from 'next/server';
import { container, ServiceTokens, RepositoryTokens } from '@/src/backend/providers/container.provider';
import { PaymentService } from '@/src/backend/services/payment.service';
import { OrderService } from '@/src/backend/services/order.service';
import { InventoryService } from '@/src/backend/services/inventory.service';
import { PaymentRepository } from '@/src/backend/repositories/payment.repository';
import { OrderItemRepository } from '@/src/backend/repositories/order-item.repository';
import { getAuthUserContext, handleServiceResult } from '@/src/backend/utils/route-helper.util';
import { createErrorResponse } from '@/src/backend/types/api-response.types';
import { autoBookShipment } from '@/src/backend/services/auto-shipment.util';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const authRes = await getAuthUserContext(request);
    if (!authRes.success) {
      return handleServiceResult(authRes);
    }

    const body = await request.json().catch(() => ({}));
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Missing payment verification fields'),
        { status: 400 }
      );
    }

    const paymentService = container.resolve<PaymentService>(ServiceTokens.PaymentService);
    const orderService = container.resolve<OrderService>(ServiceTokens.OrderService);
    const inventoryService = container.resolve<InventoryService>(ServiceTokens.InventoryService);
    const paymentRepo = container.resolve<PaymentRepository>(RepositoryTokens.PaymentRepository);
    const orderItemRepo = container.resolve<OrderItemRepository>(RepositoryTokens.OrderItemRepository);

    // Lookup the Payment row by provider_order_id (razorpay_order_id) to obtain payment.id.
    // The route previously passed orderId to processSuccessfulPayment/processFailedPayment
    // but those methods call paymentRepo.update(paymentId, ...) — an orders UUID never
    // matches a payments.id row, so the payment record was never updated.
    const paymentLookupRes = await paymentRepo.findByProviderOrderId(razorpay_order_id);
    if (!paymentLookupRes.success) {
      return NextResponse.json(
        createErrorResponse('INTERNAL_SERVER_ERROR', 'Failed to retrieve payment record'),
        { status: 500 }
      );
    }
    if (!paymentLookupRes.value) {
      return NextResponse.json(
        createErrorResponse('PAYMENT_ERROR', `No payment record found for Razorpay order ${razorpay_order_id}`),
        { status: 404 }
      );
    }
    const paymentId = paymentLookupRes.value.id;

    const verifyRes = await paymentService.verifySignature({
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!verifyRes.success || !verifyRes.value) {
      await paymentService.processFailedPayment(paymentId, 'Signature verification failed', body);
      return NextResponse.json(
        createErrorResponse('PAYMENT_ERROR', 'Payment verification failed'),
        { status: 400 }
      );
    }

    // Process payment success & update order status
    // Check if payment was already processed (e.g., by the webhook arriving first).
    // If already paid, the webhook already deducted stock — skip to avoid double-deduction.
    const existingPayment = paymentLookupRes.value;
    if (existingPayment.status === 'paid') {
      // Payment already processed by webhook — just return success without re-deducting stock
      return NextResponse.json({
        success: true,
        verified: true,
        orderId,
        note: 'Payment was already processed by webhook',
      });
    }

    await paymentService.processSuccessfulPayment(paymentId, razorpay_payment_id, body);
    // markOrderPaid updates BOTH order_status and payment_status together —
    // updateOrderStatus alone only ever touched order_status, which is why
    // payment_status stayed "pending" in the admin dashboard even after a
    // successful client-side payment (it only got fixed if the webhook fired).
    await orderService.markOrderPaid(orderId, 'Payment verified via Razorpay client SDK', authRes.value.id);

    // Fetch order_items directly from the order_items table using order_id.
    // getOrderById only returns the orders row (no join) — it never contains order_items.
    // order_items columns: product_id, qty.
    const itemsRes = await orderItemRepo.findByOrderId(orderId);
    if (itemsRes.success && itemsRes.value.length > 0) {
      for (const item of itemsRes.value) {
        if (item.product_id && item.qty > 0) {
          const deductRes = await inventoryService.deductStockAfterSuccessfulPayment(item.product_id, item.qty);
          if (!deductRes.success) {
            // Log and continue — payment is already confirmed, do not fail the response
            console.error(
              `[payment/verify] Stock deduction failed for product ${item.product_id}:`,
              deductRes.error.message
            );
          }
        }
      }
    } else if (!itemsRes.success) {
      console.error(`[payment/verify] Could not load order_items for order ${orderId}:`, itemsRes.error.message);
    }

    // Payment is confirmed — book the DTDC shipment automatically.
    // Non-fatal: the customer's payment already succeeded, so a shipping
    // booking hiccup must not fail this response. If it fails, the admin's
    // "Retry shipment" button (app/admin/orders) is the manual fallback.
    await autoBookShipment(orderId, '[payment/verify]');

    return NextResponse.json({
      success: true,
      verified: true,
      orderId,
    });
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}
