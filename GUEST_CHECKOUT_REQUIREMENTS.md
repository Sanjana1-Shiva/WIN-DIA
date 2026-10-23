# Guest Checkout - Requirements & Implementation

## Current Situation

**❌ Guest Checkout NOT Supported**
- Frontend blocks checkout if not logged in
- Backend API requires authentication token
- Both shipping and payment depend on user_id

---

## What Needs to Change

### 1. Frontend Changes

**File: `src/frontend/screens/Checkout/CheckoutPage.jsx`**

Current code (line 223):
```javascript
if (!user) {
  toast.error("Please login before placing the order");
  router.push("/login?next=/checkout");
  return;
}
```

**New logic needed:**
```javascript
// Allow both logged-in and guest users
const isGuest = !user;

// For guests, use localStorage address
// For logged-in, use saved addresses from database
```

### 2. Backend API Changes

**File: `app/api/orders/route.ts`**

Current code (line 20-23):
```typescript
const authRes = await getAuthUserContext(request);
if (!authRes.success) {
  return handleServiceResult(authRes);
}
```

**New logic needed:**
```typescript
// Try to get authenticated user, but allow guest
const authRes = await getAuthUserContext(request);
const userId = authRes.success ? authRes.value.id : null;
const isGuest = !userId;

// For guests, generate a session ID
const sessionId = isGuest ? generateSessionId() : null;
```

### 3. Database Schema Changes

**Orders table** needs to handle guests:

Current:
```sql
user_id UUID NOT NULL REFERENCES users(id)
```

**Change to:**
```sql
user_id UUID NULLABLE REFERENCES users(id)
guest_email TEXT
guest_phone TEXT
session_id TEXT -- For guest tracking
```

Migration needed:
```sql
ALTER TABLE orders 
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN guest_email TEXT,
  ADD COLUMN guest_phone TEXT,
  ADD COLUMN session_id TEXT;
```

### 4. Checkout Service Changes

**File: `src/backend/services/checkout.service.ts`**

The `processCheckout()` method expects `userId` (required).

**New signature needed:**
```typescript
async processCheckout(
  userId: string | null,  // null for guests
  dto: CreateOrderDTO & { guestEmail?: string; guestPhone?: string; sessionId?: string }
)
```

**Logic changes:**
- If `userId` is null, create guest order
- Store `guest_email` and `guest_phone` from request
- Generate unique `session_id` for tracking
- Allow order without user_id

### 5. Shipping Logic (DTDC)

**✅ NO CHANGES NEEDED!**

DTDC only needs:
- Shipping address (name, phone, address, city, state, pincode)
- Order items
- Payment method

**It doesn't care if the user is logged in or guest!**

All this info is in the order, so shipping will work as-is.

### 6. Payment Logic (Razorpay)

**✅ NO CHANGES NEEDED!**

Razorpay only needs:
- Order amount
- Order ID (our internal order number)
- Customer phone/email (for prefill)

**It doesn't care if the user is logged in or guest!**

Current code already handles this correctly.

### 7. Auto-Shipment Logic

**File: `src/backend/services/auto-shipment.util.ts`**

Current code (line 30):
```typescript
const { data: order, error: orderError } = await client
  .from('orders')
  .select('*, order_items(*)')
  .eq('id', orderId)
  .eq('user_id', userId)  // ← This will fail for guests!
  .single();
```

**Change to:**
```typescript
const { data: order, error: orderError } = await client
  .from('orders')
  .select('*, order_items(*)')
  .eq('id', orderId)
  // Remove user_id check - allow guests
  .single();
```

---

## Implementation Steps

### Phase 1: Database Migration (DB Team)
```sql
-- 1. Make user_id nullable
ALTER TABLE orders 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add guest fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 3. Add index for guest lookups
CREATE INDEX IF NOT EXISTS idx_orders_session_id 
  ON orders(session_id) 
  WHERE session_id IS NOT NULL;

-- 4. Add constraint: either user_id OR guest info must exist
ALTER TABLE orders
  ADD CONSTRAINT orders_user_or_guest_check
  CHECK (
    user_id IS NOT NULL 
    OR (guest_email IS NOT NULL AND guest_phone IS NOT NULL)
  );
```

### Phase 2: Backend Changes (Your Team)

**Step 1:** Update order creation API to accept guest orders

**Step 2:** Update checkout service to handle guest users

**Step 3:** Update auto-shipment to work without user_id check

**Step 4:** Add session tracking for guest cart persistence

### Phase 3: Frontend Changes (Your Team)

**Step 1:** Remove login requirement from checkout page

**Step 2:** Add guest email/phone collection form

**Step 3:** Store guest info in localStorage

**Step 4:** Pass guest info to order API

---

## Guest Checkout Flow

### For Guest Users:

1. **Add to Cart** → Stored in localStorage
2. **Go to Checkout** → Enter email, phone, shipping address
3. **Select Payment** → COD or Online
4. **Place Order** → Creates order with `user_id = NULL`
5. **Payment (if online)** → Razorpay processes normally
6. **Auto-Shipment** → DTDC creates shipment automatically
7. **Order Confirmation** → Guest gets order number & tracking

### Guest Order Tracking:

**Option A:** Email link
- Send email with unique tracking URL
- URL: `https://windiafoods.com/track/{sessionId}/{orderId}`

**Option B:** Order number + email
- Guest enters order number + email to track
- Query: `SELECT * FROM orders WHERE order_number = ? AND guest_email = ?`

---

## Security Considerations

### ✅ Prevent Abuse:

1. **Rate Limiting**
   - Limit guest orders per IP (max 5 per day)
   - Prevent automated abuse

2. **Email Verification** (Optional)
   - Send OTP to guest email before checkout
   - Verify phone via SMS OTP

3. **Session Expiry**
   - Guest sessions expire after 7 days
   - Clear abandoned guest carts

### ✅ Data Privacy:

- Don't store guest payment info (Razorpay handles this)
- Allow guests to delete their data
- Guest orders can't access other orders

---

## Testing Checklist

### Guest COD Order:
- [ ] Can add items to cart without login
- [ ] Can enter email, phone, address at checkout
- [ ] Can place COD order as guest
- [ ] Order stores guest_email and guest_phone
- [ ] DTDC creates shipment automatically
- [ ] Guest receives order confirmation email
- [ ] Guest can track order with order number + email

### Guest Online Payment Order:
- [ ] Can enter payment details
- [ ] Razorpay prefills guest email/phone
- [ ] Payment processes successfully
- [ ] Order status updates to "paid"
- [ ] DTDC creates shipment after payment
- [ ] Guest receives payment & shipping confirmation

### Guest to Registered User:
- [ ] Guest places order
- [ ] Guest creates account later
- [ ] Old guest orders can be linked to new account (optional feature)

---

## Estimated Effort

**Database Migration:** 30 minutes (DB team)
**Backend Changes:** 4-6 hours
**Frontend Changes:** 3-4 hours
**Testing:** 2-3 hours

**Total:** ~1-2 days of development

---

## Recommendation

**For MVP (Minimum Viable Product):**
✅ Allow guest checkout
✅ Collect email & phone
✅ Create order with guest info
✅ Auto-shipment works as-is
✅ Payment works as-is
❌ Skip email verification (add later)
❌ Skip guest order linking (add later)

**This way, shipping and payment logic needs ZERO changes!**

---

## Summary

**Shipping:** ✅ NO CHANGES NEEDED (DTDC doesn't care about user auth)
**Payment:** ✅ NO CHANGES NEEDED (Razorpay doesn't care about user auth)
**Database:** ⚠️ NEEDS MIGRATION (make user_id nullable, add guest fields)
**Backend:** ⚠️ NEEDS UPDATES (accept guest orders, remove user_id checks)
**Frontend:** ⚠️ NEEDS UPDATES (remove login requirement, collect guest info)

**Good news:** Shipping and payment will work automatically once you support guest orders!
