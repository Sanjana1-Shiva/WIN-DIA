/**
 * WIN-DIA Bundle Pricing Configuration
 * ─────────────────────────────────────
 * THIS IS THE SINGLE SOURCE OF TRUTH for all pricing/bundle logic.
 * Never duplicate these values in cart, checkout, admin, or frontend.
 *
 * NEW STRUCTURE (Updated 2026-08-20):
 *   - Customers cannot purchase single packets.
 *   - The only purchasable unit is a BUNDLE of 6 packets.
 *   - 1 packet = 40 grams
 *   - 1 bundle = 6 packets = 240 grams
 *   - Each bundle contains ONE flavor
 *   - Tiered pricing: 1 bundle = ₹384, 2 = ₹640, 3 = ₹896, 4+ = ₹1152
 *   - Formula for N bundles (N >= 1): total = 384 + (N - 1) × 256
 *   - Shipping: ALWAYS ₹0 (Free Delivery on every order)
 *   - This applies identically across ALL varieties/flavors.
 */

export const BundlePricing = {
  /** Number of packets per bundle */
  PACKETS_PER_BUNDLE: 6,

  /** Number of packets actually SHIPPED per bundle (same as paid, no free packets) */
  PACKETS_SHIPPED_PER_BUNDLE: 6,

  /** Weight of one packet in grams */
  PACKET_WEIGHT_GRAMS: 40,

  /** Weight of one bundle in grams (PACKETS_PER_BUNDLE × PACKET_WEIGHT_GRAMS) */
  BUNDLE_WEIGHT_GRAMS: 240,

  /** Number of free bonus packets per bundle (NONE in new structure) */
  FREE_PACKETS_PER_BUNDLE: 0,

  /** Tiered pricing structure */
  TIER_1_BUNDLES: 1,
  TIER_1_PRICE: 384,

  TIER_2_BUNDLES: 2,
  TIER_2_PRICE: 640,

  TIER_3_BUNDLES: 3,
  TIER_3_PRICE: 896,

  TIER_4_BUNDLES: 4,
  TIER_4_PRICE: 1152,

  /** Shipping cost — always zero, free delivery on all orders */
  SHIPPING_COST: 0,

  /**
   * Tax rate (GST) — deactivated for now. Customers pay the tiered price
   * with no separate tax line; GST is treated as already included
   * in that price rather than added on top. Re-enable with a real rate once
   * business confirms it and the GSTIN is configured (see
   * app/admin/orders/page.jsx COMPANY_INFO.gstin).
   */
  TAX_RATE: 0,

  /** Minimum quantity: 1 bundle */
  MIN_BUNDLES: 1,

  /** Maximum bundles per order (stock-dependent, this is a sanity cap) */
  MAX_BUNDLES_PER_ITEM: 50,
} as const;

/**
 * Calculates pricing for a given number of bundles using tiered pricing.
 * This function is the ONLY place bundle math should happen.
 *
 * Tiered pricing formula: total = 384 + (N - 1) × 256
 * - 1 bundle = ₹384
 * - 2 bundles = ₹640 (₹320/bundle)
 * - 3 bundles = ₹896 (₹298.67/bundle)
 * - 4 bundles = ₹1152 (₹288/bundle)
 * - 5+ bundles = same incremental rate (₹256 per additional bundle)
 *
 * @param bundles - Number of bundles ordered (must be >= 1)
 * @returns Pricing breakdown
 */
export function calculateBundlePricing(bundles: number) {
  const validBundles = Math.max(1, Math.floor(bundles));

  // Tiered pricing calculation: 384 + (N - 1) × 256
  const lineTotal = BundlePricing.TIER_1_PRICE + (validBundles - 1) * 256;

  // Calculate per-bundle average price for display purposes
  const unitPrice = Math.round(lineTotal / validBundles);

  const packetsShipped = validBundles * BundlePricing.PACKETS_SHIPPED_PER_BUNDLE;

  return {
    bundles: validBundles,
    packetsShipped,
    unitPrice,
    lineTotal,
  };
}

/**
 * Calculates the full order pricing given line items and optional discount.
 *
 * @param itemsSubtotal - Sum of all line totals (bundles × BUNDLE_PRICE)
 * @param discountAmount - Coupon discount in ₹ (already validated)
 * @returns Full pricing object for the order
 */
export function calculateOrderTotal(itemsSubtotal: number, discountAmount: number = 0) {
  const shipping = BundlePricing.SHIPPING_COST; // Always 0
  const taxableAmount = Math.max(0, itemsSubtotal - discountAmount);
  const tax = Math.round(taxableAmount * BundlePricing.TAX_RATE * 100) / 100;
  const total = Math.round((taxableAmount + tax + shipping) * 100) / 100;

  return {
    subtotal: itemsSubtotal,
    discount: discountAmount,
    tax,
    shipping,
    total,
  };
}
