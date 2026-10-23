# DTDC Packaging Configuration

## Overview

WIN-DIA DTDC integration now uses **configurable packaging dimensions** with safety checks to prevent live shipment creation until physical measurements are verified.

**Status:** ✅ **IMPLEMENTED - Tests Passing (28/28)**

**Date:** August 20, 2026

---

## Current Configuration

### Placeholder Mode (ACTIVE)

**For LOCAL TESTING ONLY:**
```
Length: 30 cm (PLACEHOLDER - NOT VERIFIED)
Width:  25 cm (PLACEHOLDER - NOT VERIFIED)
Height: 10 cm (PLACEHOLDER - NOT VERIFIED)
Weight: 0g (No packaging weight configured)
```

⚠️ **IMPORTANT:** These are placeholder dimensions for testing purposes only.  
⚠️ **LIVE SHIPMENTS ARE BLOCKED** until physical measurements are configured.

---

## Configuration Steps

### Step 1: Measure Physical Packaging

Measure the actual WIN-DIA shipping box:

1. **Length** (longest side) in centimeters
2. **Width** (second longest side) in centimeters  
3. **Height** (shortest side) in centimeters
4. **Empty Box Weight** in grams (weigh empty box with packing materials)

### Step 2: Update Environment Variables

Edit `.env` file:

```bash
# Uncomment and update with actual measurements:
DTDC_PACKAGING_LENGTH_CM=30      # Replace with measured length
DTDC_PACKAGING_WIDTH_CM=25       # Replace with measured width
DTDC_PACKAGING_HEIGHT_CM=10      # Replace with measured height
DTDC_PACKAGING_WEIGHT_GRAMS=50   # Replace with measured box weight
DTDC_PACKAGING_VERIFIED=true     # Enable live shipments
```

### Step 3: Verify Configuration

Run a test to ensure configuration is valid:

```bash
npm test -- dtdc-service-types.test.ts
```

All tests should pass (28/28).

### Step 4: Test Live Shipment

After configuration:
1. Create a test order with 1 bundle
2. Attempt shipment creation
3. Verify AWB allocation in DTDC dashboard
4. Confirm dimensions are correct in DTDC system

---

## Safety Mechanism

### Blocking Live Shipments

The integration includes `validatePackagingForLiveShipment()` which:

✅ **Allows:** Mock tests and payload generation with placeholder dimensions  
❌ **Blocks:** Live DTDC API calls until `DTDC_PACKAGING_VERIFIED=true`

**Error Message When Blocked:**
```
LIVE DTDC SHIPMENT BLOCKED: Packaging dimensions and weight have not been verified.
Measure the physical WIN-DIA shipping box and configure:
DTDC_PACKAGING_LENGTH_CM, DTDC_PACKAGING_WIDTH_CM, DTDC_PACKAGING_HEIGHT_CM,
DTDC_PACKAGING_WEIGHT_GRAMS, and set DTDC_PACKAGING_VERIFIED=true
```

---

## Weight Calculation

### Current Behavior

**Without Packaging Weight Configured (Current):**
```
Product Weight Only:
1 bundle = 480g
2 bundles = 960g
3 bundles = 1440g
```

**With Packaging Weight Configured (Future):**
```
Product Weight + Packaging Weight:
1 bundle = 480g + 50g (box) = 530g = 0.53kg
2 bundles = 960g + 50g (box) = 1010g = 1.01kg
3 bundles = 1440g + 50g (box) = 1490g = 1.49kg
```

### Code Implementation

```typescript
function calculateTotalWeightKg(items: ShipmentItem[]): number {
  // Calculate product weight
  const totalProductGrams = items.reduce((sum, i) => {
    const itemWeight = Number(i.net_weight_grams);
    return sum + (itemWeight * (i.qty || 1));
  }, 0);
  
  // Add packaging weight if configured
  const packagingConfig = getPackagingConfig();
  const packagingGrams = packagingConfig.weightGrams;
  
  const totalGrams = totalProductGrams + packagingGrams;
  const weightKg = totalGrams / 1000;
  
  return Math.max(0.1, weightKg); // Minimum 0.1kg for DTDC
}
```

---

## Placeholder Dimensions

### Exported for Testing

```typescript
export const PLACEHOLDER_DIMENSIONS: PackagingDimensions = {
  length: 30,  // cm - PLACEHOLDER, NOT VERIFIED
  width: 25,   // cm - PLACEHOLDER, NOT VERIFIED
  height: 10,  // cm - PLACEHOLDER, NOT VERIFIED
};
```

### Usage in Tests

```typescript
import { PLACEHOLDER_DIMENSIONS } from '../dtdc';

it('should use placeholder dimensions for testing', () => {
  const dimensions = PLACEHOLDER_DIMENSIONS;
  
  expect(dimensions.length).toBe(30); // PLACEHOLDER
  expect(dimensions.width).toBe(25);  // PLACEHOLDER
  expect(dimensions.height).toBe(10); // PLACEHOLDER
});
```

---

## API Payload Changes

### Before (Hardcoded):

```typescript
const dimensions = {
  length: 30, // cm
  width: 25,  // cm  
  height: 10, // cm
};
```

### After (Configurable):

```typescript
// Get packaging dimensions from configuration
const packagingConfig = getPackagingConfig();
const dimensions = packagingConfig.dimensions;

if (!packagingConfig.isVerified) {
  console.warn('[DTDC] WARNING: Using PLACEHOLDER dimensions for testing.');
}
```

---

## Test Results

### Test Suite: `dtdc-service-types.test.ts`

```
✅ Test Suites: 1 passed, 1 total
✅ Tests:       28 passed, 28 total
✅ Time:        1.111s

New Tests Added:
✓ Packaging Configuration (3 tests)
  ✓ should have placeholder dimensions for testing
  ✓ should have valid dimension values
  ✓ placeholder dimensions should be marked for testing only

✓ Dimensions (3 tests)
  ✓ should use placeholder dimensions for testing
  ✓ should not use placeholder dimensions in production
  ✓ should require verified packaging for live shipments

Total: 28 tests (up from 24)
```

---

## Environment Variables Reference

### Required for Live Shipments

```bash
# Packaging Configuration (REQUIRED)
DTDC_PACKAGING_LENGTH_CM=30        # Box length in cm
DTDC_PACKAGING_WIDTH_CM=25         # Box width in cm
DTDC_PACKAGING_HEIGHT_CM=10        # Box height in cm
DTDC_PACKAGING_WEIGHT_GRAMS=50     # Empty box weight in grams
DTDC_PACKAGING_VERIFIED=true       # Enable live shipments

# DTDC Account (Already Configured)
DTDC_API_KEY=7b347fe9d334185098b1d666fcdc7e
DTDC_CUSTOMER_CODE=BO13750
DTDC_SERVICE_TYPE_ID=B2C PREMIUM
DTDC_COMMODITY_ID=1
```

### Optional (Testing)

For local testing, packaging variables can remain commented out.  
The system will use PLACEHOLDER_DIMENSIONS and block live API calls.

---

## Files Modified

### 1. `src/backend/lib/dtdc.ts`

**Added:**
- `PackagingDimensions` interface
- `PLACEHOLDER_DIMENSIONS` constant (exported for testing)
- `getPackagingConfig()` function
- `validatePackagingForLiveShipment()` function
- Updated `calculateTotalWeightKg()` to include packaging weight
- Updated `buildDtdcConsignmentPayload()` to use configurable dimensions
- Updated `createShipment()` to validate packaging before live calls

**Lines Added/Modified:** ~120 lines

### 2. `.env`

**Added:**
- Packaging configuration section with commented examples
- Instructions for measuring and configuring
- Safety warning about live shipment blocking

### 3. `src/backend/lib/__tests__/dtdc-service-types.test.ts`

**Added:**
- 3 new tests for packaging configuration
- Updated dimensions tests to use PLACEHOLDER_DIMENSIONS
- Verification test for packaging requirement

**Tests:** 24 → 28 tests (4 new tests added)

### 4. `docs/dtdc-packaging-configuration.md` (NEW)

Complete documentation for packaging configuration.

---

## Before vs After

### Before

```typescript
// Hardcoded dimensions
const dimensions = {
  length: 30, // cm - no way to change without code edit
  width: 25,  // cm
  height: 10, // cm
};

// No packaging weight
const totalGrams = items.reduce(...); // product weight only
```

**Problem:** 
- Dimensions were hardcoded in production code
- No way to configure without editing source
- Could create live shipments with wrong dimensions
- No packaging weight consideration

### After

```typescript
// Configurable via environment
const packagingConfig = getPackagingConfig();
const dimensions = packagingConfig.dimensions;

// Includes packaging weight
const totalGrams = totalProductGrams + packagingConfig.weightGrams;

// Safety check before live shipments
validatePackagingForLiveShipment();
```

**Benefits:**
- ✅ Dimensions configurable via environment variables
- ✅ Packaging weight properly included
- ✅ Safety check blocks unverified shipments
- ✅ Placeholder mode for local testing
- ✅ Clear error messages
- ✅ No production code changes needed for configuration

---

## Next Steps

### Immediate

1. ✅ **COMPLETE:** Implement configurable packaging
2. ✅ **COMPLETE:** Add safety validation
3. ✅ **COMPLETE:** Update tests (28/28 passing)
4. ✅ **COMPLETE:** Document configuration process

### Before Live Shipments

1. ⏳ **TODO:** Measure physical WIN-DIA shipping box
2. ⏳ **TODO:** Weigh empty box with packing materials
3. ⏳ **TODO:** Update `.env` with verified measurements
4. ⏳ **TODO:** Set `DTDC_PACKAGING_VERIFIED=true`
5. ⏳ **TODO:** Test with controlled API call
6. ⏳ **TODO:** Verify dimensions in DTDC dashboard

---

## Important Notes

⚠️ **Placeholder dimensions are for LOCAL TESTING ONLY**  
⚠️ **NOT verified WIN-DIA packaging specifications**  
⚠️ **Live DTDC shipments are BLOCKED** until verified  
⚠️ **Product weights preserved** (480g per bundle)  
⚠️ **B2C PREMIUM and B2C PRIORITY support maintained**  
⚠️ **Checkout, payments, and product catalog unchanged**

---

## Support

**Configuration Issue?**
- Check that all 5 packaging variables are set in `.env`
- Verify `DTDC_PACKAGING_VERIFIED=true` is set (not "True" or "TRUE")
- Run tests to ensure configuration is valid

**Need Help?**
- Review this document
- Check `.env` file comments
- Run: `npm test -- dtdc-service-types.test.ts`
- See `docs/dtdc-sample-payloads.md` for payload examples

