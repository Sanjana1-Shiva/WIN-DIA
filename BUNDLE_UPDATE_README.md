# WIN-DIA Bundle Structure Update

## Overview
This update changes the product bundle structure from 12-packet bundles to 6-packet bundles with a new tiered pricing system.

## Changes Summary

### Product Structure
**OLD:**
- 1 bundle = 12 packets (12 × 40g = 480g)
- Price: ₹640 (10 paid + 2 free)
- Each packet: ₹64

**NEW:**
- 1 bundle = 6 packets (6 × 40g = 240g)
- Tiered pricing:
  - 1 bundle: ₹384 (no discount)
  - 2 bundles: ₹640 (2 packets free)
  - 3 bundles: ₹896 (4 packets free)
- Each packet: ₹64

### Ordering Rules
- Users can only order in multiples of 6 packets (6, 12, 18, 24...)
- Each bundle must be a single flavor
- Combo offers contain 6 packets with mixed flavors

### Combo Structure
**OLD:**
- 12 packets with 4 flavors (3 of each flavor)
- Fixed distribution

**NEW:**
- 6 packets per combo bundle
- Customer chooses flavor distribution:
  - Minimum 3 mandatory flavors must be selected
  - Remaining 3 can be user choice OR auto-filled if flavor unavailable
  - If a flavor is out of stock, exclude it and user picks from available

## Files Changed

### Frontend
1. **src/frontend/data/products.ts**
   - Updated all product definitions
   - Changed netWeight from 480g to 240g
   - Updated prices from ₹640 to ₹384
   - Changed packet count from 12 to 6
   - Removed discount offers for single bundles

2. **app/shop/page.tsx**
   - Updated product mapping
   - Changed default price to ₹384
   - Updated offer text to "6 × 40g Bundle"
   - Updated netWeight to 240g

### Backend/Database
1. **supabase/migrations/20250110_update_bundle_pricing.sql**
   - Replaced `calculate_windia_price()` function
   - New tiered pricing logic
   - Supports 1-6+ bundle calculations

### Database Changes Required

#### 1. Update Products Table
```sql
-- Update net weight for all regular products
UPDATE products 
SET net_weight = 240
WHERE slug IN ('jeera-thins', 'garlic-thins', 'onion-thins', 'curry-leaves-thins');

-- Update prices
UPDATE products 
SET price = 384
WHERE slug IN ('jeera-thins', 'garlic-thins', 'onion-thins', 'curry-leaves-thins');

-- Update combo
UPDATE products 
SET 
  net_weight = 240,
  price = 384,
  description = 'Choose your perfect mix! Pick from Garlic, Jeera, Onion, and Curry Leaves. 6 packets in one bundle.'
WHERE slug = 'windia-assorted-combo-v2';
```

#### 2. Update Inventory (if needed)
```sql
-- Inventory is tracked in individual packets
-- 1 old bundle (12 packets) = 2 new bundles (6 packets each)
-- No changes needed if inventory is already in packets
```

#### 3. Run the Migration
```bash
# Apply the pricing function update
supabase db push --include-all
```

## Validation Checklist

### Frontend Validation
- [ ] All product cards show "6 × 40g Bundle"
- [ ] Prices show ₹384 for single items
- [ ] Cart allows only multiples of 6
- [ ] Product detail pages show correct weights
- [ ] Combo offers explain the 6-packet structure

### Backend Validation  
- [ ] `calculate_windia_price(1)` returns 384
- [ ] `calculate_windia_price(2)` returns 640
- [ ] `calculate_windia_price(3)` returns 896
- [ ] Checkout validates bundle multiples
- [ ] Inventory deduction works with 6-packet bundles
- [ ] Combo selection validation works

### Database Validation
```sql
-- Verify pricing function
SELECT 
  bundle_count,
  calculate_windia_price(bundle_count) as price
FROM generate_series(1, 6) as bundle_count;

-- Expected results:
-- 1 -> 384
-- 2 -> 640
-- 3 -> 896
-- 4 -> 1280
-- 5 -> 1536
-- 6 -> 1792

-- Verify product data
SELECT slug, name, price, net_weight 
FROM products 
WHERE is_active = true
ORDER BY slug;
```

## Deployment Steps

### 1. Staging Deployment
1. Deploy to staging environment
2. Run database migration
3. Update product data
4. Test all ordering scenarios
5. Verify inventory deduction

### 2. Production Deployment
1. Schedule maintenance window (if needed)
2. Backup database
3. Deploy code changes
4. Run database migration
5. Update product data
6. Verify with test orders
7. Monitor for 24 hours

### 3. Post-Deployment
- [ ] Verify all product pages load
- [ ] Test complete purchase flow
- [ ] Check inventory deductions
- [ ] Monitor error logs
- [ ] Verify pricing calculations
- [ ] Test combo selection flow

## Rollback Plan

If issues arise:

1. **Frontend Rollback:**
```bash
git revert HEAD
git push origin main
```

2. **Database Rollback:**
```sql
-- Restore old pricing function (if backed up)
-- OR revert the migration
-- Update product prices back to ₹640
UPDATE products SET price = 640, net_weight = 480
WHERE slug IN ('jeera-thins', 'garlic-thins', 'onion-thins', 'curry-leaves-thins');
```

## Testing Scenarios

### Scenario 1: Single Bundle Purchase
- Add 1 Garlic bundle to cart
- Verify price: ₹384
- Complete checkout
- Verify inventory: 6 packets deducted

### Scenario 2: Two Bundle Purchase
- Add 2 Jeera bundles to cart  
- Verify price: ₹640 (discount applied)
- Complete checkout
- Verify inventory: 12 packets deducted

### Scenario 3: Three Bundle Purchase
- Add 3 Onion bundles to cart
- Verify price: ₹896 (discount applied)
- Complete checkout
- Verify inventory: 18 packets deducted

### Scenario 4: Combo Purchase
- Select combo
- Choose flavor distribution (min 3 flavors)
- Verify price: ₹384
- Complete checkout
- Verify inventory deducted correctly per flavor

### Scenario 5: Invalid Quantity
- Try to add 5 packets (not a multiple of 6)
- Should be rejected or auto-adjusted to 6

## Support Contacts

- **Frontend Issues:** Development Team
- **Backend Issues:** Backend Team  
- **Database Issues:** DBA Team
- **Business Questions:** Product Owner

## Notes

- Old orders with 12-packet bundles remain valid
- Historical data is preserved
- No automatic conversion of existing orders
- Customer communications planned separately
