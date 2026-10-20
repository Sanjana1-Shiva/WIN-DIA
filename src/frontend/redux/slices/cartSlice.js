import { createSlice } from "@reduxjs/toolkit";

const getId = (item) => item?._id || item?.id;

// Generate unique ID for combo products based on flavor selections
const getUniqueComboId = (item) => {
  if (!item.flavorSelections) return getId(item);
  
  // Create a signature from the flavor selections
  // Sort entries to ensure consistent ordering
  const signature = Object.entries(item.flavorSelections)
    .filter(([_, count]) => count > 0) // Only include flavors with count > 0
    .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
    .map(([flavor, count]) => `${flavor}:${count}`)
    .join('|');
  
  return `${getId(item)}_${signature}`;
};

const normalize = (item, qty = 1) => {
  const baseItem = { 
    ...item, 
    _id: item?._id || item?.id, 
    id: item?.id || item?._id, 
    qty: Number(item?.qty || qty || 1) 
  };
  
  // For combo products with flavor selections, generate unique cart ID
  if (baseItem.flavorSelections) {
    baseItem.cartId = getUniqueComboId(baseItem);
  }
  
  return baseItem;
};

const cartSlice = createSlice({
  name: "cart",
  initialState: { cartItems: [], buyNowItem: null, shippingAddress: null, paymentMethod: null, promoApplied: false, promoCode: "" },
  reducers: {
    setCart: (s, a) => { s.cartItems = Array.isArray(a.payload) ? a.payload.map((i) => normalize(i)) : []; },
    addToCart: {
      reducer: (s, a) => {
        const item = normalize(a.payload.product || a.payload, a.payload.qty);
        
        // For combo products with flavor selections, match by unique cartId
        // For regular products, match by standard ID
        const matchId = item.cartId || getId(item);
        const existing = s.cartItems.find((c) => {
          const existingMatchId = c.cartId || getId(c);
          return existingMatchId === matchId;
        });
        
        if (existing) {
          // Item already exists, just increment quantity
          existing.qty += Number(item.qty || 1);
        } else {
          // New item, add to cart
          s.cartItems.push(item);
        }
      },
      prepare: (product, qty = 1) => ({ payload: { product, qty } }),
    },
    setBuyNowItem: (s, a) => { s.buyNowItem = a.payload ? normalize(a.payload.product || a.payload, a.payload.qty || 1) : null; },
    clearBuyNowItem: (s) => { s.buyNowItem = null; },
    removeFromCart: (s, a) => { 
      s.cartItems = s.cartItems.filter((i) => {
        const itemId = i.cartId || getId(i);
        return itemId !== a.payload;
      });
    },
    updateQuantity: (s, a) => { 
      const item = s.cartItems.find((i) => {
        const itemId = i.cartId || getId(i);
        return itemId === a.payload.id;
      });
      if (item) item.qty = Math.max(1, Number(a.payload.qty));
    },
    clearCart: (s) => { s.cartItems = []; },
    saveShippingAddress: (s, a) => { s.shippingAddress = a.payload; },
    savePaymentMethod: (s, a) => { s.paymentMethod = a.payload; },
    setPromoApplied: (s, a) => { 
      s.promoApplied = Boolean(a.payload); 
      if (!a.payload) s.promoCode = ""; // Clear code when removing promo
    },
    setPromoCode: (s, a) => { s.promoCode = a.payload || ""; },
  },
});

export const { setCart, addToCart, setBuyNowItem, clearBuyNowItem, removeFromCart, updateQuantity, clearCart, saveShippingAddress, savePaymentMethod, setPromoApplied, setPromoCode } = cartSlice.actions;
export default cartSlice.reducer;
