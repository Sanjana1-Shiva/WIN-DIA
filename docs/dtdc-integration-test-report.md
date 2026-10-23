# DTDC Integration Test Report

**Test Date:** August 20, 2026  
**Test Type:** Mock Integration Tests  
**Status:** ✅ **ALL TESTS PASSING (16/16)**

---

## Executive Summary

Comprehensive integration testing of WIN-DIA's DTDC booking implementation completed successfully. All 4 test scenarios plus AWB parsing, error handling, and payload validation passed with mock HTTP responses. **No production DTDC API calls were made.**

### Test Results

```
✅ Test Suites: 1 passed, 1 total
✅ Tests:       16 passed, 16 total  
✅ Time:        1.674s
```

---

## Test Scenarios

### ✅ Scenario 1: Single Customer, Single Bundle

**Description:** One customer orders one bundle

**Configuration:**
- Service: B2C PREMIUM
- Weight: 0.48kg (480g)
- Consignments: 1
- Physical Parcels: 1
- Payment: Online (Razorpay)

**Generated Payload:**
```json
{
  "consignments": [{
    "customer_code": "BO13750",
    "service_type_id": "B2C PREMIUM",
    "load_type": "NON-DOCUMENT",
    "consignment_type": "Forward",
    "description": "WIN-DIA Food Products",
    "dimension_unit": "cm",
    "length": 30,
    "width": 25,
    "height": 10,
    "weight_unit": "kg",
    "weight": 0.48,
    "declared_value": 640,
    "num_pieces": 1,
    "origin_details": {
      "name": "KALPAVRISTI COCO FOODS (OPC) PRIVATE LIMITED",
      "phone": "9148339947",
      "address_line_1": "#1058/C, Basavanahalli Main Road, Belvadi Village",
      "address_line_2": "Ilavala Hobli",
      "pincode": "570032",
      "city": "Mysuru",
      "state": "Karnataka"
    },
    "destination_details": {
      "name": "Rajesh Kumar",
      "phone": "9876543210",
      "address_line_1": "123 MG Road",
      "address_line_2": "Koramangala",
      "pincode": "560034",
      "city": "Bangalore",
      "state": "Karnataka"
    },
    "return_details": {
      "name": "KALPAVRISTI COCO FOODS (OPC) PRIVATE LIMITED",
      "phone": "9148339947",
      "address_line_1": "#1058/C, Basavanahalli Main Road, Belvadi Village",
      "address_line_2": "Ilavala Hobli",
      "pincode": "570032",
      "city": "Mysuru",
      "state": "Karnataka"
    },
    "customer_reference_number": "WINDIA-ORD-001",
    "commodity_id": "1",
    "invoice_number": "WINDIA-ORD-001",
    "invoice_date": "2026-08-20",
    "reference_number": "WINDIA-ORD-001"
  }]
}
```

**Mock Response:**
```json
{
  "success": true,
  "reference_number": "WINDIA-ORD-001",
  "awb_number": "D12345678901",
  "consignment_number": "D12345678901",
  "tracking_url": "https://www.dtdc.in/tracking.asp?trackno=D12345678901"
}
```

**Tests Passed:**
- ✅ Correct service type (B2C PREMIUM)
- ✅ Correct weight (0.48kg)
- ✅ Correct num_pieces (1)
- ✅ Correct dimensions (30×25×10cm)
- ✅ No COD fields (online payment)
- ✅ AWB parsed correctly
- ✅ All required DTDC API fields present

---

### ✅ Scenario 2: Single Customer, Three Bundles (One Box)

**Description:** One customer orders three different bundles packaged in one box

**Configuration:**
- Service: B2C PREMIUM
- Total Weight: 1.44kg (1440g)
- Items: 3 bundles (Garlic, Onion, Tomato)
- Consignments: 1
- Physical Parcels: 1
- Payment: Online (Razorpay)

**Key Payload Fields:**
```json
{
  "service_type_id": "B2C PREMIUM",
  "weight": 1.44,
  "weight_unit": "kg",
  "num_pieces": 3,
  "declared_value": 1920
}
```

**Weight Calculation Verified:**
```
Garlic:  480g × 1 = 480g
Onion:   480g × 1 = 480g
Tomato:  480g × 1 = 480g
────────────────────────
Total:           1440g = 1.44kg ✅
```

**Tests Passed:**
- ✅ Correct total weight (1.44kg)
- ✅ Correct num_pieces (3)
- ✅ Single consignment for multiple bundles
- ✅ No automatic service type switching

---

### ✅ Scenario 3: Three Customers, One Bundle Each

**Description:** Three different customers order one bundle each (separate orders)

**Configuration:**
- Service: B2C PREMIUM (all three)
- Weight: 0.48kg each
- Consignments: 3 (separate)
- Physical Parcels: 3 (different addresses)
- Payment: Online (Razorpay)

**Customer Details:**

| Customer | City | AWB Number | Weight |
|----------|------|------------|--------|
| Customer One | Delhi | D12345678903 | 0.48kg |
| Customer Two | Chennai | D12345678904 | 0.48kg |
| Customer Three | Kolkata | D12345678905 | 0.48kg |

**Tests Passed:**
- ✅ Three separate API calls
- ✅ Unique AWB for each customer
- ✅ Correct destination details per customer
- ✅ Each consignment has correct weight (0.48kg)
- ✅ No mixing of customer data

---

### ✅ Scenario 4: B2C PRIORITY with Multi-Parcel

**Description:** One customer with B2C PRIORITY service (3 parcels, COD)

**Configuration:**
- Service: B2C PRIORITY (explicit override)
- Total Weight: 1.44kg
- Items: 3 bundles
- Consignments: 1
- num_pieces: 3
- Payment: COD (Cash on Delivery)
- COD Amount: ₹1920

**Key Payload Fields:**
```json
{
  "service_type_id": "B2C PRIORITY",
  "weight": 1.44,
  "num_pieces": 3,
  "cod_collection_mode": "Cash",
  "cod_amount": 1920
}
```

**Tests Passed:**
- ✅ Service type override works (B2C PRIORITY)
- ✅ COD fields included
- ✅ Correct COD amount (1920)
- ✅ Correct weight and num_pieces

**Important Note:**  
Current implementation uses `num_pieces=3` for multi-parcel. DTDC API may require `pieces_detail` array for true multi-parcel bookings with individual piece dimensions:

```json
{
  "pieces_detail": [
    { "length": 30, "width": 25, "height": 10, "weight": 0.48 },
    { "length": 30, "width": 25, "height": 10, "weight": 0.48 },
    { "length": 30, "width": 25, "height": 10, "weight": 0.48 }
  ]
}
```

This should be verified with DTDC support if multi-parcel bookings are rejected.

---

## AWB Response Parsing Tests

### ✅ Test 1: Parse from `awb_number` field
**Response:**
```json
{ "success": true, "awb_number": "D11111111111" }
```
**Result:** AWB = "D11111111111" ✅

### ✅ Test 2: Parse from `consignment_number` if `awb_number` missing
**Response:**
```json
{ "success": true, "consignment_number": "D22222222222" }
```
**Result:** AWB = "D22222222222" ✅

### ✅ Test 3: Parse from `reference_number` as last fallback
**Response:**
```json
{ "success": true, "reference_number": "TEST-003" }
```
**Result:** AWB = "TEST-003" ✅

### ✅ Test 4: Handle missing AWB allocation
**Response:**
```json
{ "success": true }
```
**Result:** Error with message "DTDC did not allocate AWB number" ✅

---

## Error Handling Tests

### ✅ Test 1: Insufficient Balance
**Mock Response:**
```json
{
  "success": false,
  "message": "Insufficient balance in your account"
}
```
**Result:**  
- Success = false ✅
- Error message: "Insufficient DTDC account balance. Please recharge your DTDC account." ✅

### ✅ Test 2: Invalid Service Type
**Mock Response:**
```json
{
  "success": false,
  "message": "Invalid service_type_id provided"
}
```
**Result:**  
- Success = false ✅
- Error message contains "service_type_id" ✅

### ✅ Test 3: Duplicate Booking
**Mock Response:**
```json
{
  "success": false,
  "message": "Duplicate reference number found"
}
```
**Result:**  
- Success = false ✅
- Error message: "Duplicate booking attempt. This order may already have a shipment." ✅

### ✅ Test 4: Network Error
**Mock Behavior:** Fetch throws network error
**Result:**  
- Success = false ✅
- Error message: "Network error connecting to DTDC API" ✅

---

## Payload Validation Tests

### ✅ Test 1: All Required DTDC API Fields Present

**Verified Fields:**
```
✅ customer_code
✅ service_type_id
✅ load_type
✅ consignment_type
✅ description
✅ dimension_unit
✅ length
✅ width
✅ height
✅ weight_unit
✅ weight
✅ declared_value
✅ num_pieces
✅ origin_details (with name, phone, address_line_1, pincode, city, state)
✅ destination_details (with name, phone, address_line_1, pincode, city, state)
✅ customer_reference_number
✅ commodity_id
✅ reference_number
```

### ✅ Test 2: Correct Data Types

**Verified Types:**
```
✅ customer_code: string
✅ service_type_id: string
✅ weight: number
✅ declared_value: number
✅ num_pieces: number
✅ length: number
✅ width: number
✅ height: number
✅ cod_amount: number (when COD)
✅ reference_number: string
```

---

## API Schema Compliance

### DTDC API Endpoint
```
POST https://pxapi.dtdc.in/api/customer/integration/consignment/softdata
```

### Headers
```
Content-Type: application/json
api-key: {DTDC_API_KEY}
```

### Payload Structure
✅ **Matches DTDC API documentation:**
- Top-level `consignments` array
- All required fields present
- Correct data types
- Proper COD field handling
- Valid origin/destination structure

### No Schema Mismatches Found

All generated payloads conform to DTDC API specification based on available documentation.

---

## Weight Calculations Summary

### Verified Calculations

| Scenario | Bundles | Product Weight | Packaging | Total Weight |
|----------|---------|----------------|-----------|--------------|
| 1 bundle | 1 | 480g | 0g | 0.48kg ✅ |
| 2 bundles | 2 | 960g | 0g | 0.96kg ✅ |
| 3 bundles | 3 | 1440g | 0g | 1.44kg ✅ |

**Note:** Packaging weight is currently 0g (placeholder configuration).  
When configured, packaging weight will be added to total.

---

## Remaining Integration Issues

### 1. ⚠️ Multi-Parcel Format Verification Needed

**Issue:** DTDC API may require `pieces_detail` array for B2C PRIORITY multi-parcel bookings.

**Current Implementation:**
```json
{
  "num_pieces": 3,
  "weight": 1.44
}
```

**May Need:**
```json
{
  "num_pieces": 3,
  "pieces_detail": [
    { "length": 30, "width": 25, "height": 10, "weight": 0.48 },
    { "length": 30, "width": 25, "height": 10, "weight": 0.48 },
    { "length": 30, "width": 25, "height": 10, "weight": 0.48 }
  ]
}
```

**Action Required:**  
Test with actual DTDC API or contact DTDC support to confirm multi-parcel format requirements.

---

### 2. ⏳ Packaging Dimensions Not Verified

**Current Configuration:**
- Length: 30cm (PLACEHOLDER)
- Width: 25cm (PLACEHOLDER)
- Height: 10cm (PLACEHOLDER)
- Weight: 0g (not configured)

**Action Required:**  
Measure physical WIN-DIA shipping box and update `.env`:
```bash
DTDC_PACKAGING_LENGTH_CM=30      # Replace with actual
DTDC_PACKAGING_WIDTH_CM=25       # Replace with actual
DTDC_PACKAGING_HEIGHT_CM=10      # Replace with actual
DTDC_PACKAGING_WEIGHT_GRAMS=50   # Replace with actual
DTDC_PACKAGING_VERIFIED=true     # Enable live shipments
```

---

### 3. ⏳ First Live API Test Pending

**Status:** All mock tests passing, but no production API call made yet.

**Action Required:**
1. Configure verified packaging dimensions
2. Ensure DTDC account has sufficient balance
3. Create test order with 1 bundle
4. Call DTDC API with test credentials
5. Verify AWB allocation in DTDC dashboard
6. Check tracking URL works
7. Confirm dimensions are accepted

---

### 4. ⏳ Tracking API Not Implemented

**Current Status:** Tracking method returns "not yet implemented" error.

**Action Required:**
- Get DTDC tracking API endpoint from documentation
- Implement `trackShipment()` method
- Test with real AWB numbers

---

### 5. ⏳ Cancellation API Not Implemented

**Current Status:** Cancellation method returns "not yet implemented" error.

**Action Required:**
- Get DTDC cancellation API endpoint from documentation
- Implement `cancelShipment()` method
- Test cancellation flow

---

## Test Coverage Summary

### Scenarios Tested

| # | Scenario | Tests | Status |
|---|----------|-------|--------|
| 1 | Single customer, single bundle | 2 | ✅ Pass |
| 2 | Single customer, three bundles | 2 | ✅ Pass |
| 3 | Three customers, one bundle each | 1 | ✅ Pass |
| 4 | B2C PRIORITY multi-parcel | 1 | ✅ Pass |

### Features Tested

| Feature | Tests | Status |
|---------|-------|--------|
| AWB Response Parsing | 4 | ✅ Pass |
| Error Handling | 4 | ✅ Pass |
| Payload Validation | 2 | ✅ Pass |

### Total Coverage

```
✅ Test Files: 1
✅ Test Suites: 1 passed
✅ Tests: 16 passed
✅ Time: 1.674s
```

---

## Sample Payloads

### B2C PREMIUM (Single Bundle, Non-COD)
See **Scenario 1** section above for complete payload.

### B2C PREMIUM (Multiple Bundles, Non-COD)
```json
{
  "consignments": [{
    "service_type_id": "B2C PREMIUM",
    "weight": 1.44,
    "num_pieces": 3,
    "declared_value": 1920,
    // ... other fields same as Scenario 1
  }]
}
```

### B2C PRIORITY (Multiple Bundles, COD)
```json
{
  "consignments": [{
    "service_type_id": "B2C PRIORITY",
    "weight": 1.44,
    "num_pieces": 3,
    "cod_collection_mode": "Cash",
    "cod_amount": 1920,
    "declared_value": 1920,
    // ... other fields same as Scenario 1
  }]
}
```

---

## Recommendations

### Immediate Actions

1. ✅ **COMPLETE:** Mock integration tests
2. ⏳ **TODO:** Measure physical packaging
3. ⏳ **TODO:** Update `.env` with verified dimensions
4. ⏳ **TODO:** Perform first live DTDC API test
5. ⏳ **TODO:** Verify multi-parcel format with DTDC
6. ⏳ **TODO:** Implement tracking API
7. ⏳ **TODO:** Implement cancellation API

### Before Production

1. Verify packaging dimensions and weight
2. Test with real DTDC account
3. Verify AWB allocation works
4. Test tracking URL functionality
5. Confirm COD collection works
6. Test all error scenarios with real API
7. Verify webhook/callback integration (if any)

---

## Conclusion

✅ **All integration tests passing (16/16)**  
✅ **Payloads conform to DTDC API schema**  
✅ **Error handling comprehensive**  
✅ **Weight calculations correct**  
✅ **Service type selection working**  
⏳ **Ready for controlled live API test**

**No production DTDC API calls were made during testing.**

---

## Files

**Test File:** `src/backend/lib/__tests__/dtdc-integration.test.ts`  
**Implementation:** `src/backend/lib/dtdc.ts`  
**Documentation:** `docs/dtdc-sample-payloads.md`  
**Configuration:** `.env`

**Test Report Date:** August 20, 2026  
**Next Review:** After first live API test

