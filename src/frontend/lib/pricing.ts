/**
 * WIN-DIA Frontend Pricing Utilities
 * ───────────────────────────────────
 * Client-side pricing calculations that MUST match backend bundle-pricing.constants.ts
 * 
 * IMPORTANT: These are for DISPLAY ONLY. The backend independently validates all prices.
 * Never submit these client-calculated prices to the server expecting them to be trusted.
 */

/**
 * Bundle pricing constants (must match backend)
 */
export const BUNDLE_CONFIG = {
  PACKETS_PER_BUNDLE: 6,
  PACKET_WEIGHT_GRAMS: 40,
  BUNDLE_WEIGHT_GRAMS: 240,
  MIN_BUNDLES: 1,
  MAX_BUNDLES: 50,
} as const;

/**
 * Calculates tiered pricing for N bundles.
 * Formula: total = 384 + (N - 1) × 256
 * 
 * Examples:
 * - 1 bundle = ₹384
 * - 2 bundles = ₹640
 * - 3 bundles = ₹896
 * - 4 bundles = ₹1152
 * 
 * @param bundles - Number of bundles (must be >= 1)
 * @returns Total price for the given number of bundles
 */
export function calculateBundlePrice(bundles: number): number {
  const validBundles = Math.max(1, Math.floor(bundles));
  return 384 + (validBundles - 1) * 256;
}

/**
 * Calculates the per-bundle unit price for a given quantity.
 * This is the average price per bundle considering the tiered discount.
 * 
 * @param bundles - Number of bundles
 * @returns Average price per bundle
 */
export function calculateUnitPrice(bundles: number): number {
  const validBundles = Math.max(1, Math.floor(bundles));
  const total = calculateBundlePrice(validBundles);
  return Math.round(total / validBundles);
}

/**
 * Formats a price for display with rupee symbol.
 * 
 * @param amount - Price in rupees
 * @param showDecimals - Whether to show decimal places (default: false)
 * @returns Formatted price string (e.g., "₹384")
 */
export function formatPrice(amount: number, showDecimals = false): string {
  if (showDecimals) {
    return `₹${amount.toFixed(2)}`;
  }
  return `₹${Math.round(amount)}`;
}

/**
 * Calculates the total weight in grams for a given number of bundles.
 * 
 * @param bundles - Number of bundles
 * @returns Total weight in grams
 */
export function calculateTotalWeight(bundles: number): number {
  const validBundles = Math.max(1, Math.floor(bundles));
  return validBundles * BUNDLE_CONFIG.BUNDLE_WEIGHT_GRAMS;
}

/**
 * Returns pricing tier information for display.
 * 
 * @returns Array of pricing tiers
 */
export function getPricingTiers() {
  return [
    { bundles: 1, price: 384, pricePerBundle: 384, savings: 0 },
    { bundles: 2, price: 640, pricePerBundle: 320, savings: 128 },
    { bundles: 3, price: 896, pricePerBundle: 299, savings: 256 },
    { bundles: 4, price: 1152, pricePerBundle: 288, savings: 384 },
  ];
}
