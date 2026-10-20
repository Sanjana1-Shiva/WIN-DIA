import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository, IBaseRepository } from './base.repository';
import { Order } from '../models/domain-models.types';
import { Result, failure, success } from '../types/result.types';
import { AppError } from '../errors/app-error';
import { getServerClient, getAdminClient } from '../config/supabase.config';

export interface OrderRepository extends IBaseRepository<Order, string, Partial<Order>, Partial<Order>> {
  findByOrderNumber(orderNumber: string): Promise<Result<Order | null, AppError>>;
  findByUserId(userId: string): Promise<Result<Order[], AppError>>;
  findWithDetails(orderId: string): Promise<Result<Record<string, unknown> | null, AppError>>;
  createCheckoutTransaction(
    userId: string,
    orderData: Record<string, unknown>,
    orderItems: Record<string, unknown>[],
    paymentData: Record<string, unknown>,
    shipmentData: Record<string, unknown>
  ): Promise<Result<Record<string, unknown>, AppError>>;
}

export class SupabaseOrderRepository
  extends BaseRepository<Order, string, Partial<Order>, Partial<Order>>
  implements OrderRepository {
  constructor(clientOrGetter?: SupabaseClient | (() => SupabaseClient)) {
    super('orders', clientOrGetter || (() => getAdminClient()));
  }

  public async findByOrderNumber(orderNumber: string): Promise<Result<Order | null, AppError>> {
    try {
      const client = this.getClient();
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (error) {
        return failure(this.handleError(error, 'findByOrderNumber'));
      }

      return success((data as Order) || null);
    } catch (err) {
      return failure(this.handleError(err, 'findByOrderNumber'));
    }
  }

  public async findByUserId(userId: string): Promise<Result<Order[], AppError>> {
    return this.findAll({ user_id: userId });
  }

  public async findWithDetails(orderId: string): Promise<Result<Record<string, unknown> | null, AppError>> {
    try {
      const client = this.getClient();
      const { data, error } = await client
        .from(this.tableName)
        .select(`
          *,
          items:order_items(*)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        return failure(this.handleError(error, 'findWithDetails'));
      }

      return success(data || null);
    } catch (err) {
      return failure(this.handleError(err, 'findWithDetails'));
    }
  }

  /**
   * Single database transaction via create_checkout_order_transaction.
   * The DB creates the order (and generates the order number), order items, combo selections,
   * shipment, and the COD payment record where applicable. Do NOT pass an order_number, and do
   * not insert any of these rows from application code.
   *
   * ASSUMPTION — CONFIRM WITH DB OWNER: the argument names below (p_user_id, p_order_data,
   * p_items, p_payment_data, p_shipment_data). Supabase RPC needs the exact names; they are
   * visible in the function definition. The returned JSON is expected to look like
   * { order, items, payment, shipment } — confirm that too.
   */
  public async createCheckoutTransaction(
    userId: string,
    orderData: Record<string, unknown>,
    orderItems: Record<string, unknown>[],
    paymentData: Record<string, unknown>,
    shipmentData: Record<string, unknown>
  ): Promise<Result<Record<string, unknown>, AppError>> {
    try {
      const client = getAdminClient();

      const { data, error } = await client.rpc('create_checkout_order_transaction', {
        p_user_id: userId,
        p_order_data: orderData,
        p_items: orderItems,
        p_payment_data: paymentData,
        p_shipment_data: shipmentData,
      });

      if (error) {
        return failure(this.handleError(error, 'createCheckoutTransaction'));
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result || typeof result !== 'object') {
        return failure(this.handleError(new Error('Checkout RPC returned no data'), 'createCheckoutTransaction'));
      }

      return success(result as Record<string, unknown>);
    } catch (err) {
      return failure(this.handleError(err, 'createCheckoutTransaction'));
    }
  }
}