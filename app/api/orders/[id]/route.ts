import { NextResponse } from 'next/server';
import { container, ServiceTokens, RepositoryTokens } from '@/src/backend/providers/container.provider';
import { OrderService } from '@/src/backend/services/order.service';
import { OrderItemRepository } from '@/src/backend/repositories/order-item.repository';
import { getAuthUserContext, handleServiceResult } from '@/src/backend/utils/route-helper.util';
import { createErrorResponse } from '@/src/backend/types/api-response.types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authRes = await getAuthUserContext(request);
    if (!authRes.success) {
      return handleServiceResult(authRes);
    }

    const orderService = container.resolve<OrderService>(ServiceTokens.OrderService);
    const result = await orderService.getOrderById(id, authRes.value.id);

    if (!result.success) {
      return handleServiceResult(result);
    }

    // Fetch order items separately since getOrderById doesn't include them
    const orderItemRepo = container.resolve<OrderItemRepository>(RepositoryTokens.OrderItemRepository);
    const itemsRes = await orderItemRepo.findAll({ order_id: id });
    const order_items = itemsRes.success ? itemsRes.value : [];

    return NextResponse.json({
      success: true,
      order: {
        ...result.value,
        order_items,
      },
      data: result.value,
    });
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}

/**
 * CUSTOMER ORDERS ENDPOINT - READ ONLY
 * Per WIN-DIA policy: Customers CANNOT cancel orders.
 * Order cancellations can only be processed by admin through customer support.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authRes = await getAuthUserContext(request);
    if (!authRes.success) {
      return handleServiceResult(authRes);
    }

    const body = await request.json().catch(() => ({}));
    
    // Block all customer-initiated modifications
    if (body.action === 'cancel') {
      return NextResponse.json(
        createErrorResponse(
          'FORBIDDEN',
          'Order cancellations are not available. Please contact customer support for assistance.'
        ),
        { status: 403 }
      );
    }

    // Block any other actions
    return NextResponse.json(
      createErrorResponse('VALIDATION_ERROR', 'Order modifications are not supported'),
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred'),
      { status: 500 }
    );
  }
}
