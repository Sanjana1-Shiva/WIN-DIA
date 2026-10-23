import { Result, failure, success } from '../types/result.types';
import { AppError } from '../errors/app-error';
import { InventoryError, NotFoundError } from '../errors/domain-errors';
import { Product } from '../models/domain-models.types';
import { ProductRepository } from '../repositories/product.repository';
import { logger } from '../utils/logger.util';
import { container, RepositoryTokens } from '../providers/container.provider';

export interface ConfirmPaymentAndDeductArgs {
  orderId: string;
  providerOrderId: string;
  transactionId: string;
  /** Verified amount in INR (not paise) */
  amountInr: number;
}

export interface InventoryService {
  validateStock(productId: string, requiredQuantity: number): Promise<Result<Product, AppError>>;
  confirmPaymentAndDeductStock(args: ConfirmPaymentAndDeductArgs): Promise<Result<Record<string, unknown>, AppError>>;
  restoreStockAfterCancellation(productId: string, quantity: number): Promise<Result<Product, AppError>>;
}

export class InventoryServiceImpl implements InventoryService {
  private productRepo: ProductRepository;

  constructor(productRepo?: ProductRepository) {
    this.productRepo = productRepo || container.resolve<ProductRepository>(RepositoryTokens.ProductRepository);
  }

  public async validateStock(productId: string, requiredQuantity: number): Promise<Result<Product, AppError>> {
    const productRes = await this.productRepo.findById(productId);
    if (!productRes.success) return productRes;
    if (!productRes.value || !productRes.value.is_active) {
      return failure(new NotFoundError(`Product ID ${productId} is invalid or inactive`));
    }

    const product = productRes.value;
    if (product.count_in_stock < requiredQuantity) {
      logger.warn(
        `[InventoryService] Low stock for product ${product.sku ?? product.id}: ` +
        `requested ${requiredQuantity}, available ${product.count_in_stock}`
      );
      return failure(
        new InventoryError(
          `Insufficient inventory for "${product.name}". Available stock: ${product.count_in_stock}`
        )
      );
    }

    return success(product);
  }

  /**
   * Sole path for successful Razorpay payments. One DB transaction: checks stored order/payment
   * ids + amounts, updates payment/order status, deducts stock (in packets) and writes the ledger.
   * Call ONLY after the payment was independently verified with Razorpay.
   * Do not call deduct_windia_order_stock separately.
   */
  public async confirmPaymentAndDeductStock(args: ConfirmPaymentAndDeductArgs): Promise<Result<Record<string, unknown>, AppError>> {
    const { getAdminClient } = require('../config/supabase.config');
    const client = getAdminClient();

    const { data, error } = await client.rpc('confirm_windia_razorpay_payment_and_deduct_stock', {
      p_order_id: args.orderId,
      p_provider_order_id: args.providerOrderId,
      p_transaction_id: args.transactionId,
      p_amount: args.amountInr,
    });

    if (error) {
      logger.error(`[InventoryService] confirm_windia_razorpay_payment_and_deduct_stock failed for order ${args.orderId}: ${error.message}`);
      return failure(new InventoryError(`Payment confirmation/stock deduction failed: ${error.message}`));
    }

    // The RPC returns JSON. Treat an explicit failure flag as a failure
    // (exact shape isn't in the handoff — confirm with the DB owner).
    if (data && typeof data === 'object' && ((data as any).success === false || (data as any).ok === false)) {
      const msg = (data as any).error || (data as any).message || 'rejected by database';
      logger.error(`[InventoryService] Confirm RPC rejected order ${args.orderId}: ${msg}`);
      return failure(new InventoryError(`Payment confirmation rejected: ${msg}`));
    }

    return success((data ?? {}) as Record<string, unknown>);
  }

  /**
   * DISABLED: atomic_restore_stock is obsolete (stock is now per-flavour, in packets, via the
   * deduction ledger). Restock-on-cancel needs a new DB function from the DB owner.
   * Returns a failure instead of silently restoring the wrong thing.
   */
  public async restoreStockAfterCancellation(productId: string, quantity: number): Promise<Result<Product, AppError>> {
    logger.warn(
      `[InventoryService] restoreStockAfterCancellation(${productId}, ${quantity}) skipped — ` +
      `atomic_restore_stock is obsolete; manual stock reconciliation required`
    );
    return failure(
      new InventoryError('Automatic stock restoration is not available; manual reconciliation required')
    );
  }
}