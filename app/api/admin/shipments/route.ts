import { NextResponse } from 'next/server';
import { container, ServiceTokens } from '@/src/backend/providers/container.provider';
import { OrderService } from '@/src/backend/services/order.service';
import { ShipmentService } from '@/src/backend/services/shipment.service';
import { getAdminUserContext, handleServiceResult } from '@/src/backend/utils/route-helper.util';
import { createErrorResponse } from '@/src/backend/types/api-response.types';
import { getAdminClient } from '@/src/backend/config/supabase.config';
import { dtdcProvider } from '@/src/backend/lib/dtdc';

export const runtime = 'nodejs';

/**
 * POST /api/admin/shipments
 * Admin-only: Creates a Shiprocket shipment for a confirmed/paid order.
 * Body: { orderId: string }
 */
export async function POST(request: Request) {
  try {
    const adminRes = await getAdminUserContext(request);
    if (!adminRes.success) {
      return handleServiceResult(adminRes);
    }

    const body = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'orderId is required'),
        { status: 400 }
      );
    }

    // Fetch the order with items
    const client = getAdminClient();
    const { data: order, error } = await client
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        createErrorResponse('NOT_FOUND', 'Order not found'),
        { status: 404 }
      );
    }

    // Validate: must be paid (for online payments) before shipping
    if (order.payment_method === 'razorpay' && order.payment_status !== 'paid') {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Cannot ship an unpaid order'),
        { status: 409 }
      );
    }

    // Check if already shipped
    if (order.awb_code) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'This order already has a shipment created'),
        { status: 409 }
      );
    }

    // Create shipment via dtdc
    const result = await dtdcProvider.createShipment({
      orderId: order.id,
      orderNumber: order.order_number,
      shippingAddress: order.shipping_address || {},
      items: (order.order_items || []).map((item: any) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
        product_id: item.product_id,
        net_weight_grams: item.net_weight_grams || 200,
      })),
      totalPrice: order.total_price,
      paymentMethod: order.payment_method,
    });

    // Update shipments table
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
      return NextResponse.json(
        createErrorResponse('SHIPPING_ERROR', `Shipment creation failed: ${result.error}`),
        { status: 502 }
      );
    }

    // Update order with AWB and status
    await client.from('orders').update({
      awb_code: result.awbCode || null,
      courier_name: result.courierName || null,
      shipping_provider: 'dtdc',
      order_status: 'processing',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);

    return NextResponse.json({
      success: true,
      data: {
        awbCode: result.awbCode,
        courierName: result.courierName,
        trackingUrl: result.trackingUrl,
        shipmentId: result.shipmentId,
        shiprocketOrderId: result.orderId,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error('[admin/shipments] Error:', err.message);
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/shipments?orderId=xxx
 * Admin-only: Track a shipment by order ID.
 */
export async function GET(request: Request) {
  try {
    const adminRes = await getAdminUserContext(request);
    if (!adminRes.success) {
      return handleServiceResult(adminRes);
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'orderId query parameter is required'),
        { status: 400 }
      );
    }

    const client = getAdminClient();
    const { data: order } = await client
      .from('orders')
      .select('awb_code, order_status, courier_name')
      .eq('id', orderId)
      .single();

    if (!order || !order.awb_code) {
      return NextResponse.json({
        success: true,
        data: {
          status: order?.order_status || 'placed',
          shipped: false,
          history: [],
        },
      });
    }

    const trackResult = await dtdcProvider.trackShipment(order.awb_code);

    return NextResponse.json({
      success: true,
      data: {
        status: trackResult.status || order.order_status,
        shipped: true,
        awbCode: order.awb_code,
        courierName: order.courier_name,
        history: trackResult.history || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}
