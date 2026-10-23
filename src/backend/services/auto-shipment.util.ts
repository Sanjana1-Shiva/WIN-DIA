import { container, RepositoryTokens } from '../providers/container.provider';
import { OrderRepository } from '../repositories/order.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { getShippingProvider } from '../lib/shipping';
import { getAdminClient } from '../config/supabase.config';
import { logger } from '../utils/logger.util';

/**
 * Automatically books a DTDC shipment for an order once its
 * payment is confirmed (or immediately for COD orders). This is the single
 * place shipment booking is triggered from — called by both the client-side
 * payment/verify route and the Razorpay webhook handler, so a shipment gets
 * created no matter which path confirms the payment first.
 *
 * Intentionally non-throwing: shipment booking must never fail the payment
 * confirmation response. Errors are logged and the order is left without an
 * AWB code, which the admin dashboard's "Retry shipment" action can pick up
 * manually as a fallback if the automatic booking fails (e.g. DTDC API
 * outage, address data issue).
 */
export async function autoBookShipment(orderId: string, logPrefix = '[auto-shipment]'): Promise<void> {
  try {
    console.log(`${logPrefix} STARTING for orderId: ${orderId}`);
    
    // Get DTDC shipping provider
    const shippingProvider = getShippingProvider();
    
    // TEST MODE: Skip actual shipment creation (legacy env var, can be removed later)
    if (process.env.SHIPROCKET_TEST_MODE === 'true') {
      console.log(`${logPrefix} ⚠️  TEST MODE ENABLED - Skipping real shipment creation`);
      console.log(`${logPrefix} Set SHIPROCKET_TEST_MODE=false to enable shipments`);
      return;
    }
    
    const orderRepo = container.resolve<OrderRepository>(RepositoryTokens.OrderRepository);
    const orderItemRepo = container.resolve<OrderItemRepository>(RepositoryTokens.OrderItemRepository);

    console.log(`${logPrefix} Loading order from repository...`);
    const orderRes = await orderRepo.findById(orderId);
    if (!orderRes.success || !orderRes.value) {
      console.error(`${logPrefix} Could not load order ${orderId} for auto-shipment`);
      logger.error(`${logPrefix} Could not load order ${orderId} for auto-shipment`);
      return;
    }
    const order = orderRes.value as any;
    console.log(`${logPrefix} Order loaded: ${order.order_number}, AWB: ${order.awb_code || 'none'}`);

    // Already booked — nothing to do (idempotent, safe to call more than once
    // e.g. if both the webhook and client-side verify fire for the same order).
    if (order.awb_code) {
      console.log(`${logPrefix} Order already has AWB code, skipping...`);
      return;
    }

    console.log(`${logPrefix} Loading order items...`);
    const itemsRes = await orderItemRepo.findByOrderId(orderId);
    if (!itemsRes.success || itemsRes.value.length === 0) {
      console.error(`${logPrefix} Could not load order items for order ${orderId}, skipping auto-shipment`);
      logger.error(`${logPrefix} Could not load order items for order ${orderId}, skipping auto-shipment`);
      return;
    }
    console.log(`${logPrefix} Found ${itemsRes.value.length} order items`);

    console.log(`${logPrefix} Calling DTDC API to create shipment...`);
    const result = await shippingProvider.createShipment({
      orderId: order.id,
      orderNumber: order.order_number,
      shippingAddress: order.shipping_address || {},
      items: itemsRes.value.map((item: any) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
        product_id: item.product_id,
        net_weight_grams: (() => {
          const weight = item.net_weight_grams;
          if (!weight || weight <= 0) {
            console.error(`[auto-shipment] ERROR: Order item "${item.name}" has no weight!`);
            throw new Error(`Cannot create shipment: Item "${item.name}" missing net_weight_grams`);
          }
          return weight;
        })(),
      })),
      totalPrice: order.total_price,
      paymentMethod: order.payment_method,
    });

    const client = getAdminClient();
    await client.from('shipments').upsert({
      order_id: order.id,
      provider: 'dtdc',
      awb_code: result.awbCode || null,
      courier_name: result.courierName || null,
      status: result.success ? 'created' : 'failed',
      tracking_url: result.trackingUrl || null,
      raw_response: result.raw || {},
    }, { onConflict: 'order_id' });

    if (!result.success) {
      logger.error(`${logPrefix} DTDC shipment creation failed for order ${orderId}: ${result.error}`);
      return;
    }

    await client.from('orders').update({
      awb_code: result.awbCode || null,
      courier_name: result.courierName || null,
      shipping_provider: 'dtdc',
      order_status: 'processing',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);

    logger.info(`${logPrefix} Auto-booked DTDC shipment for order ${orderId} (AWB: ${result.awbCode || 'pending'})`);
    console.log(`${logPrefix} ✅ SUCCESS - AWB: ${result.awbCode || 'pending'}, Courier: ${result.courierName || 'pending'}`);
  } catch (err: any) {
    console.error(`${logPrefix} ❌ EXCEPTION:`, err?.message, err?.stack);
    logger.error(`${logPrefix} Unexpected error during auto-shipment for order ${orderId}: ${err?.message}`);
  }
}
