# WIN-DIA Testing Guide

## ✅ Features Now Live & Ready to Test

### 1. Combo Flavor Selection
**Where to find it:** Go to Shop page → Scroll to "The Combo Offer" section

**How to test:**
1. Click the **+ button** (or increment quantity) on the combo product
2. **Modal will appear** asking you to select flavors
3. Try selecting flavors by clicking **+** and **−** buttons
4. Watch the progress bar fill up as you select packets
5. Try these scenarios:

#### Test Scenarios:

**✅ Valid Selection:**
- Select: Jeera (2), Garlic (2), Onion (2) = **6 packets, 3 flavors** ✓
- Button should turn green and say "Confirm Selection"
- Click confirm → Combo should be added to cart

**❌ Invalid - Not Enough Packets:**
- Select: Jeera (1), Garlic (1), Onion (1) = **3 packets**
- Should show: "⚠️ Please select exactly 6 packets (3 packets more)"
- Confirm button disabled

**❌ Invalid - Too Few Flavors:**
- Select: Jeera (3), Garlic (3) = **6 packets, only 2 flavors**
- Should show: "⚠️ Please select at least 3 different flavors (currently 2)"
- Confirm button disabled

**✅ Valid - Uneven Distribution:**
- Select: Jeera (3), Garlic (2), Curry Leaves (1) = **6 packets, 3 flavors** ✓
- Should work fine!

**✅ Valid - All 4 Flavors:**
- Select: Jeera (2), Garlic (2), Onion (1), Curry Leaves (1) = **6 packets, 4 flavors** ✓
- Should work perfectly!

---

### 2. Cart Validation (6-Packet Multiples)
**Where to find it:** Add products to cart → Go to Cart page

**How to test:**

#### Test Scenarios:

**✅ Valid Cart - 6 Packets (1 Bundle):**
- Add 1 regular product (Garlic, Jeera, Onion, or Curry Leaves)
- Go to cart
- Should show: "✓ Cart ready! 6 packets (1 bundle)" in green box
- Checkout button should work

**✅ Valid Cart - 12 Packets (2 Bundles):**
- Add 2 of the same flavor OR 1 of two different flavors
- Should show: "✓ Cart ready! 12 packets (2 bundles)"
- Checkout should work

**❌ Invalid Cart - 5 Packets:**
- Add 1 Garlic, then remove using cart quantity controls until you somehow have 5 packets
- Should show yellow warning: "Add 1 more packet to proceed"
- Checkout button still clickable but will show error toast

**❌ Invalid Cart - 7 Packets:**
- Should show: "Remove 1 packet to proceed"
- Cannot checkout

**❌ Invalid Cart - 11 Packets:**
- Should show: "Remove 5 packets to proceed"
- Cannot checkout

**✅ Valid Cart - 1 Combo:**
- Add 1 combo with flavor selection
- Should show: "✓ Cart ready! 6 packets (1 bundle)"
- Checkout works

**✅ Valid Cart - Mixed Products:**
- Add 1 Garlic (6 packets) + 1 Jeera (6 packets) = 12 packets total
- Should show: "✓ Cart ready! 12 packets (2 bundles)"
- Checkout works

---

## 🎯 Visual Indicators to Look For

### Combo Modal:
- ✅ Progress bar fills as you select packets
- ✅ Checkmark appears on selected flavors
- ✅ Counter shows X / 6 packets
- ✅ "X flavor(s)" count updates
- ✅ Confirm button changes color when valid (gold/green)
- ✅ Warning messages appear for invalid selections

### Cart Page:
- ✅ Yellow box with warning icon when invalid
- ✅ Green box with checkmark when valid
- ✅ Shows exact packet count
- ✅ Shows how many more to add or remove
- ✅ Toast error when trying to checkout with invalid cart

---

## 🐛 Known Issues / Limitations

### Current Limitations:
1. **Stock data is hardcoded** - All flavors show 100 packets available
   - *Fix needed:* Connect to real database inventory
   
2. **Combo selections not sent to backend** - Selections are stored in cart but not yet sent to checkout API
   - *Fix needed:* Backend team needs to integrate with database RPCs

3. **Price doesn't update for bulk orders** - Still shows per-bundle price, doesn't calculate discount
   - *Fix needed:* Implement tiered pricing (1 bundle = ₹384, 2 = ₹640, 3 = ₹896)

4. **Can't see combo flavor breakdown in cart** - Cart shows combo but doesn't display which flavors selected
   - *Enhancement:* Add flavor breakdown display in cart items

---

## 📱 Mobile Testing

### On Mobile Device:
1. **Combo Modal:**
   - Should be full screen
   - Easy to tap +/− buttons
   - Scrollable if needed
   - Close button visible

2. **Cart Validation:**
   - Warning/success messages readable
   - Not too wide or cut off
   - Buttons still accessible

---

## ✅ Success Criteria

**Consider this feature working if:**
- [ ] Clicking combo + button opens modal
- [ ] Can select 6 packets from 3+ flavors
- [ ] Invalid selections show clear error messages
- [ ] Confirm button only works when valid
- [ ] Combo appears in cart after selection
- [ ] Cart shows validation warnings for non-6-multiples
- [ ] Can't checkout with invalid cart
- [ ] Can checkout with valid cart (6, 12, 18, etc packets)

---

## 🚀 Next Steps After Testing

1. **If it works:** Great! Just need backend integration
2. **If issues found:** Document them and we'll fix
3. **Backend integration:** Connect to database RPCs for:
   - Real stock data
   - Combo selection storage
   - Order processing with selections

---

## 🆘 Troubleshooting

**Modal doesn't appear:**
- Check browser console for errors
- Make sure you're clicking the combo product (not regular products)
- Refresh the page

**Cart validation not working:**
- Check if cart has items
- Look at browser console
- Verify cart items have `qty` field

**TypeScript errors:**
- Run `npx tsc --noEmit` to check
- Should pass with no errors

---

**Ready to test!** 🎉

Start with adding a combo to cart and see the modal appear!
