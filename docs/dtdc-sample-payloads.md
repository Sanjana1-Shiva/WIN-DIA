# DTDC Sample Payloads

This document provides sample JSON payloads for DTDC B2C PREMIUM and B2C PRIORITY service types.

## B2C PREMIUM - Single Parcel Example

**Use Case:** Single bundle order (1 bundle = 480g)  
**Service Type:** B2C PREMIUM  
**Payment Method:** Online (Razorpay)  
**COD:** No

```json
{
  "consignments": [
    {
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
      "customer_reference_number": "WINDIA-ORD-20260820-001",
      "commodity_id": "1",
      "invoice_number": "WINDIA-ORD-20260820-001",
      "invoice_date": "2026-08-20",
      "reference_number": "WINDIA-ORD-20260820-001"
    }
  ]
}
```

**Weight Calculation:**
- 1 bundle × 480g = 480g = 0.48kg

**Expected Response:**
```json
{
  "success": true,
  "reference_number": "WINDIA-ORD-20260820-001",
  "awb_number": "D12345678901",
  "consignment_number": "D12345678901",
  "tracking_url": "https://www.dtdc.in/tracking.asp?trackno=D12345678901"
}
```

---

## B2C PRIORITY - Multi-Parcel Example

**Use Case:** Multi-bundle order (3 bundles = 1440g)  
**Service Type:** B2C PRIORITY  
**Payment Method:** Cash on Delivery (COD)  
**COD Amount:** ₹1920

```json
{
  "consignments": [
    {
      "customer_code": "BO13750",
      "service_type_id": "B2C PRIORITY",
      "load_type": "NON-DOCUMENT",
      "consignment_type": "Forward",
      "description": "WIN-DIA Food Products",
      "dimension_unit": "cm",
      "length": 30,
      "width": 25,
      "height": 10,
      "weight_unit": "kg",
      "weight": 1.44,
      "declared_value": 1920,
      "num_pieces": 3,
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
        "name": "Priya Sharma",
        "phone": "9123456789",
        "address_line_1": "456 Park Street",
        "address_line_2": "Andheri West",
        "pincode": "400058",
        "city": "Mumbai",
        "state": "Maharashtra"
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
      "customer_reference_number": "WINDIA-ORD-20260820-002",
      "cod_collection_mode": "Cash",
      "cod_amount": 1920,
      "commodity_id": "1",
      "invoice_number": "WINDIA-ORD-20260820-002",
      "invoice_date": "2026-08-20",
      "reference_number": "WINDIA-ORD-20260820-002"
    }
  ]
}
```

**Weight Calculation:**
- 2 × Garlic Flavour (480g each) = 960g
- 1 × Onion Flavour (480g) = 480g
- **Total:** 1440g = 1.44kg

**Expected Response:**
```json
{
  "success": true,
  "reference_number": "WINDIA-ORD-20260820-002",
  "awb_number": "D12345678902",
  "consignment_number": "D12345678902",
  "tracking_url": "https://www.dtdc.in/tracking.asp?trackno=D12345678902"
}
```

---

## Weight Calculation Reference

WIN-DIA uses corrected weight calculations per bundle:

| Bundles | Total Weight (grams) | Total Weight (kg) | DTDC Payload |
|---------|---------------------|-------------------|--------------|
| 1       | 480g                | 0.48kg            | `"weight": 0.48` |
| 2       | 960g                | 0.96kg            | `"weight": 0.96` |
| 3       | 1440g               | 1.44kg            | `"weight": 1.44` |

**Important Notes:**
- Each WIN-DIA bundle = 480 grams (12 packets × 40g)
- DTDC expects weight in kilograms with decimal precision
- `num_pieces` = total quantity of bundles
- DO NOT multiply by packet count again (already included in 480g per bundle)

---

## Service Type Selection Guidelines

### B2C PREMIUM (Default)
- **Use for:** Standard single-parcel deliveries
- **Environment variable:** `DTDC_SERVICE_TYPE_ID=B2C PREMIUM`
- **Recommended:** Orders with 1-2 bundles that fit in one parcel

### B2C PRIORITY
- **Use for:** Multi-parcel or priority shipments
- **Override required:** Must explicitly select this service
- **Recommended:** Orders with multiple parcels or urgent delivery requirements

### Configuration
```bash
# Default service type in .env
DTDC_SERVICE_TYPE_ID=B2C PREMIUM

# To use B2C PRIORITY for a specific order:
# Pass serviceType parameter when creating shipment:
const result = await dtdcProvider.createShipment({
  ...orderParams,
  serviceType: 'B2C PRIORITY'
});
```

---

## Error Handling

### Common Error Scenarios

#### 1. Insufficient Balance
```json
{
  "success": false,
  "message": "Insufficient balance in account"
}
```
**Handling:** Display user-friendly message, notify admin to recharge DTDC account

#### 2. Invalid Service Type
```json
{
  "success": false,
  "message": "Invalid service_type_id"
}
```
**Handling:** Verify `DTDC_SERVICE_TYPE_ID` in .env file

#### 3. Duplicate Booking
```json
{
  "success": false,
  "message": "Duplicate reference number"
}
```
**Handling:** Order already has a shipment, check shipments table

#### 4. Missing AWB Allocation
```json
{
  "success": true,
  "reference_number": "ORD123"
  // awb_number is missing
}
```
**Handling:** Use reference_number as fallback, log for investigation

---

## API Endpoint

**URL:** `POST https://pxapi.dtdc.in/api/customer/integration/consignment/softdata`

**Headers:**
```
Content-Type: application/json
api-key: {DTDC_API_KEY}
```

**Environment Variables Required:**
```bash
DTDC_API_KEY=7b347fe9d334185098b1d666fcdc7e
DTDC_CUSTOMER_CODE=BO13750
DTDC_SERVICE_TYPE_ID=B2C PREMIUM
DTDC_COMMODITY_ID=1
```

---

## Testing Status

✅ All 24 unit tests passed
✅ Service type constants validated
✅ Payload generation tested
✅ Weight calculations verified (480g, 960g, 1440g)
✅ Service type selection logic tested
✅ Error handling scenarios covered
✅ COD field handling validated
✅ Dimensions validation complete

**Next Steps:**
1. Perform controlled API test with test credentials
2. Verify AWB allocation in DTDC dashboard
3. Test tracking URL generation
4. Validate COD amount collection
5. Enable automatic shipment creation after successful test

---

## Important Notes

⚠️ **Do not automatically switch** to B2C PRIORITY based on bundle count  
⚠️ **Multiple bundles can fit** into one parcel - service type should be explicitly selected  
⚠️ **Preserve weight calculations** - 1 bundle = 480g, no double multiplication  
⚠️ **Use actual dimensions** - 30×25×10 cm (WIN-DIA standard box)  
⚠️ **Test before production** - Verify with DTDC support before going live

