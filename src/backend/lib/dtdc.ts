/**
 * DTDC Shipping Integration
 * ──────────────────────────
 * Server-to-server API integration using API key authentication.
 * 
 * API Docs: DTDC Customer Integration API
 * Base URL: https://pxapi.dtdc.in/api/customer/integration
 * 
 * ENV vars required:
 *   DTDC_API_KEY           - API authentication key
 *   DTDC_CUSTOMER_CODE     - Customer account code
 *   DTDC_SERVICE_TYPE_ID   - Service type ID (B2C PREMIUM, B2C PRIORITY, etc.)
 *   DTDC_COMMODITY_ID      - Commodity type ID for product classification
 * 
 * Packaging configuration (REQUIRED for live shipments):
 *   DTDC_PACKAGING_LENGTH_CM      - Verified box length in cm
 *   DTDC_PACKAGING_WIDTH_CM       - Verified box width in cm
 *   DTDC_PACKAGING_HEIGHT_CM      - Verified box height in cm
 *   DTDC_PACKAGING_WEIGHT_GRAMS   - Verified empty box weight in grams
 *   DTDC_PACKAGING_VERIFIED       - Set to "true" after physical measurements
 * 
 * Supported Service Types:
 *   - B2C PREMIUM: Standard single-parcel service
 *   - B2C PRIORITY: Priority/multi-parcel service
 */

// Import shared types
import type {
  ShipmentResult,
  TrackingResult,
  ShippingAddress,
  ShipmentItem,
  CreateShipmentParams,
  ShippingProvider,
} from './shipping-types';

const BASE_URL = 'https://pxapi.dtdc.in/api/customer/integration';

// ── DTDC Service Types ───────────────────────────────────────────────────────

export enum DtdcServiceType {
  B2C_PREMIUM = 'B2C PREMIUM',
  B2C_PRIORITY = 'B2C PRIORITY',
}

export type DtdcServiceTypeString = 'B2C PREMIUM' | 'B2C PRIORITY';

/**
 * Configuration for DTDC service types
 */
export interface DtdcServiceConfig {
  serviceType: DtdcServiceTypeString;
  description: string;
  recommendedFor: string;
}

export const DTDC_SERVICE_CONFIGS: Record<DtdcServiceTypeString, DtdcServiceConfig> = {
  'B2C PREMIUM': {
    serviceType: 'B2C PREMIUM',
    description: 'Standard B2C service for single-parcel shipments',
    recommendedFor: 'Single parcel deliveries',
  },
  'B2C PRIORITY': {
    serviceType: 'B2C PRIORITY',
    description: 'Priority B2C service for multi-parcel or urgent shipments',
    recommendedFor: 'Multi-parcel or priority deliveries',
  },
};

// ── Packaging Configuration ──────────────────────────────────────────────────

/**
 * Packaging dimensions in centimeters
 */
export interface PackagingDimensions {
  length: number;  // cm
  width: number;   // cm
  height: number;  // cm
}

/**
 * Placeholder dimensions for LOCAL TESTING ONLY
 * These are NOT verified WIN-DIA packaging specifications
 */
export const PLACEHOLDER_DIMENSIONS: PackagingDimensions = {
  length: 30,  // cm - PLACEHOLDER, NOT VERIFIED
  width: 25,   // cm - PLACEHOLDER, NOT VERIFIED
  height: 10,  // cm - PLACEHOLDER, NOT VERIFIED
};

/**
 * Get packaging configuration from environment
 * Returns verified dimensions if DTDC_PACKAGING_VERIFIED=true
 * Returns placeholder dimensions for testing if not verified
 */
function getPackagingConfig(): {
  dimensions: PackagingDimensions;
  weightGrams: number;
  isVerified: boolean;
} {
  const isVerified = process.env.DTDC_PACKAGING_VERIFIED === 'true';
  
  if (isVerified) {
    // Use verified measurements from environment
    const length = Number(process.env.DTDC_PACKAGING_LENGTH_CM);
    const width = Number(process.env.DTDC_PACKAGING_WIDTH_CM);
    const height = Number(process.env.DTDC_PACKAGING_HEIGHT_CM);
    const weightGrams = Number(process.env.DTDC_PACKAGING_WEIGHT_GRAMS) || 0;
    
    if (!length || !width || !height) {
      throw new Error(
        'DTDC_PACKAGING_VERIFIED is true but dimensions are not configured. ' +
        'Set DTDC_PACKAGING_LENGTH_CM, DTDC_PACKAGING_WIDTH_CM, DTDC_PACKAGING_HEIGHT_CM'
      );
    }
    
    return {
      dimensions: { length, width, height },
      weightGrams,
      isVerified: true,
    };
  }
  
  // Use placeholder dimensions for testing
  return {
    dimensions: PLACEHOLDER_DIMENSIONS,
    weightGrams: 0,  // No packaging weight for testing
    isVerified: false,
  };
}

/**
 * Validate that packaging is configured for live shipments
 * Throws error if trying to create live shipment with unverified packaging
 */
function validatePackagingForLiveShipment(): void {
  const config = getPackagingConfig();
  
  if (!config.isVerified) {
    throw new Error(
      'LIVE DTDC SHIPMENT BLOCKED: Packaging dimensions and weight have not been verified. ' +
      'Measure the physical WIN-DIA shipping box and configure: ' +
      'DTDC_PACKAGING_LENGTH_CM, DTDC_PACKAGING_WIDTH_CM, DTDC_PACKAGING_HEIGHT_CM, ' +
      'DTDC_PACKAGING_WEIGHT_GRAMS, and set DTDC_PACKAGING_VERIFIED=true'
    );
  }
  
  console.log('[DTDC] ✓ Packaging verified:', config.dimensions);
}

// ── DTDC-specific Types ──────────────────────────────────────────────────────

/**
 * DTDC Consignment Request (single consignment object)
 * Must be wrapped in { consignments: [consignment] } for API call
 */
interface DtdcConsignment {
  customer_code: string;
  service_type_id: string;
  load_type: 'NON-DOCUMENT' | 'DOCUMENT';
  consignment_type: 'Forward' | 'Reverse';
  description: string;
  dimension_unit: 'cm' | 'in';
  length: string | number;
  width: string | number;
  height: string | number;
  weight_unit: 'kg' | 'g';
  weight: string | number;
  declared_value: string | number;
  num_pieces: string | number;
  origin_details: {
    name: string;
    phone: string;
    alternate_phone?: string;
    address_line_1: string;
    address_line_2?: string;
    pincode: string;
    city: string;
    state: string;
  };
  destination_details: {
    name: string;
    phone: string;
    alternate_phone?: string;
    address_line_1: string;
    address_line_2?: string;
    pincode: string;
    city: string;
    state: string;
  };
  return_details?: {
    name: string;
    phone: string;
    address_line_1: string;
    address_line_2?: string;
    pincode: string;
    city: string;
    state: string;
  };
  customer_reference_number: string;
  cod_collection_mode?: 'Cash' | 'Cheque';
  cod_amount?: string | number;
  commodity_id: string;
  invoice_number?: string;
  invoice_date?: string;
  reference_number: string;
}

/**
 * DTDC API Request Wrapper
 */
interface DtdcConsignmentRequest {
  consignments: DtdcConsignment[];
}

interface DtdcConsignmentResponse {
  success: boolean;
  reference_number?: string;
  consignment_number?: string;
  awb_number?: string;
  tracking_url?: string;
  message?: string;
  errors?: any;
  data?: any;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function resolveCustomerName(addr: ShippingAddress): string {
  return (
    addr.name ||
    addr.full_name ||
    `${addr.firstName || ''} ${addr.lastName || ''}`.trim() ||
    'Customer'
  );
}

function calculateTotalWeightKg(items: ShipmentItem[]): number {
  // Calculate product weight
  const totalProductGrams = items.reduce((sum, i) => {
    const itemWeight = Number(i.net_weight_grams);
    if (!itemWeight || itemWeight <= 0) {
      console.warn(`[DTDC] WARNING: Item "${i.name}" has no weight! Using minimum 100g per item.`);
      return sum + (100 * (i.qty || 1));
    }
    return sum + (itemWeight * (i.qty || 1));
  }, 0);
  
  // Add packaging weight if configured
  const packagingConfig = getPackagingConfig();
  const packagingGrams = packagingConfig.weightGrams;
  
  const totalGrams = totalProductGrams + packagingGrams;
  
  // Convert grams to kilograms with proper decimal precision
  // Example: 480g → 0.48kg, not 480kg
  const weightKg = totalGrams / 1000;
  
  // Minimum 0.1kg for DTDC (100g)
  const finalWeight = Math.max(0.1, weightKg);
  
  if (packagingGrams > 0) {
    console.log(`[DTDC] Product weight: ${totalProductGrams}g + Packaging: ${packagingGrams}g = Total: ${totalGrams}g (${finalWeight}kg)`);
  } else {
    console.log(`[DTDC] Total package weight: ${totalGrams}g = ${finalWeight}kg (no packaging weight configured)`);
  }
  
  return finalWeight;
}

function buildDtdcConsignmentPayload(
  params: CreateShipmentParams,
  originWarehouse: DtdcConsignment['origin_details'],
  serviceTypeOverride?: DtdcServiceTypeString
): DtdcConsignmentRequest {
  const { orderNumber, shippingAddress: addr, items, totalPrice, paymentMethod } = params;
  
  const customerName = resolveCustomerName(addr);
  const phone = String(addr.phone || '').replace(/\D/g, '');
  const address1 = addr.address_line1 || addr.street || '';
  const address2 = addr.address_line2 || '';
  const city = addr.city || '';
  const state = addr.state || '';
  const pincode = String(addr.pincode || addr.postalCode || '');
  
  const isCOD = paymentMethod === 'cod';
  const weight = calculateTotalWeightKg(items);
  
  // Get packaging dimensions from configuration
  const packagingConfig = getPackagingConfig();
  const dimensions = packagingConfig.dimensions;
  
  if (!packagingConfig.isVerified) {
    console.warn('[DTDC] WARNING: Using PLACEHOLDER dimensions for testing. NOT verified WIN-DIA packaging.');
  }
  
  // Total pieces = sum of all item quantities
  const numPieces = items.reduce((sum, item) => sum + (item.qty || 1), 0);
  
  // Get DTDC-specific config from environment
  const customerCode = process.env.DTDC_CUSTOMER_CODE || '';
  const envServiceTypeId = process.env.DTDC_SERVICE_TYPE_ID || '';
  const commodityId = process.env.DTDC_COMMODITY_ID || '';
  
  // Use override if provided, otherwise use environment variable
  let serviceTypeId = serviceTypeOverride || envServiceTypeId;
  
  // Validate service type
  if (!serviceTypeId) {
    throw new Error('DTDC_SERVICE_TYPE_ID is not configured in environment variables');
  }
  
  // Validate it's a supported service type
  const validServiceTypes: DtdcServiceTypeString[] = ['B2C PREMIUM', 'B2C PRIORITY'];
  if (!validServiceTypes.includes(serviceTypeId as DtdcServiceTypeString)) {
    console.warn(`[DTDC] WARNING: Service type "${serviceTypeId}" is not a standard B2C service. Using as-is.`);
  }
  
  if (!customerCode) {
    throw new Error('DTDC_CUSTOMER_CODE is not configured in environment variables');
  }
  
  if (!commodityId) {
    console.warn('[DTDC] WARNING: DTDC_COMMODITY_ID not set, using default "1"');
  }
  
  console.log(`[DTDC] Using service type: ${serviceTypeId}`);
  
  // Generate invoice date (current date in YYYY-MM-DD format)
  const invoiceDate = new Date().toISOString().split('T')[0];
  
  const consignment: DtdcConsignment = {
    customer_code: customerCode,
    service_type_id: serviceTypeId,
    load_type: 'NON-DOCUMENT',
    consignment_type: 'Forward',
    description: 'WIN-DIA Food Products',
    dimension_unit: 'cm',
    length: dimensions.length,
    width: dimensions.width,
    height: dimensions.height,
    weight_unit: 'kg',
    weight: weight,
    declared_value: totalPrice,
    num_pieces: numPieces,
    
    origin_details: originWarehouse,
    
    destination_details: {
      name: customerName,
      phone: phone,
      address_line_1: address1,
      address_line_2: address2 || undefined,
      pincode: pincode,
      city: city,
      state: state,
    },
    
    return_details: originWarehouse,
    
    customer_reference_number: orderNumber,
    
    // COD fields (only if COD payment method)
    ...(isCOD && {
      cod_collection_mode: 'Cash' as const,
      cod_amount: totalPrice,
    }),
    
    commodity_id: commodityId || '1',
    invoice_number: orderNumber,
    invoice_date: invoiceDate,
    reference_number: orderNumber,
  };
  
  // Wrap in consignments array as required by DTDC API
  return {
    consignments: [consignment],
  };
}

// ── DTDC API Client ──────────────────────────────────────────────────────────

async function dtdcFetch(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const apiKey = process.env.DTDC_API_KEY;
  
  if (!apiKey || apiKey.startsWith('REPLACE_ME')) {
    throw new Error('DTDC_API_KEY is not configured. Set DTDC_API_KEY in your .env file.');
  }
  
  const url = `${BASE_URL}${path}`;
  console.log(`[DTDC] API Request: ${options.method || 'GET'} ${url}`);
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      ...(options.headers || {}),
    },
  });
  
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { success: false, message: text.slice(0, 200) };
  }
  
  console.log(`[DTDC] API Response: ${res.status}`, data);
  
  return { ok: res.ok, status: res.status, data };
}

// ── Warehouse Configuration ──────────────────────────────────────────────────

/**
 * Get WIN-DIA warehouse/origin details for DTDC shipments from environment variables
 * This should match the pickup location configured in DTDC account
 * 
 * Required environment variables:
 * - DTDC_CONSIGNOR_NAME: Business/person name
 * - DTDC_CONSIGNOR_ADDRESS: Full address line 1
 * - DTDC_CONSIGNOR_CITY: City name
 * - DTDC_CONSIGNOR_STATE: State name
 * - DTDC_CONSIGNOR_PIN: PIN code (6 digits)
 * - DTDC_CONSIGNOR_PHONE: 10-digit phone number
 * - DTDC_CONSIGNOR_EMAIL: Contact email
 */
function getOriginWarehouse(): DtdcConsignment['origin_details'] {
  const name = process.env.DTDC_CONSIGNOR_NAME;
  const address1 = process.env.DTDC_CONSIGNOR_ADDRESS;
  const city = process.env.DTDC_CONSIGNOR_CITY;
  const state = process.env.DTDC_CONSIGNOR_STATE;
  const pincode = process.env.DTDC_CONSIGNOR_PIN;
  const phone = process.env.DTDC_CONSIGNOR_PHONE;
  const email = process.env.DTDC_CONSIGNOR_EMAIL;

  // Validate required fields
  const missingFields: string[] = [];
  if (!name) missingFields.push('DTDC_CONSIGNOR_NAME');
  if (!address1) missingFields.push('DTDC_CONSIGNOR_ADDRESS');
  if (!city) missingFields.push('DTDC_CONSIGNOR_CITY');
  if (!state) missingFields.push('DTDC_CONSIGNOR_STATE');
  if (!pincode) missingFields.push('DTDC_CONSIGNOR_PIN');
  if (!phone) missingFields.push('DTDC_CONSIGNOR_PHONE');
  if (!email) missingFields.push('DTDC_CONSIGNOR_EMAIL');

  if (missingFields.length > 0) {
    throw new Error(
      `DTDC consignor configuration incomplete. Missing environment variables: ${missingFields.join(', ')}. ` +
      'Please configure these in your .env file before creating shipments.'
    );
  }

  // Validate phone number format (should be 10 digits)
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length !== 10) {
    console.warn(`[DTDC] DTDC_CONSIGNOR_PHONE should be 10 digits. Current: ${phone}`);
  }

  // Validate pincode format (should be 6 digits)
  if (!/^\d{6}$/.test(pincode)) {
    console.warn(`[DTDC] DTDC_CONSIGNOR_PIN should be 6 digits. Current: ${pincode}`);
  }

  console.log('[DTDC] Using consignor details from environment:', {
    name,
    city,
    state,
    pincode,
    phone: phoneDigits,
  });

  return {
    name,
    phone: phoneDigits,
    address_line_1: address1,
    address_line_2: undefined, // Optional - could add DTDC_CONSIGNOR_ADDRESS_LINE2 if needed
    pincode,
    city,
    state,
  };
}

// ── DTDC Provider Implementation ─────────────────────────────────────────────

/**
 * Extended CreateShipmentParams with DTDC-specific options
 */
export interface DtdcCreateShipmentParams extends CreateShipmentParams {
  /** Override service type for this shipment (optional) */
  serviceType?: DtdcServiceTypeString;
}

export const dtdcProvider: ShippingProvider = {
  /**
   * Creates a shipment on DTDC and returns AWB/tracking information
   * IMPORTANT: Validates packaging configuration before live API calls
   */
  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    try {
      // SAFETY CHECK: Validate packaging configuration for live shipments
      // This blocks shipment creation if dimensions/weight are not verified
      validatePackagingForLiveShipment();
      
      const dtdcParams = params as DtdcCreateShipmentParams;
      const originWarehouse = getOriginWarehouse();
      const requestPayload = buildDtdcConsignmentPayload(
        params,
        originWarehouse,
        dtdcParams.serviceType
      );
      
      const serviceType = dtdcParams.serviceType || process.env.DTDC_SERVICE_TYPE_ID || 'B2C PREMIUM';
      
      console.log('[DTDC] Creating shipment for order:', params.orderNumber);
      console.log('[DTDC] Service type:', serviceType);
      console.log('[DTDC] Request payload structure:', {
        consignments_count: requestPayload.consignments.length,
        service_type_id: requestPayload.consignments[0].service_type_id,
        weight_kg: requestPayload.consignments[0].weight,
        weight_unit: requestPayload.consignments[0].weight_unit,
        num_pieces: requestPayload.consignments[0].num_pieces,
        dimensions: `${requestPayload.consignments[0].length}×${requestPayload.consignments[0].width}×${requestPayload.consignments[0].height}cm`,
        cod: requestPayload.consignments[0].cod_amount ? 'Yes' : 'No',
      });
      
      const response = await dtdcFetch('/consignment/softdata', {
        method: 'POST',
        body: JSON.stringify(requestPayload),
      });
      
      const data: DtdcConsignmentResponse = response.data;
      
      if (!response.ok || !data.success) {
        const errorMessage = data.message || data.errors?.toString() || 'DTDC shipment creation failed';
        console.error('[DTDC] Shipment creation failed:', errorMessage);
        
        // Provide specific error messages for common issues
        if (errorMessage.toLowerCase().includes('balance')) {
          return {
            success: false,
            error: 'Insufficient DTDC account balance. Please recharge your DTDC account.',
            raw: data,
          };
        }
        if (errorMessage.toLowerCase().includes('service type')) {
          return {
            success: false,
            error: `Invalid service type "${serviceType}". Please verify DTDC_SERVICE_TYPE_ID configuration.`,
            raw: data,
          };
        }
        if (errorMessage.toLowerCase().includes('duplicate')) {
          return {
            success: false,
            error: 'Duplicate booking attempt. This order may already have a shipment.',
            raw: data,
          };
        }
        
        return {
          success: false,
          error: errorMessage,
          raw: data,
        };
      }
      
      // Map DTDC response to internal ShipmentResult format
      // AWB can be in: awb_number, consignment_number, or reference_number
      const awbCode = data.awb_number || data.consignment_number || data.reference_number;
      
      if (!awbCode) {
        console.error('[DTDC] No AWB number in response:', data);
        return {
          success: false,
          error: 'DTDC did not allocate AWB number. This may indicate an account configuration issue.',
          raw: data,
        };
      }
      
      const trackingUrl = data.tracking_url || (awbCode ? `https://www.dtdc.in/tracking.asp?trackno=${awbCode}` : undefined);
      
      console.log('[DTDC] Shipment created successfully:', {
        awb: awbCode,
        reference: data.reference_number,
        service_type: serviceType,
      });
      
      return {
        success: true,
        awbCode: awbCode,
        shipmentId: data.reference_number || awbCode,
        orderId: params.orderNumber,
        courierName: 'DTDC',
        trackingUrl: trackingUrl,
        raw: data,
      };
      
    } catch (error: any) {
      console.error('[DTDC] Shipment creation error:', error);
      
      // Network/fetch errors
      if (error.message?.includes('fetch')) {
        return {
          success: false,
          error: 'Network error connecting to DTDC API. Please check internet connection.',
          raw: { error: error.toString() },
        };
      }
      
      return {
        success: false,
        error: error.message || 'DTDC API request failed',
        raw: { error: error.toString() },
      };
    }
  },
  
  /**
   * Track a shipment by AWB/consignment number
   * Note: DTDC tracking API endpoint details needed from documentation
   */
  async trackShipment(awbCodeOrConsignmentNumber: string): Promise<TrackingResult> {
    try {
      console.log('[DTDC] Tracking shipment:', awbCodeOrConsignmentNumber);
      
      // TODO: Implement once DTDC tracking API endpoint is confirmed
      // Expected endpoint: GET /consignment/track/{awb} or similar
      
      console.warn('[DTDC] Tracking API not yet implemented - DTDC tracking endpoint needed');
      
      return {
        success: false,
        error: 'DTDC tracking API endpoint not yet configured. Please refer to DTDC API documentation for tracking endpoint details.',
      };
      
    } catch (error: any) {
      console.error('[DTDC] Tracking error:', error);
      return {
        success: false,
        error: error.message || 'DTDC tracking request failed',
      };
    }
  },
  
  /**
   * Cancel a shipment on DTDC
   * Note: DTDC cancellation API endpoint details needed from documentation
   */
  async cancelShipment(dtdcReferenceNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[DTDC] Cancelling shipment:', dtdcReferenceNumber);
      
      // TODO: Implement once DTDC cancellation API endpoint is confirmed
      // Expected endpoint: POST /consignment/cancel or similar
      
      console.warn('[DTDC] Cancellation API not yet implemented - DTDC cancellation endpoint needed');
      
      return {
        success: false,
        error: 'DTDC cancellation API endpoint not yet configured. Please refer to DTDC API documentation for cancellation endpoint details.',
      };
      
    } catch (error: any) {
      console.error('[DTDC] Cancellation error:', error);
      return {
        success: false,
        error: error.message || 'DTDC cancellation request failed',
      };
    }
  },
};
