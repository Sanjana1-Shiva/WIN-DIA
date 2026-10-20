/**
 * DTDC shipping provider (Shipsy "softdata" customer-integration API).
 *
 * Request/response shapes come from public DTDC examples, NOT your official doc —
 * verify on the first test shipment. Everything environment-specific is an env var.
 *
 * ENV: DTDC_API_KEY, DTDC_CUSTOMER_CODE, DTDC_SERVICE_TYPE, DTDC_API_BASE_URL,
 *      DTDC_TRACKING_URL, DTDC_TRACKING_TOKEN, DTDC_COMMODITY_ID (optional),
 *      DTDC_ORIGIN_NAME, DTDC_ORIGIN_PHONE, DTDC_ORIGIN_ADDRESS_1, DTDC_ORIGIN_ADDRESS_2 (optional),
 *      DTDC_ORIGIN_PINCODE, DTDC_ORIGIN_CITY, DTDC_ORIGIN_STATE
 */
import type { CreateShipmentParams, ShipmentResult, TrackingResult } from './shiprocket';

const env = (name: string): string => (process.env[name] || '').trim();

function missingEnv(names: string[]): string | null {
  const missing = names.filter((n) => !env(n) || env(n).startsWith('REPLACE_ME'));
  return missing.length ? `DTDC is not configured. Missing: ${missing.join(', ')}` : null;
}

// Approximate package size (same as the old Shiprocket setup)
const LENGTH_CM = 25;
const WIDTH_CM = 20;
const HEIGHT_CM = 15;

function totalWeightKg(items: CreateShipmentParams['items']): number {
  // net_weight_grams is already the LINE total (per-packet grams x packets), so don't multiply by qty.
  const grams = items.reduce((sum, i) => sum + (Number(i.net_weight_grams) || 200), 0);
  return Math.max(0.5, grams / 1000);
}

export const dtdcProvider = {
  async createShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
    const configError = missingEnv([
      'DTDC_API_KEY', 'DTDC_CUSTOMER_CODE', 'DTDC_SERVICE_TYPE', 'DTDC_API_BASE_URL',
      'DTDC_ORIGIN_NAME', 'DTDC_ORIGIN_PHONE', 'DTDC_ORIGIN_ADDRESS_1',
      'DTDC_ORIGIN_PINCODE', 'DTDC_ORIGIN_CITY', 'DTDC_ORIGIN_STATE',
    ]);
    if (configError) return { success: false, error: configError };

    const addr: any = params.shippingAddress || {};
    const customerName = addr.name || addr.full_name || `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'Customer';
    const phone = String(addr.phone || '').replace(/\D/g, '').slice(-10);
    const weight = totalWeightKg(params.items);
    const isCod = params.paymentMethod === 'cod';
    const description = params.items.map((i) => i.name).join(', ').slice(0, 100) || 'Food items';

    const consignment: Record<string, unknown> = {
      customer_code: env('DTDC_CUSTOMER_CODE'),
      service_type_id: env('DTDC_SERVICE_TYPE'),
      load_type: 'NON-DOCUMENT',
      description,
      dimension_unit: 'cm',
      length: String(LENGTH_CM),
      width: String(WIDTH_CM),
      height: String(HEIGHT_CM),
      weight_unit: 'kg',
      weight: String(weight),
      declared_value: String(params.totalPrice),
      num_pieces: '1',
      customer_reference_number: params.orderNumber,
      reference_number: '',
      cod_amount: isCod ? String(params.totalPrice) : '0',
      cod_collection_mode: isCod ? 'Cash' : '',
      pieces_detail: [{
        description,
        declared_value: String(params.totalPrice),
        weight: String(weight),
        height: String(HEIGHT_CM),
        length: String(LENGTH_CM),
        width: String(WIDTH_CM),
      }],
      origin_details: {
        name: env('DTDC_ORIGIN_NAME'),
        phone: env('DTDC_ORIGIN_PHONE'),
        alternate_phone: env('DTDC_ORIGIN_PHONE'),
        address_line_1: env('DTDC_ORIGIN_ADDRESS_1'),
        address_line_2: env('DTDC_ORIGIN_ADDRESS_2'),
        pincode: env('DTDC_ORIGIN_PINCODE'),
        city: env('DTDC_ORIGIN_CITY'),
        state: env('DTDC_ORIGIN_STATE'),
      },
      destination_details: {
        name: customerName,
        phone,
        alternate_phone: phone,
        address_line_1: addr.address_line1 || addr.street || '',
        address_line_2: addr.address_line2 || '',
        pincode: String(addr.pincode || addr.postalCode || ''),
        city: addr.city || '',
        state: addr.state || '',
      },
    };
    if (env('DTDC_COMMODITY_ID')) consignment.commodity_id = env('DTDC_COMMODITY_ID');

    let res: Response;
    let data: any;
    try {
      res = await fetch(env('DTDC_API_BASE_URL'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env('DTDC_API_KEY') },
        body: JSON.stringify({ consignments: [consignment] }),
      });
      const text = await res.text();
      try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 200) }; }
    } catch (err: any) {
      return { success: false, error: `DTDC request failed: ${err?.message || 'network error'}` };
    }

    // Defensive parse: expected { data: [{ success, reference_number (= AWB), ... }] }.
    const first = Array.isArray(data?.data) ? data.data[0] : null;
    const awb: string | undefined = first?.reference_number || first?.awb_number || first?.awbNumber || undefined;

    if (!res.ok || !first || first.success === false || !awb) {
      return {
        success: false,
        error: first?.message || first?.reason || data?.message || data?.error || 'DTDC shipment creation failed',
        raw: data, // kept in shipments.raw_response so nothing is lost while we verify the format
      };
    }

    return {
      success: true,
      awbCode: String(awb),
      shipmentId: String(awb),
      courierName: 'DTDC',
      raw: data,
    };
  },

  async trackShipment(awbCode: string): Promise<TrackingResult> {
    const configError = missingEnv(['DTDC_TRACKING_URL', 'DTDC_TRACKING_TOKEN']);
    if (configError) return { success: false, error: configError };

    try {
      const res = await fetch(env('DTDC_TRACKING_URL'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': env('DTDC_TRACKING_TOKEN') },
        body: JSON.stringify({ trkType: 'cnno', strcnno: awbCode, addtnlDtl: 'Y' }),
      });
      const data: any = await res.json().catch(() => ({}));
      const details: any[] = Array.isArray(data?.trackDetails) ? data.trackDetails : [];

      if (!res.ok || (details.length === 0 && !data?.trackHeader)) {
        return { success: false, error: data?.statusDescription || data?.message || 'Tracking information not available' };
      }

      const history = details.map((d) => ({
        date: [d.strActionDate, d.strActionTime].filter(Boolean).join(' '),
        status: d.strAction || '',
        location: d.strOrigin || '',
      }));
      const status = data?.trackHeader?.strStatus || history[history.length - 1]?.status || '';
      return { success: true, status, history };
    } catch (err: any) {
      return { success: false, error: `DTDC tracking failed: ${err?.message || 'network error'}` };
    }
  },

  async cancelShipment(_awbCode: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'DTDC cancellation is not implemented yet' };
  },
};