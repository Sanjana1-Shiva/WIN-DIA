"use client";
import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCart } from "@/src/frontend/redux/slices/cartSlice";
import { useAuth } from "./useAuth";

/**
 * Syncs the frontend Redux cart with the backend Supabase cart.
 * 
 * On login: Fetches cart from backend API, merges/overrides local state.
 * On cart change: Pushes add/remove/update to backend in background.
 * 
 * The backend cart stores only product_id + quantity. Product details
 * (name, price, image) are fetched from /api/products when hydrating.
 */
export function useCartSync() {
  const dispatch = useDispatch();
  const { user, token, loading } = useAuth();
  const cartItems = useSelector((s) => s.cart.cartItems);
  const cartIdRef = useRef(null);
  const syncedRef = useRef(false);
  const prevCartRef = useRef([]);

  const authFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  }, [token]);

  // Fetch cart from backend when user logs in
  useEffect(() => {
    if (loading || !user || !token) {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;

    async function fetchBackendCart() {
      try {
        const res = await authFetch("/api/cart");
        const data = await res.json();

        if (!data.success || !data.data) return;

        const { cart, items } = data.data;
        if (!cart) return;
        cartIdRef.current = cart.id;

        if (!items || items.length === 0) {
          // Backend cart is empty — push local items to backend if any
          if (cartItems.length > 0) {
            for (const item of cartItems) {
              const productId = item._id || item.id;
              await authFetch("/api/cart", {
                method: "POST",
                body: JSON.stringify({
                  cart_id: cart.id,
                  product_id: productId,
                  quantity: item.qty || 1,
                }),
              }).catch(() => {});
            }
          }
          syncedRef.current = true;
          prevCartRef.current = cartItems;
          return;
        }

        // Backend has items — fetch product details to enrich them
        const enrichedItems = await enrichCartItems(items);
        
        // Merge: backend is source of truth, but keep local items not in backend
        const backendIds = new Set(enrichedItems.map((i) => i.id));
        const localOnly = cartItems.filter((i) => !backendIds.has(i.id) && !backendIds.has(i._id));

        // Push local-only items to backend
        for (const item of localOnly) {
          const productId = item._id || item.id;
          await authFetch("/api/cart", {
            method: "POST",
            body: JSON.stringify({
              cart_id: cart.id,
              product_id: productId,
              quantity: item.qty || 1,
            }),
          }).catch(() => {});
        }

        const merged = [...enrichedItems, ...localOnly];
        dispatch(setCart(merged));
        prevCartRef.current = merged;
        syncedRef.current = true;
      } catch (err) {
        console.warn("[useCartSync] Failed to sync cart from backend:", err);
        syncedRef.current = true;
      }
    }

    fetchBackendCart();
  }, [user, token, loading, authFetch, dispatch]);

  // Push cart changes to backend when items change
  useEffect(() => {
    if (!syncedRef.current || !cartIdRef.current || !token) return;

    const prev = prevCartRef.current;
    const current = cartItems;

    // Detect added/removed/updated items
    const prevMap = new Map(prev.map((i) => [i._id || i.id, i]));
    const currMap = new Map(current.map((i) => [i._id || i.id, i]));

    // Added or quantity changed
    for (const [id, item] of currMap) {
      const prevItem = prevMap.get(id);
      if (!prevItem) {
        // New item added
        authFetch("/api/cart", {
          method: "POST",
          body: JSON.stringify({
            cart_id: cartIdRef.current,
            product_id: id,
            quantity: item.qty || 1,
          }),
        }).catch(() => {});
      } else if (prevItem.qty !== item.qty) {
        // Quantity changed
        authFetch("/api/cart", {
          method: "PUT",
          body: JSON.stringify({
            cart_id: cartIdRef.current,
            product_id: id,
            quantity: item.qty,
          }),
        }).catch(() => {});
      }
    }

    // Removed items
    for (const [id] of prevMap) {
      if (!currMap.has(id)) {
        authFetch(`/api/cart?cartId=${cartIdRef.current}&productId=${id}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    }

    prevCartRef.current = current;
  }, [cartItems, token, authFetch]);

  return { cartId: cartIdRef.current };
}

/**
 * Enriches raw cart items (product_id + quantity) with product details
 * by fetching from the products API.
 */
async function enrichCartItems(items) {
  try {
    const productIds = items.map((i) => i.product_id);
    const res = await fetch(`/api/products?ids=${productIds.join(",")}`);
    const data = await res.json();
    const products = data?.data?.items ?? data?.data ?? data?.products ?? [];

    const productMap = new Map();
    if (Array.isArray(products)) {
      for (const p of products) {
        productMap.set(p.id, p);
      }
    }

    return items.map((item) => {
      const product = productMap.get(item.product_id);
      
      // Parse net_weight from product catalog
      let netWeight = 480; // Default: one bundle = 12 × 40g = 480g
      if (product?.net_weight) {
        if (typeof product.net_weight === "string") {
          const parsed = parseInt(product.net_weight.replace(/[^0-9]/g, ""), 10);
          if (!isNaN(parsed) && parsed > 0) {
            netWeight = parsed;
          }
        } else if (typeof product.net_weight === "number" && product.net_weight > 0) {
          netWeight = product.net_weight;
        }
      }
      
      return {
        id: item.product_id,
        _id: item.product_id,
        name: product?.name || product?.flavor ? `${product.flavor} Flavour` : "WIN-DIA Product",
        price: product?.price || 640,
        image: product?.image || product?.image_url || "/images/product-methi.jpg",
        flavor: product?.flavor || null,
        qty: item.quantity || 1,
        countInStock: product?.count_in_stock || 100,
        netWeight,
      };
    });
  } catch {
    // Fallback: return items with minimal data
    return items.map((item) => ({
      id: item.product_id,
      _id: item.product_id,
      name: "WIN-DIA Product",
      price: 640,
      image: "/images/product-methi.jpg",
      qty: item.quantity || 1,
    }));
  }
}
