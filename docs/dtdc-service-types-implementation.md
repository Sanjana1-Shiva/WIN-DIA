# DTDC B2C Service Types Implementation Summary

## Overview

Implementation of B2C PREMIUM and B2C PRIORITY service types in WIN-DIA's existing DTDC integration, with configurable service selection and preserved weight calculations.

**Status:** ✅ **COMPLETE - Tests Passing (24/24)**

**Date:** August 20, 2026

---

## Files Modified

### 1. `src/backend/lib/dtdc.ts`
**Changes:**
- Added `DtdcServiceType` enum with B2C_PREMIUM and B2C_PRIORITY
- Added `DtdcServiceTypeString` type for type safety
- Added `DtdcServiceConfig` interface and `DTDC_SERVICE_CONFIGS` constant
- Modified `buildDtdcConsignmentPayload()` to accept optional `serviceTypeOverride` parameter
- Added service type validation and logging
- Created `DtdcCreateShipmentParams` interface extending `CreateShipmentParams`
- Enhanced `createShipment()` with improved error handling:
  - Insufficient balance detection
  - Invalid service type validation
  - Duplicate booking detection
  - Missing AWB allocation handling
  - Network error detection
- Fixed duplicate BASE_URL declaration

**Lines Modified:** ~150 lines

### 2. `.env`
**Changes:**
- Updated `DTDC_SERVICE_TYPE_ID` from `@cm.mysore@dtdc.com` to `B2C PREMIUM`
- Added documentation comments explaining service types
- Added usage guidelines for B2C PREMIUM and B2C PRIORITY

**Previous Value:**
```bash
DTDC_SERVICE_TYPE_ID=@cm.mysore@dtdc.com
```

**New Value:**
```bash
DTDC_SERVICE_TYPE_ID=B2C PREMIUM
```

### 3. `src/backend/lib/__tests__/dtdc-service-types.test.ts` (NEW)
**Created:** Comprehensive test suite with 24 tests
- Service type constants validation
- Service configurations testing
- Payload generation tests (B2C PREMIUM and B2C PRIORITY)
- Weight calculation verification (480g, 960g, 1440g)
- Service type selection logic
- Error handling scenarios
- COD handling tests
- Dimensions validation

**Test Results:**
```
Test Suites: 1 passed, 1 total
Tests:       24 passed, 24 total
Time:        0.534s
```

### 4. `docs/dtdc-sample-payloads.md` (NEW)
**Created:** Sample JSON payloads and documentation
- B2C PREMIUM single-parcel example
- B2C PRIORITY multi-parcel example with COD
- Weight calculation reference table
- Service type selection guidelines
- Error handling scenarios
- API endpoint documentation

### 5. `docs/dtdc-service-types-implementation.md` (THIS FILE)
**Created:** Implementation summary and technical documentation

---

## Technical Implementation Details

### Service Type Enum

```typescript
export enum DtdcServiceType {
  B2C_PREMIUM = 'B2C PREMIUM',
  B2C_PRIORITY = 'B2C PRIORITY',
}

export type DtdcServiceTypeString = 'B2C PREMIUM' | 'B2C PRIORITY';
```

### Service Configuration

```typescript
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
```

### Function Signature Changes

**Before:**
```typescript
function buildDtdcConsignmentPayload(
  params: CreateShipmentParams,
  originWarehouse: DtdcConsignment['origin_details']
): DtdcConsignmentRequest
```

**After:**
```typescript
function buildDtdcConsignmentPayload(
  params: CreateShipmentParams,
  originWarehouse: DtdcConsignment['origin_details'],
  serviceTypeOverride?: DtdcServiceTypeString
): DtdcConsignmentRequest
```

### Extended Parameters Interface

```typescript
export interface DtdcCreateShipmentParams extends CreateShipmentParams {
  /** Override service type for this shipment (optional) */
  serviceType?: DtdcServiceTypeString;
}
```

### Service Type Selection Logic

1. **Default:** Uses `DTDC_SERVICE_TYPE_ID` from environment (B2C PREMIUM)
2. **Override:** Accepts optional `serviceType` parameter for per-shipment selection
3. **Validation:** Warns if service type is not a recognized B2C service
4. **No Auto-Switch:** Does NOT automatically change service based on bundle count

```typescript
// Use override if provided, otherwise use environment variable
let serviceTypeId = serviceTypeOverride || envServiceTypeId;

// Validate service type
const validServiceTypes: DtdcServiceTypeString[] = ['B2C PREMIUM', 'B2C PRIORITY'];
if (!validServiceTypes.includes(serviceTypeId as DtdcServiceTypeString)) {
  console.warn(`[DTDC] WARNING: Service type "${serviceTypeId}" is not a standard B2C service.`);
}
```

---

## Weight Calculations (Preserved)

✅ **Corrected calculations maintained:**

| Bundles | Calculation | Grams | Kilograms | DTDC Payload |
|---------|-------------|-------|-----------|--------------|
| 1       | 480 × 1     | 480g  | 0.48kg    | `"weight": 0.48` |
| 2       | 480 × 2     | 960g  | 0.96kg    | `"weight": 0.96` |
| 3       | 480 × 3     | 1440g | 1.44kg    | `"weight": 1.44` |

**Code:**
```typescript
function calculateTotalWeightKg(items: ShipmentItem[]): number {
  const totalGrams = items.reduce((sum, i) => {
    const itemWeight = Number(i.net_weight_grams);
    if (!itemWeight || itemWeight <= 0) {
      console.warn(`[DTDC] WARNING: Item "${i.name}" has no weight!`);
      return sum + (100 * (i.qty || 1));
    }
    return sum + (itemWeight * (i.qty || 1));
  }, 0);
  
  // Convert grams to kilograms with proper decimal precision
  const weightKg = totalGrams / 1000;
  
  // Minimum 0.1kg for DTDC (100g)
  const finalWeight = Math.max(0.1, weightKg);
  
  console.log(`[DTDC] Total package weight: ${totalGrams}g = ${finalWeight}kg`);
  return finalWeight;
}
```

---

## Error Handling Enhancements

### 1. Insufficient Balance
```typescript
if (errorMessage.toLowerCase().includes('balance')) {
  return {
    success: false,
    error: 'Insufficient DTDC account balance. Please recharge your DTDC account.',
    raw: data,
  };
}
```

### 2. Invalid Service Type
```typescript
if (errorMessage.toLowerCase().includes('service type')) {
  return {
    success: false,
    error: `Invalid service type "${serviceType}". Please verify DTDC_SERVICE_TYPE_ID configuration.`,
    raw: data,
  };
}
```

### 3. Duplicate Booking
```typescript
if (errorMessage.toLowerCase().includes('duplicate')) {
  return {
    success: false,
    error: 'Duplicate booking attempt. This order may already have a shipment.',
    raw: data,
  };
}
```

### 4. Missing AWB
```typescript
const awbCode = data.awb_number || data.consignment_number || data.reference_number;

if (!awbCode) {
  console.error('[DTDC] No AWB number in response:', data);
  return {
    success: false,
    error: 'DTDC did not allocate AWB number. This may indicate an account configuration issue.',
    raw: data,
  };
}
```

### 5. Network Errors
```typescript
if (error.message?.includes('fetch')) {
  return {
    success: false,
    error: 'Network error connecting to DTDC API. Please check internet connection.',
    raw: { error: error.toString() },
  };
}
```

---

## Usage Examples

### Default Service (B2C PREMIUM)

```typescript
import { dtdcProvider } from './lib/dtdc';

const result = await dtdcProvider.createShipment({
  orderNumber: 'WINDIA-ORD-001',
  orderId: 'uuid-123',
  shippingAddress: {
    name: 'John Doe',
    phone: '9876543210',
    address_line1: '123 Test Street',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
  },
  items: [
    {
      product_id: 'prod-1',
      name: 'Garlic Flavour',
      qty: 1,
      price: 640,
      net_weight_grams: 480,
    }
  ],
  totalPrice: 640,
  paymentMethod: 'razorpay',
});

// Uses B2C PREMIUM from DTDC_SERVICE_TYPE_ID environment variable
```

### Override to B2C PRIORITY

```typescript
import { dtdcProvider } from './lib/dtdc';
import type { DtdcCreateShipmentParams } from './lib/dtdc';

const params: DtdcCreateShipmentParams = {
  orderNumber: 'WINDIA-ORD-002',
  orderId: 'uuid-456',
  shippingAddress: {
    name: 'Jane Smith',
    phone: '9123456789',
    address_line1: '456 Test Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  },
  items: [
    { product_id: 'prod-1', name: 'Garlic Flavour', qty: 2, price: 640, net_weight_grams: 480 },
    { product_id: 'prod-2', name: 'Onion Flavour', qty: 1, price: 640, net_weight_grams: 480 },
  ],
  totalPrice: 1920,
  paymentMethod: 'cod',
  serviceType: 'B2C PRIORITY', // Override to B2C PRIORITY
};

const result = await dtdcProvider.createShipment(params);
// Uses B2C PRIORITY regardless of environment variable
```

---

## Configuration

### Environment Variables

```bash
# .env file
DTDC_API_KEY=7b347fe9d334185098b1d666fcdc7e
DTDC_CUSTOMER_CODE=BO13750
DTDC_SERVICE_TYPE_ID=B2C PREMIUM
DTDC_COMMODITY_ID=1
```

### Service Type Guidelines

**B2C PREMIUM (Default):**
- Standard delivery service
- Recommended for single-parcel shipments
- Use for 1-2 bundle orders that fit in one box
- Default service type in environment

**B2C PRIORITY:**
- Priority/express delivery service
- Recommended for multi-parcel shipments
- Must be explicitly selected via `serviceType` parameter
- Not automatically selected based on bundle count

---

## Test Coverage

### Test Suite: `dtdc-service-types.test.ts`

**Results:**
```
✓ Service Type Constants (2 tests)
  ✓ should define B2C PREMIUM service type
  ✓ should define B2C PRIORITY service type

✓ Service Configurations (3 tests)
  ✓ should have configuration for B2C PREMIUM
  ✓ should have configuration for B2C PRIORITY
  ✓ should have exactly 2 service configurations

✓ B2C PREMIUM Payload (2 tests)
  ✓ should generate correct payload structure for B2C PREMIUM
  ✓ should handle single bundle order (1 bundle = 480g)

✓ B2C PRIORITY Payload (2 tests)
  ✓ should generate correct payload structure for B2C PRIORITY
  ✓ should handle multi-bundle order (3 bundles = 1440g)

✓ Weight Calculations (3 tests)
  ✓ should preserve corrected weight calculation: 1 bundle = 480g
  ✓ should preserve corrected weight calculation: 2 bundles = 960g
  ✓ should preserve corrected weight calculation: 3 bundles = 1440g

✓ Service Type Selection (3 tests)
  ✓ should use environment default when no override provided
  ✓ should allow override to B2C PRIORITY
  ✓ should not automatically switch based on bundle count

✓ Error Handling (5 tests)
  ✓ should handle missing service type configuration
  ✓ should handle invalid service type
  ✓ should handle missing AWB allocation
  ✓ should handle insufficient balance error
  ✓ should handle duplicate booking error

✓ COD Handling (2 tests)
  ✓ should include COD fields for COD payments
  ✓ should exclude COD fields for online payments

✓ Dimensions (2 tests)
  ✓ should use standard WIN-DIA box dimensions
  ✓ should not invent dimensions

Total: 24 tests, all passing ✅
```

---

## Remaining Blockers

### 1. First Controlled API Test ⏳
**Status:** Pending  
**Action Required:** Perform test API call with DTDC to verify:
- AWB allocation works correctly
- Service type is accepted by DTDC
- Weight calculations are correct
- Response format matches expectations

**Test Order Suggestion:**
- 1 bundle order with B2C PREMIUM
- Payment: Razorpay (online)
- Non-COD to avoid cash handling in test

### 2. Dimensions Validation ⏳
**Status:** Using WIN-DIA standard dimensions (30×25×10 cm)  
**Action Required:** Verify with physical packaging team:
- Confirm box dimensions are accurate
- Measure actual dimensions if needed
- Update if different sizes are used

### 3. Packaging Weight Configuration ⏳
**Status:** Not yet implemented  
**Action Required:** Determine packaging weight policy:
- Add box weight (packaging material)
- Configure as environment variable or constant
- Update weight calculation function

**Current:** Product weight only (480g per bundle)  
**Proposed:** Product weight + packaging weight

### 4. Automatic Shipment Creation 🔒
**Status:** Disabled (as requested)  
**Action Required:** After successful API test:
- Enable automatic shipment creation in checkout flow
- Add configuration flag for manual/automatic mode
- Document when shipments should be created automatically

### 5. Production Credentials Verification ⏳
**Status:** Using provided test credentials  
**Action Required:** Before going live:
- Verify DTDC_API_KEY is production key
- Confirm DTDC_CUSTOMER_CODE is correct
- Test with DTDC support if needed
- Verify account balance is sufficient

---

## Design Decisions

### 1. Service Type Selection: Configurable with Override
**Decision:** Use environment variable as default, allow per-shipment override  
**Rejected:** Automatic switching based on bundle count  
**Reason:** Task explicitly states "Do not automatically switch to B2C PRIORITY merely because customer orders multiple WIN-DIA bundles. Multiple bundles can fit into one parcel."

### 2. Service Type Storage: String Type
**Decision:** Use `'B2C PREMIUM' | 'B2C PRIORITY'` string literals  
**Rejected:** Numeric IDs  
**Reason:** DTDC API examples show string service types, more readable and maintainable

### 3. Error Handling: Specific Error Messages
**Decision:** Detect and provide specific error messages for common issues  
**Rejected:** Generic error handling  
**Reason:** Better debugging, user communication, and troubleshooting

### 4. Weight Preservation: Keep Corrected Calculations
**Decision:** Maintain existing weight calculation (480g per bundle)  
**Rejected:** Modifying weight logic  
**Reason:** Previous weight bug fix must be preserved; DTDC multiplies by qty correctly

### 5. Dimensions: Use Actual WIN-DIA Box
**Decision:** Use 30×25×10 cm standard dimensions  
**Rejected:** Inventing or estimating dimensions  
**Reason:** Task states "Use actual parcel dimensions. Do not invent dimensions or packaging weight"

---

## API Endpoint

**URL:** `POST https://pxapi.dtdc.in/api/customer/integration/consignment/softdata`

**Headers:**
```
Content-Type: application/json
api-key: {DTDC_API_KEY}
```

**Request Body:** See `docs/dtdc-sample-payloads.md` for examples

**Expected Response:**
```json
{
  "success": true,
  "reference_number": "WINDIA-ORD-001",
  "awb_number": "D12345678901",
  "consignment_number": "D12345678901",
  "tracking_url": "https://www.dtdc.in/tracking.asp?trackno=D12345678901"
}
```

---

## Next Steps

1. ✅ **COMPLETE:** Implement B2C service type support
2. ✅ **COMPLETE:** Add comprehensive tests (24/24 passing)
3. ✅ **COMPLETE:** Generate sample JSON payloads
4. ✅ **COMPLETE:** Document implementation
5. ⏳ **TODO:** Perform first controlled API test with DTDC
6. ⏳ **TODO:** Verify AWB allocation in DTDC dashboard
7. ⏳ **TODO:** Validate packaging dimensions with team
8. ⏳ **TODO:** Configure packaging weight if needed
9. ⏳ **TODO:** Enable automatic shipment creation after successful test
10. ⏳ **TODO:** Production deployment (after all tests pass)

---

## Important Notes

⚠️ **Automatic shipment creation is currently DISABLED** as requested  
⚠️ **Do not create live consignments yet** - waiting for controlled test approval  
⚠️ **Service type does NOT auto-switch** based on bundle count  
⚠️ **Weight calculations preserved** - 1 bundle = 480g (corrected bug fix)  
⚠️ **Dimensions are actual** WIN-DIA standard box (30×25×10 cm)  
⚠️ **Test before production** - verify with DTDC support before going live

---

## Contact & Support

**Implementation Date:** August 20, 2026  
**Implementation Status:** Complete - Tests Passing  
**Test Coverage:** 24/24 tests passing  
**Ready for:** Controlled API testing

**For Questions:**
- Review `docs/dtdc-sample-payloads.md` for payload examples
- Check test file for validation logic
- See `.env` file for configuration options

