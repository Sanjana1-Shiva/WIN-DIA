import { NextResponse } from 'next/server';
import { ServiceTokens, RepositoryTokens } from '@/src/backend/providers/container.provider';
import { OrderService } from '@/src/backend/services/order.service';
import { ShipmentRepository } from '@/src/backend/repositories/shipment.repository';
import { getAdminUserContext, handleServiceResult } from '@/src/backend/utils/route-helper.util';
import { createErrorResponse } from '@/src/backend/types/api-response.types';

/**
 * ADMIN-ONLY ORDER CANCELLATION ENDPOINT
 * 
 * Per WIN-DIA policy:
 * - Customers CANNOT cancel orders directly
 * - Admin CAN cancel orders when customer contacts support
 * 
 * Business Rules:
 * - Only orders in 'placed', 'confirmed', or 'processing' status can be cancelled
 * - Cannot cancel shipped or delivered orders
 * - Checks for active DTDC shipment before cancellation
 * - Does NOT automatically initiate Razorpay refunds (manual process)
 * - Payment status transitions handled appropriately
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminRes = await getAdminUserContext(request);
    if (!adminRes.success) {
      return handleServiceResult(adminRes);
    }

    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Order ID is required'),
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Get order service
    const orderService = adminRes.value.scope.resolve<OrderService>(ServiceTokens.OrderService);
    
    // Get order details (admin can access any order, so no userId restriction)
    const orderRes = await orderService.getOrderById(orderId);
    if (!orderRes.success) {
      return handleServiceResult(orderRes);
    }

    const order = orderRes.value;

    // Validation: Check order status
    const cancellableStatuses = ['placed', 'confirmed', 'processing'];
    if (!cancellableStatuses.includes(order.order_status)) {
      if (order.order_status === 'cancelled') {
        return NextResponse.json(
          createErrorResponse('VALIDATION_ERROR', 'Order is already cancelled'),
          { status: 400 }
        );
      }
      if (order.order_status === 'delivered') {
        return NextResponse.json(
          createErrorResponse(
            'VALIDATION_ERROR',
            'Cannot cancel delivered orders. Please contact technical support for exceptional cases.'
          ),
          { status: 400 }
        );
      }
      if (order.order_status === 'shipped' || order.order_status === 'out_for_delivery') {
        return NextResponse.json(
          createErrorResponse(
            'VALIDATION_ERROR',
            'Cannot cancel shipped orders. The shipment is in transit. Please coordinate with DTDC for return-to-origin if needed.'
          ),
          { status: 400 }
        );
      }
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          `Cannot cancel order with status: ${order.order_status}`
        ),
        { status: 400 }
      );
    }

    // Validation: Check for active shipment
    const shipmentRepo = adminRes.value.scope.resolve<ShipmentRepository>(RepositoryTokens.ShipmentRepository);
    const shipmentRes = await shipmentRepo.findByOrderId(orderId);
    
    if (shipmentRes.success && shipmentRes.value) {
      const shipment = shipmentRes.value;
      
      // If shipment has been picked up or is in transit, block cancellation
      if (shipment.shipped_at || shipment.status === 'shipped' || shipment.status === 'in_transit') {
        return NextResponse.json(
          createErrorResponse(
            'VALIDATION_ERROR',
            'Cannot cancel order - DTDC shipment is already in transit. AWB: ' + (shipment.awb_code || 'N/A')
          ),
          { status: 400 }
        );
      }

      // If shipment was just created but not picked up, allow cancellation
      // (Admin should also cancel the DTDC booking separately if needed)
      if (shipment.awb_code) {
        console.warn(`[Admin Cancel] Order ${orderId} has DTDC booking (AWB: ${shipment.awb_code}) but not yet shipped. Admin should cancel DTDC booking separately.`);
      }
    }

    // Perform cancellation using OrderService
    // Pass admin user ID as the userId parameter
    const cancelReason = reason || `Cancelled by admin (${adminRes.value.email || adminRes.value.id}) on customer request`;
    const cancelRes = await orderService.cancelOrder(
      orderId,
      adminRes.value.id, // Admin's user ID
      cancelReason
    );

    if (!cancelRes.success) {
      return handleServiceResult(cancelRes);
    }

    // Return success with updated order
    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      data: cancelRes.value,
      notes: {
        payment_refund: order.payment_status === 'paid' 
          ? 'Payment status updated to refund_initiated. Process Razorpay refund manually through Razorpay dashboard.'
          : 'No refund needed - payment not completed',
        dtdc_shipment: shipmentRes.success && shipmentRes.value?.awb_code
          ? `DTDC booking exists (AWB: ${shipmentRes.value.awb_code}). Cancel shipment through DTDC if not picked up.`
          : 'No DTDC shipment found',
      },
    });

  } catch (err: any) {
    console.error('[Admin Cancel Order Error]', err);
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}
