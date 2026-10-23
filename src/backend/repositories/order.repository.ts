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
   * Inserts the order row.
   */
  private async insertOrder(
    client: SupabaseClient,
    userId: string,
    orderData: Record<string, unknown>
  ) {
    return client
      .from('orders')
      .insert({
        order_number: orderData.order_number || `WIN-${Date.now()}`,
        user_id: userId,
        order_status: orderData.order_status || 'placed',
        payment_status: orderData.payment_status || 'pending',
        payment_method: orderData.payment_method || 'razorpay',
        items_price: Number(orderData.items_price || 0),
        discount_price: Number(orderData.discount_price || 0),
        tax_price: Number(orderData.tax_price || 0),
        shipping_price: Number(orderData.shipping_price || 0),
        total_price: Number(orderData.total_price || 0),
        shipping_address: orderData.shipping_address || {},
        order_notes: orderData.order_notes || null,
      })
      .select('*')
      .single();
  }

  /**
   * Inserts the order_items rows for a given order.
   */
  private async insertOrderItems(
    client: SupabaseClient,
    orderId: string,
    orderItems: Record<string, unknown>[]
  ) {
    const itemsPayload = orderItems.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      name: item.name,
      price: Number(item.price || 0),
      qty: Number(item.qty || 1),
      flavor: item.flavor || null,
      net_weight_grams: item.net_weight_grams || null,
      image: item.image || null,
    }));

    return client.from('order_items').insert(itemsPayload).select('*');
  }

  /**
   * Inserts the shipment row for a given order.
   */
  private async insertShipment(
    client: SupabaseClient,
    orderId: string,
    shipmentData: Record<string, unknown>
  ) {
    return client
      .from('shipments')
      .insert({
        order_id: orderId,
        provider: 'dtdc',
        courier_name: shipmentData.courier_name || 'DTDC',
        status: shipmentData.status || 'created',
        raw_response: {},
      })
      .select('*')
      .single();
  }

  /**
   * Inserts a pending COD payment row for a given order.
   */
  private async insertCodPayment(
    client: SupabaseClient,
    orderId: string,
    paymentData: Record<string, unknown>
  ) {
    return client
      .from('payments')
      .insert({
        order_id: orderId,
        payment_provider: 'cod',
        transaction_id: null,
        provider_order_id: null,
        amount: Number(paymentData.amount || 0),
        currency: paymentData.currency || 'INR',
        status: 'pending',
        payment_method: 'cod',
        raw_response: {},
      })
      .select('*')
      .single();
  }

  /**
   * Deletes any rows already created for this checkout attempt, in dependency order.
   */
  private async rollbackCheckout(
    client: SupabaseClient,
    orderId: string,
    options: { shipmentId?: string } = {}
  ): Promise<void> {
    if (options.shipmentId) {
      await client.from('shipments').delete().eq('id', options.shipmentId);
    }
    await client.from('order_items').delete().eq('order_id', orderId);
    await client.from('orders').delete().eq('id', orderId);
  }

  public async createCheckoutTransaction(
    userId: string,
    orderData: Record<string, unknown>,
    orderItems: Record<string, unknown>[],
    paymentData: Record<string, unknown>,
    shipmentData: Record<string, unknown>
  ): Promise<Result<Record<string, unknown>, AppError>> {
    try {
      // The live WIN-DIA database uses the legacy orders/order_items schema.
      // Keep checkout compatible with it instead of calling the newer RPC,
      // whose shipment columns do not exist in the deployed database.
      const client = getAdminClient();

      const { data: order, error: orderError } = await this.insertOrder(client, userId, orderData);
      if (orderError || !order) {
        return failure(this.handleError(orderError || new Error('Order was not created'), 'createCheckoutTransaction'));
      }

      const { data: items, error: itemsError } = await this.insertOrderItems(client, order.id, orderItems);
      if (itemsError) {
        await this.rollbackCheckout(client, order.id);
        return failure(this.handleError(itemsError, 'createCheckoutTransaction'));
      }

      const { data: shipment, error: shipmentError } = await this.insertShipment(client, order.id, shipmentData);
      if (shipmentError) {
        await this.rollbackCheckout(client, order.id);
        return failure(this.handleError(shipmentError, 'createCheckoutTransaction'));
      }

      let payment: Record<string, unknown> | null = null;
      if (paymentData.payment_method === 'cod') {
        const { data: codPayment, error: paymentError } = await this.insertCodPayment(client, order.id, paymentData);
        if (paymentError) {
          await this.rollbackCheckout(client, order.id, { shipmentId: shipment.id });
          return failure(this.handleError(paymentError, 'createCheckoutTransaction'));
        }
        payment = codPayment as Record<string, unknown>;
      }

      return success({ order, items: items || [], payment, shipment });
    } catch (err) {
      return failure(this.handleError(err, 'createCheckoutTransaction'));
    }
  }
}