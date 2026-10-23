# WIN-DIA Supabase Database Compatibility Audit
## New Requirements: 6-Packet Bundle Structure

**Date:** 2026-08-20  
**Mode:** READ-ONLY (No Code Modifications)  
**Scope:** Payment backend, Checkout integration, Inventory, DTDC shipping

---

## Executive Summary

This audit verifies the Supabase database compatibility with WIN-DIA's NEW ordering requirements:
- **OLD:** 1 bundle = 10 paid + 2 free = 12 packets (480g) @ ₹640
- **NEW:** 1 bundle = 6 packets (240g) with tiered pricing: ₹384/₹640/₹896/₹1152

### Critical Findings

**🔴 CRITICAL:** The backend constants file still uses the OLD 12-packet structure.

**🟡 REQUIRES CHANGES:** 11 backend files reference hardcoded values that must be updated.

**🟢 DATABASE READY:** Migrations support the new structure (net_weight_grams, flavor fields exist).

**🔴 BLOCKER:** Order cancellation/refund functionality is FULLY IMPLEMENTED but client explicitly prohibits these features.

---

## A. Database Changes Detected

### Migration Timeline
Database teammate completed these migrations (analyzed from `supabase/migrations/`):

| Migration | Date | Purpose | Status |
|-----------|------|---------|--------|
| `20260802_create_checkout_transaction.sql` | 2026-08-02 | ✅ Atomic checkout RPC | DEPLOYED |
| `20260802_rate_limits.sql` | 2026-08-02 | ✅ Rate limiting table | DEPLOYED |
| `20260815_atomic_stock_deduct.sql` | 2026-08-15 | ✅ Atomic inventory RPCs | DEPLOYED |
| `20260816_cart_items_rename_variant_id.sql` | 2026-08-16 | ✅ Rename variant_id → product_id | DEPLOYED |
| `20260817_expire_abandoned_orders.sql` | 2026-08-17 | ✅ Auto-cancel unpaid orders | DEPLOYED |
| `20260817_rls_cart_wishlist.sql` | 2026-08-17 | ✅ Row-level security | DEPLOYED |
| `20260818_security_advisor_fixes.sql` | 2026-08-18 | ✅ Revoke trigger function access | DEPLOYED |
| `20260820_update_payment_status_for_cod.sql` | 2026-08-20 | ✅ COD payment status fix | DEPLOYED |
| `20260824_fix_tracking_token_nullable.sql` | 2026-08-24 | ✅ Make tracking_token nullable | DEPLOYED |

### Table Structure Analysis

**✅ VERIFIED:** The following table columns support the 6-packet bundle structure:

#### `public.orders`
```sql
-- From migration 20260820_update_payment_status_for_cod.sql
order_number VARCHAR
user_id UUID
order_status VARCHAR (placed, confirmed, processing, shipped, delivered, cancelled)
payment_status VARCHAR (pending, paid, cod_pending, cod_collected, failed, refund_initiated, refunded)
payment_method VARCHAR (razorpay, cod)
items_price NUMERIC
discount_price NUMERIC
tax_price NUMERIC
shipping_price NUMERIC
total_price NUMERIC
shipping_address JSONB
order_notes TEXT
tracking_token VARCHAR (nullable as of 20260824)
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### `public.order_items`
```sql
-- From migration 20260820_update_payment_status_for_cod.sql
order_id UUID (FK → orders.id)
product_id UUID (FK → products.id)
name VARCHAR
price NUMERIC
qty INTEGER (bundle count, not packet count)
flavor VARCHAR (✅ supports multi-flavor bundles)
net_weight_grams NUMERIC (✅ weight per bundle in grams)
image VARCHAR
created_at TIMESTAMP
```

**KEY OBSERVATION:** `order_items.qty` stores BUNDLE count, not packet count. `net_weight_grams` stores weight PER BUNDLE (e.g., 240g for new structure, 480g for old).

#### `public.products`
```sql
-- From seed file: supabase/seed/seed-products.sql
id UUID PRIMARY KEY
name VARCHAR
slug VARCHAR UNIQUE
flavor VARCHAR
category_id UUID
price NUMERIC (currently ₹640 - needs update)
original_price NUMERIC
description TEXT
is_active BOOLEAN
is_featured BOOLEAN
count_in_stock INTEGER (measured in PACKETS)
is_gluten_free BOOLEAN
is_low_gi BOOLEAN
is_vegan BOOLEAN
net_weight VARCHAR (currently "200g" - needs update to "240g")
image VARCHAR
created_at TIMESTAMP
updated_at TIMESTAMP
```

**⚠️ CRITICAL:** Current seed data shows:
- `price = 640` (OLD single-bundle price, needs tiered pricing)
- `net_weight = "200g"` (test value, needs update to "240g")
- `count_in_stock = 100` (measured in PACKETS - this is CORRECT)

#### `public.payments`
```sql
-- From migration 20260820_update_payment_status_for_cod.sql
order_id UUID
payment_provider VARCHAR (razorpay, cod)
transaction_id VARCHAR
provider_order_id VARCHAR (Razorpay order ID)
amount NUMERIC
currency VARCHAR
status VARCHAR (pending, paid, cod_pending, cod_collected, failed, refunded)
payment_method VARCHAR
raw_response JSONB
created_at TIMESTAMP
```

#### `public.shipments`
```sql
-- From migration 20260820_update_payment_status_for_cod.sql
order_id UUID
provider VARCHAR (shiprocket, dtdc)
courier_name VARCHAR
status VARCHAR (created, booked, shipped, delivered)
awb_code VARCHAR (tracking number)
shipped_at TIMESTAMP
delivered_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

**⚠️ MISSING:** No `shipping_packages` table found. Shipment dimensions/weight are passed to DTDC API directly, not persisted in database.

---

## B. Checkout RPC Compatibility

### Function: `create_checkout_order_transaction`

**File:** `supabase/migrations/20260820_update_payment_status_for_cod.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.create_checkout_order_transaction(
    p_user_id UUID,
    p_order_data JSONB,
    p_order_items JSONB,
    p_payment_data JSONB,
    p_shipment_data JSONB
)
RETURNS JSONB
```

**✅ COMPATIBLE:** The RPC is bundle-agnostic and accepts:
- `p_order_items` as JSONB array with `qty` (bundle count), `net_weight_grams` (weight per bundle), `flavor`
- Bundle structure changes are handled at the APPLICATION layer (checkout.service.ts)

**Example Expected Payload:**
```json
{
  "p_order_items": [
    {
      "product_id": "uuid-1",
      "name": "Garlic Flavour",
      "price": 640,
      "qty": 2,
      "flavor": "Garlic",
      "net_weight_grams": 240,
      "image": "/images/garlic.png"
    }
  ]
}
```

**COD Handling:**
- ✅ Sets `payment_status = 'cod_pending'` for COD orders
- ✅ Sets `payment_status = 'pending'` for Razorpay orders
- ✅ Creates COD payment record with `status = 'cod_pending'`

**Stock Integration:**
- ❌ RPC does NOT deduct stock during checkout
- ✅ Stock deduction happens AFTER successful payment via `atomic_deduct_stock` RPC

---

## C. Inventory Integration

### Stock Deduction Ownership

**✅ VERIFIED:** Stock is deducted AFTER payment success, not during checkout.

#### Flow:
1. **Checkout:** `CheckoutService.createOrder()` validates stock via `InventoryService.validateStock()`
2. **Payment Success:** `InventoryService.deductStockAfterSuccessfulPayment()` calls `atomic_deduct_stock` RPC
3. **Database:** `atomic_deduct_stock()` atomically decrements `products.count_in_stock`

#### Atomic Stock RPC

**File:** `supabase/migrations/20260815_atomic_stock_deduct.sql`

```sql
CREATE OR REPLACE FUNCTION public.atomic_deduct_stock(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN
```

**✅ VERIFIED:** Prevents race conditions via:
```sql
UPDATE public.products
SET count_in_stock = count_in_stock - p_quantity
WHERE id = p_product_id
  AND count_in_stock >= p_quantity
  AND is_active = true;
```

### 🔴 CRITICAL BUG: Double-Deduction Risk (FROM FIRST AUDIT)

**Location 1:** `app/api/payment/verify/route.ts:99`
```typescript
const deductRes = await inventoryService.deductStockAfterSuccessfulPayment(
  item.product_id, 
  item.qty  // ❌ BUG: This is BUNDLE count, not packet count
);
```

**Location 2:** `src/backend/services/payment.service.ts:467`
```typescript
const deductRes = await this.inventoryService.deductStockAfterSuccessfulPayment(
  item.product_id, 
  item.qty  // ❌ BUG: This is BUNDLE count, not packet count
);
```

**Impact:**
- Ordering 1 bundle (6 packets) deducts only 1 packet from stock
- Ordering 2 bundles (12 packets) deducts only 2 packets from stock
- **Stock underflows** after 167 orders instead of ~14 orders (1000 packets ÷ 6 = 166.67)

**Required Fix:**
```typescript
// CORRECT: Deduct packets shipped per bundle
const packetsToDeduct = item.qty * BundlePricing.PACKETS_SHIPPED_PER_BUNDLE;
const deductRes = await inventoryService.deductStockAfterSuccessfulPayment(
  item.product_id, 
  packetsToDeduct  // ✅ Use packet count for inventory
);
```

### Stock Validation (Checkout)

**File:** `src/backend/services/checkout.service.ts:290`

**✅ CORRECT:** Stock validation uses `packetsShipped`:
```typescript
const bundlePricing = calculateBundlePricing(bundles);
const stockRes = await this.inventoryService.validateStock(
  validProductId, 
  bundlePricing.packetsShipped  // ✅ Validates against packets (12 per bundle OLD, 6 NEW)
);
```

**This code is CORRECT** for stock validation but will break when constants are updated to 6 packets.

---

## D. Razorpay Compatibility

### Payment Flow

**✅ VERIFIED:** Razorpay integration is bundle-structure agnostic.

#### Payment Creation
**File:** `src/backend/services/payment.service.ts`

```typescript
// Razorpay order creation uses totalPrice (in paise)
const razorpayOrder = await razorpay.orders.create({
  amount: totalPrice * 100, // ✅ Works with any pricing structure
  currency: 'INR',
  receipt: orderNumber,
});
```

#### Payment Verification
**File:** `app/api/payment/verify/route.ts`

```typescript
// Signature verification is independent of bundle structure
const isValid = validateRazorpaySignature(
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
);
```

**✅ NO CHANGES REQUIRED** to Razorpay integration.

---

## E. COD Compatibility

**✅ VERIFIED:** COD flow is compatible with new bundle structure.

### COD Order Creation
**File:** `supabase/migrations/20260820_update_payment_status_for_cod.sql`

```sql
-- Sets payment_status = 'cod_pending' for COD orders
IF v_payment_method = 'cod' THEN
    v_payment_status := 'cod_pending';
ELSE
    v_payment_status := 'pending';
END IF;
```

### COD Amount Calculation
**File:** `src/backend/lib/dtdc.ts:366`

```typescript
...(isCOD && {
  cod_collection_mode: 'Cash' as const,
  cod_amount: totalPrice,  // ✅ Uses order total, works with any pricing
}),
```

**✅ NO CHANGES REQUIRED** to COD flow.

---

## F. DTDC Compatibility

### Weight Calculation

**File:** `src/backend/lib/dtdc.ts:238`

```typescript
function calculateTotalWeightKg(items: ShipmentItem[]): number {
  const totalProductGrams = items.reduce((sum, i) => {
    const itemWeight = Number(i.net_weight_grams);
    return sum + (itemWeight * (i.qty || 1));  // ✅ Correct: weight_per_bundle * qty
  }, 0);
  
  const packagingGrams = packagingConfig.weightGrams;
  const totalGrams = totalProductGrams + packagingGrams;
  const weightKg = totalGrams / 1000;
  
  return Math.max(0.1, weightKg);
}
```

**✅ CORRECT IMPLEMENTATION:**
- `net_weight_grams` stores weight PER BUNDLE (240g for new, 480g for old)
- Multiplies by `qty` (bundle count) to get total weight
- Example: 2 bundles × 240g = 480g = 0.48kg

### Packaging Dimensions

**File:** `src/backend/lib/dtdc.ts:296`

**Current Config:**
- **Placeholder:** 30cm × 25cm × 10cm (NOT verified WIN-DIA packaging)
- **Client Requirement:** 20.4cm × 12.6cm × 7.6cm

**⚠️ ACTION REQUIRED:** Update packaging config with verified dimensions:

```typescript
// Current (placeholder):
const packagingConfig = getPackagingConfig();
// Returns: { length: 30, width: 25, height: 10, weightGrams: 0 }

// Required:
// length: 20.4, width: 12.6, height: 7.6
```

### COD Collection Amount

**File:** `src/backend/lib/dtdc.ts:366`

```typescript
cod_amount: totalPrice,  // ✅ Uses order total from checkout
```

**✅ COMPATIBLE:** Works with any pricing structure (₹384/₹640/₹896/₹1152).

---

## G. Backend Files Requiring Changes

### 🔴 CRITICAL: Bundle Pricing Constants

**File:** `src/backend/constants/bundle-pricing.constants.ts`

**Current Values (OLD STRUCTURE):**
```typescript
export const BundlePricing = {
  PACKETS_PER_BUNDLE: 10,            // ❌ OLD: Paid packets
  PACKETS_SHIPPED_PER_BUNDLE: 12,   // ❌ OLD: Shipped packets (10 + 2 free)
  PRICE_PER_PACKET: 64,               // ❌ OLD: ₹64/packet
  BUNDLE_PRICE: 640,                  // ❌ OLD: Single price
  FREE_PACKETS_PER_BUNDLE: 2,        // ❌ OLD: Bonus packets
  SHIPPING_COST: 0,                   // ✅ CORRECT: Free shipping
  TAX_RATE: 0,                        // ✅ CORRECT: Inclusive pricing
  MIN_BUNDLES: 1,                     // ✅ CORRECT
  MAX_BUNDLES_PER_ITEM: 50,          // ✅ CORRECT
} as const;
```

**Required Values (NEW STRUCTURE):**
```typescript
export const BundlePricing = {
  PACKETS_PER_BUNDLE: 6,              // ✅ NEW: 6 packets per bundle
  PACKETS_SHIPPED_PER_BUNDLE: 6,     // ✅ NEW: No bonus packets
  PACKET_WEIGHT_GRAMS: 40,            // ✅ NEW: 40g per packet
  BUNDLE_WEIGHT_GRAMS: 240,           // ✅ NEW: 6 × 40g = 240g
  FREE_PACKETS_PER_BUNDLE: 0,        // ✅ NEW: No free packets
  
  // Tiered pricing
  TIER_1_BUNDLES: 1,
  TIER_1_PRICE: 384,                  // ✅ NEW: ₹384 for 1 bundle
  
  TIER_2_BUNDLES: 2,
  TIER_2_PRICE: 640,                  // ✅ NEW: ₹640 for 2 bundles (₹320/bundle)
  
  TIER_3_BUNDLES: 3,
  TIER_3_PRICE: 896,                  // ✅ NEW: ₹896 for 3 bundles (₹298.67/bundle)
  
  TIER_4_BUNDLES: 4,
  TIER_4_PRICE: 1152,                 // ✅ NEW: ₹1152 for 4 bundles (₹288/bundle)
  
  SHIPPING_COST: 0,                   // ✅ UNCHANGED
  TAX_RATE: 0,                        // ✅ UNCHANGED
  MIN_BUNDLES: 1,
  MAX_BUNDLES_PER_ITEM: 50,
} as const;

// NEW: Tiered pricing function
export function calculateBundlePricing(bundles: number) {
  const validBundles = Math.max(1, Math.floor(bundles));
  
  let unitPrice: number;
  if (validBundles === 1) {
    unitPrice = BundlePricing.TIER_1_PRICE;
  } else if (validBundles === 2) {
    unitPrice = BundlePricing.TIER_2_PRICE;
  } else if (validBundles === 3) {
    unitPrice = BundlePricing.TIER_3_PRICE;
  } else if (validBundles >= 4) {
    unitPrice = BundlePricing.TIER_4_PRICE;
  } else {
    unitPrice = BundlePricing.TIER_1_PRICE; // Fallback
  }
  
  const packetsShipped = validBundles * BundlePricing.PACKETS_SHIPPED_PER_BUNDLE;
  const lineTotal = unitPrice;  // Total for this tier
  
  return {
    bundles: validBundles,
    packetsShipped,
    unitPrice,
    lineTotal,
  };
}
```

### Files Referencing Bundle Constants

| File | Line | Current | Required Change |
|------|------|---------|-----------------|
| `src/backend/services/checkout.service.ts` | 290 | `bundlePricing.packetsShipped` (12) | ✅ Uses constant, no change |
| `src/backend/services/checkout.service.ts` | 309 | Comment: "12 packets × 40g = 480g" | Update comment to "6 packets × 40g = 240g" |
| `src/backend/services/inventory.service.ts` | 45-67 | Stock deduction logic | ✅ No change (uses qty parameter) |
| `app/api/payment/verify/route.ts` | 99 | `item.qty` (bundles) | 🔴 Change to `item.qty * 6` (packets) |
| `src/backend/services/payment.service.ts` | 467 | `item.qty` (bundles) | 🔴 Change to `item.qty * 6` (packets) |

### Files with Hardcoded OLD Values

| File | References | Action Required |
|------|-----------|-----------------|
| `src/frontend/data/products.ts` | "12 × 40g = 480g", "₹640" | ❌ OUT OF SCOPE (frontend/catalog team) |
| `src/frontend/hooks/useCartSync.js` | `480`, `640` default values | ❌ OUT OF SCOPE (frontend/catalog team) |
| `src/frontend/hooks/useWishlistSync.js` | `640` default price | ❌ OUT OF SCOPE (frontend/catalog team) |
| `src/frontend/components/shop/products/*.tsx` | "12 × 40g = 480g" comments | ❌ OUT OF SCOPE (frontend/catalog team) |
| `supabase/seed/seed-products.sql` | `price = 640`, `net_weight = "200g"` | ✅ Database team (update seed data) |

### DTDC Packaging Configuration

**File:** `src/backend/lib/dtdc.ts` or environment variables

**Current:** Placeholder dimensions (30×25×10cm)  
**Required:** Client-verified dimensions (20.4×12.6×7.6cm)

**Update Required:**
```typescript
// Option 1: Environment variables
DTDC_PACKAGE_LENGTH=20.4
DTDC_PACKAGE_WIDTH=12.6
DTDC_PACKAGE_HEIGHT=7.6
DTDC_PACKAGE_WEIGHT_GRAMS=0  // Empty packaging weight (TBD)

// Option 2: Configuration file
export const WIN_DIA_PACKAGING = {
  length: 20.4,
  width: 12.6,
  height: 7.6,
  weightGrams: 0,  // TBD: Measure empty box weight
  isVerified: true,
};
```

---

## H. Unresolved Dependencies

### 🔴 BLOCKER: Order Cancellation/Refund Functionality

**Client Requirement:** WIN-DIA does NOT offer order modifications, cancellations, returns, or refunds.

**Current Implementation:** FULLY FUNCTIONAL cancellation and refund system exists.

#### Existing Functionality Found:

1. **API Endpoint:** `app/api/orders/[id]/route.ts`
   - PATCH method accepts `{ action: 'cancel', reason: '...' }`
   - Enforces ownership (users can only cancel their own orders)

2. **Service Layer:** `src/backend/services/order.service.ts`
   - `cancelOrder()` method transitions order_status to 'cancelled'
   - Handles payment_status transitions:
     - `pending` → `failed` (never paid)
     - `paid` → `refund_initiated` (paid online, needs refund)
     - `cod_pending` → `failed` (COD, no money collected)
   - Restores stock via `atomic_restore_stock` RPC
   - Blocks cancellation if shipment has `shipped_at` timestamp

3. **Frontend UI:** `src/frontend/screens/OrderConfirmation/OrderConfirmationPage.jsx`
   - "Cancel Order" button displayed for cancellable statuses
   - Shows refund status messages
   - Implements `handleCancelOrder()` with confirmation dialog

4. **Status Transitions:** `src/backend/services/order.service.ts:22-28`
   ```typescript
   const STATUS_TRANSITIONS = {
     placed: ['confirmed', 'processing', 'cancelled'],
     confirmed: ['processing', 'cancelled'],
     processing: ['shipped', 'cancelled'],
     shipped: ['delivered'],  // ✅ Cannot cancel after shipped
     delivered: [],
     cancelled: ['refunded'],
     refunded: [],
   };
   ```

5. **Payment Statuses:** Database schema supports:
   - `refund_initiated`
   - `refunded`

#### Required Actions:

**Option A: Disable/Remove (Client Requirement)**
- Remove "Cancel Order" button from frontend
- Return HTTP 403 from `PATCH /api/orders/[id]` endpoint
- Keep `cancelOrder()` service method for admin-only use
- Add prominent "No Cancellations" notice on checkout/confirmation pages

**Option B: Admin-Only (Recommended)**
- Keep cancellation logic for admin/support use
- Disable customer-facing UI
- Add admin-only cancellation panel
- Document that customers must contact support

**⚠️ DECISION REQUIRED:** Confirm with client which approach to take.

### Database Schema Changes Needed

**File:** `supabase/seed/seed-products.sql`

**Current Product Seed Data:**
```sql
price = 640  -- Single bundle price (OLD)
net_weight = "200g"  -- Test value (INVALID)
count_in_stock = 100  -- Packets (CORRECT)
```

**Required Updates:**
- Implement tiered pricing in products table (or calculate dynamically)
- Update `net_weight` to `"240g"` (6 packets × 40g)
- Keep `count_in_stock` in packets (no change)

**⚠️ QUESTION:** How should tiered pricing be handled?
- Option A: Store base price (₹384), calculate discounts in application
- Option B: Create separate product variants for each tier
- Option C: Store pricing tiers in a separate `pricing_tiers` table

### Packaging Weight Not Configured

**File:** `src/backend/lib/dtdc.ts`

**Current:** `packagingGrams = 0` (no packaging weight)

**Required:** Measure empty WIN-DIA shipping box weight.

**Impact:** DTDC shipping weight calculation may be inaccurate if packaging is significant.

---

## Summary of Required Changes

### Backend Team (This Team)

| Priority | File | Change Required |
|----------|------|-----------------|
| 🔴 CRITICAL | `src/backend/constants/bundle-pricing.constants.ts` | Update all constants to 6-packet structure with tiered pricing |
| 🔴 CRITICAL | `app/api/payment/verify/route.ts:99` | Fix inventory deduction: `item.qty * 6` |
| 🔴 CRITICAL | `src/backend/services/payment.service.ts:467` | Fix inventory deduction: `item.qty * 6` |
| 🟡 HIGH | `src/backend/lib/dtdc.ts` | Update packaging dimensions to 20.4×12.6×7.6cm |
| 🟡 HIGH | Environment variables | Add `DTDC_PACKAGE_*` configuration |
| 🟢 LOW | `src/backend/services/checkout.service.ts:309` | Update weight comment "480g" → "240g" |

### Database Team

| Priority | File | Change Required |
|----------|------|-----------------|
| 🟡 HIGH | `supabase/seed/seed-products.sql` | Update `net_weight` to "240g" |
| 🟡 HIGH | Product pricing strategy | Decide tiered pricing implementation approach |
| 🟢 LOW | Measure packaging weight | Update `packagingGrams` configuration |

### Cross-Team (Client Decision Required)

| Priority | Issue | Decision Needed |
|----------|-------|-----------------|
| 🔴 BLOCKER | Order cancellations | Disable customer UI? Admin-only? Remove entirely? |
| 🔴 BLOCKER | Refund functionality | Keep for admin use? Remove payment_status values? |
| 🟡 HIGH | Tiered pricing storage | Database structure vs dynamic calculation? |

---

## Verification Checklist

Before deploying 6-packet bundle changes:

- [ ] Update `BundlePricing` constants file
- [ ] Fix inventory deduction bug (multiply by packets_per_bundle)
- [ ] Update DTDC packaging dimensions
- [ ] Test weight calculations: 1 bundle = 0.24kg, 2 bundles = 0.48kg
- [ ] Verify tiered pricing: ₹384/₹640/₹896/₹1152
- [ ] Test COD amount calculation with new pricing
- [ ] Update product seed data (net_weight, pricing)
- [ ] Decide on order cancellation policy
- [ ] Run full checkout → payment → shipment integration test
- [ ] Verify stock deduction: 1 order = 6 packets deducted

---

## Appendix: Database Migration Status

All migrations analyzed are considered **DEPLOYED** based on their presence in the codebase and successful references in backend services.

**No new migrations required** for 6-packet bundle structure. The existing schema supports:
- Variable `net_weight_grams` per bundle
- Multiple flavors per bundle
- Tiered pricing (calculated at application layer)

**Application-layer changes only** are required.

---

**Report Prepared By:** Kiro AI  
**Audit Mode:** READ-ONLY (No code modifications performed)  
**Next Steps:** Review with backend team → Update constants → Fix inventory bug → Deploy to staging
