/**
 * Shipping Provider Module
 * ────────────────────────
 * WIN-DIA uses DTDC as the shipping provider.
 * 
 * This module exports the DTDC provider for use throughout the application.
 */

import { dtdcProvider } from './dtdc';
import type { ShippingProvider } from './shipping-types';

/**
 * Get the active shipping provider (DTDC)
 * @returns DTDC shipping provider instance
 */
export function getShippingProvider(): ShippingProvider {
  return dtdcProvider;
}

// Export types for convenience
export type {
  ShipmentResult,
  TrackingResult,
  ShippingAddress,
  ShipmentItem,
  CreateShipmentParams,
  ShippingProvider,
} from './shipping-types';
