/**
 * Shared Shipping Provider Types
 * ───────────────────────────────
 * Common types used by shipping providers (DTDC)
 */

export interface ShipmentResult {
  success: boolean;
  awbCode?: string;
  shipmentId?: string;
  orderId?: string;
  courierName?: string;
  trackingUrl?: string;
  error?: string;
  raw?: any;
}

export interface TrackingResult {
  success: boolean;
  status?: string;
  history?: Array<{ date: string; status: string; location?: string }>;
  error?: string;
}

export interface ShippingAddress {
  name?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  postalCode?: string;
  email?: string;
  country?: string;
}

export interface ShipmentItem {
  name: string;
  qty: number;
  price: number;
  product_id?: string;
  sku?: string;
  net_weight_grams?: number;
}

export interface CreateShipmentParams {
  orderId: string;
  orderNumber: string;
  shippingAddress: ShippingAddress;
  items: ShipmentItem[];
  totalPrice: number;
  paymentMethod: string;
}

/**
 * Shipping Provider Interface
 * All shipping providers must implement this interface
 */
export interface ShippingProvider {
  createShipment(params: CreateShipmentParams): Promise<ShipmentResult>;
  trackShipment(awbCode: string): Promise<TrackingResult>;
  cancelShipment(referenceNumber: string): Promise<{ success: boolean; error?: string }>;
}
