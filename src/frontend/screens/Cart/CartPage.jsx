"use client";
import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiShoppingCart, FiTrash2, FiPlus, FiMinus, FiArrowRight,
  FiArrowLeft, FiTruck, FiShield, FiHeart, FiPackage, FiTag
} from "react-icons/fi";
import toast from "react-hot-toast";
import { removeFromCart, updateQuantity, setCart, addToCart, setPromoApplied, setPromoCode } from "@/src/frontend/redux/slices/cartSlice";
import { addToWishlist } from "@/src/frontend/redux/slices/wishlistSlice";
import styles from "./CartPage.module.css";

const FREE_THRESHOLD = 0; // Free delivery always — no threshold needed

export default function CartPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { cartItems } = useSelector((s) => s.cart);
  const { wishlistItems } = useSelector((s) => s.wishlist);
  const [mounted, setMounted] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    // Cart is hydrated by the Persistence component in providers.jsx (user-scoped).
    // No need to re-hydrate from localStorage here.
    setMounted(true);
  }, []);

  // Helper function to calculate bundle price
  const getBundlePrice = (bundles) => {
    if (bundles === 1) return 384;
    if (bundles === 2) return 640;
    if (bundles === 3) return 896;
    if (bundles === 4) return 1152;
    if (bundles === 5) return 1408;
    if (bundles >= 6) return 1664 + ((bundles - 6) * 256);
    return 0;
  };

  // Calculate totals ONLY after mounted
  const totalBundles = mounted ? cartItems.reduce((sum, item) => sum + (item.qty || 0), 0) : 0;
  const subtotal = mounted ? getBundlePrice(totalBundles) : 0;
  const discount = promoApplied ? subtotal * 0.1 : 0;
  const shipping = 0; // FREE DELIVERY — always ₹0
  const total = subtotal - discount + shipping;
  const progress = 100; // Always free shipping
  const remaining = 0;

  // Calculate total packets in cart (each bundle = 6 packets)
  const totalPackets = totalBundles * 6;
  
  const isMultipleOfSix = totalPackets % 6 === 0 || totalPackets === 0;
  const packetsToAdd = isMultipleOfSix ? 0 : 6 - (totalPackets % 6);
  const packetsToRemove = isMultipleOfSix ? 0 : totalPackets % 6;

  const handleQty = useCallback((id, delta, curr, stock) => {
    const n = curr + delta;
    if (n < 1) return;
    if (n > stock) { toast.error(`Only ${stock} in stock`); return; }
    dispatch(updateQuantity({ id, qty: n }));
  }, [dispatch]);

  const handleRemove = (id, name) => {
    const removed = cartItems.find((i) => (i._id || i.id) === id);
    dispatch(removeFromCart(id));
    toast((t) => (
      <span className={styles.undoToast}>
        <span>Removed <strong>{name}</strong></span>
        <button onClick={() => { dispatch(addToCart(removed)); toast.dismiss(t.id); }}>Undo</button>
      </span>
    ), { duration: 4000 });
  };

  const handleSaveLater = (item) => {
    dispatch(removeFromCart(item._id || item.id));
    if (!wishlistItems.some((w) => (w._id || w.id) === (item._id || item.id))) {
      dispatch(addToWishlist(item));
      toast.success(`Saved to wishlist`);
    } else {
      toast(`Removed from cart`);
    }
  };

  const handleApplyPromo = async () => {
    if (!promo.trim()) {
      toast.error("Please enter a promo code");
      return;
    }
    
    setPromoLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promo.trim(),
          cart_total: subtotal,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setPromoApplied(true);
        dispatch(setPromoApplied(true)); // Save to Redux for checkout page
        dispatch(setPromoCode(promo.trim())); // Save code to Redux
        toast.success(`Promo applied! You saved ₹${data.data.discount_amount.toFixed(0)}`);
      } else {
        toast.error(data.error || "Invalid promo code");
      }
    } catch (error) {
      toast.error("Failed to apply promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCheckout = () => {
    if (!cartItems.length) return;
    
    // Validate cart has multiple of 6 packets
    if (!isMultipleOfSix) {
      if (packetsToAdd > 0) {
        toast.error(
          `Please add ${packetsToAdd} more packet${packetsToAdd > 1 ? 's' : ''} (${Math.ceil(packetsToAdd / 6)} bundle${Math.ceil(packetsToAdd / 6) > 1 ? 's' : ''}) to proceed. Orders must be in multiples of 6 packets.`,
          { duration: 5000 }
        );
      } else {
        toast.error(
          `Please remove ${packetsToRemove} packet${packetsToRemove > 1 ? 's' : ''} to proceed. Orders must be in multiples of 6 packets.`,
          { duration: 5000 }
        );
      }
      return;
    }
    
    router.push("/checkout");
  };

  if (!mounted) return <div className={styles.skeleton}><div className={styles.skeletonBar} /><div className={styles.skeletonBar} /></div>;

  if (!cartItems.length) return (
    <div className={styles.emptyWrap}>
      <motion.div className={styles.emptyCard} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.emptyIcon}><FiShoppingCart /></div>
        <h2>Your cart is empty</h2>
        <p>Explore our premium Thins collection</p>
        <Link href="/shop" className={styles.shopBtn}>Explore Shop <FiArrowRight /></Link>
      </motion.div>
    </div>
  );

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <Link href="/shop" className={styles.backLink}><FiArrowLeft /> Continue Shopping</Link>
            <div className={styles.headerTitle}>
              <h1>Your <span className="gold-text">Cart</span></h1>
              <span className={styles.itemCount}>{cartItems.length} item{cartItems.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Free shipping bar */}
          <div className={styles.shippingBar}>
            {remaining > 0 ? (
              <>
                <p className={styles.shippingText}>
                  <FiTruck /> Add <strong>₹{remaining.toFixed(0)}</strong> more for free shipping
                </p>
                <div className={styles.progressTrack}>
                  <motion.div className={styles.progressFill} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
                </div>
              </>
            ) : (
              <p className={styles.shippingFree}><FiTruck /> You have unlocked <strong>free shipping!</strong></p>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="container">
        <div className={styles.layout}>

          {/* Items */}
          <div className={styles.itemsCol}>
            <AnimatePresence>
              {cartItems.map((item) => {
                const id = item._id || item.id;
                return (
                  <motion.div
                    key={id}
                    className={styles.item}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0 }}
                    layout
                  >
                    <Link href={`/product/${id}`} className={styles.itemImg}>
                      <img src={item.image || "/images/product-methi.jpg"} alt={item.name} />
                    </Link>

                    <div className={styles.itemInfo}>
                      <Link href={`/product/${id}`} className={styles.itemName}>{item.name}</Link>
                      {item.flavor && <p className={styles.itemFlavor}>{item.flavor}</p>}
                      {item.netWeight && <p className={styles.itemWeight}>{item.netWeight}g</p>}

                      {/* Combo Flavor Breakdown */}
                      {item.flavorSelections && (
                        <div className={styles.flavorBreakdown}>
                          <p className={styles.flavorBreakdownTitle}>📦 Your Combo Selection:</p>
                          <ul className={styles.flavorList}>
                            {Object.entries(item.flavorSelections)
                              .filter(([_, count]) => count > 0)
                              .map(([flavorId, count]) => {
                                const flavorNames = {
                                  'curry-leaves': 'Curry Leaves',
                                  'garlic': 'Garlic',
                                  'jeera': 'Jeera',
                                  'onion': 'Onion'
                                };
                                return (
                                  <li key={flavorId}>
                                    <strong>{flavorNames[flavorId] || flavorId}:</strong> {count} packet{count > 1 ? 's' : ''} ({count * 40}g)
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}

                      <div className={styles.itemBadges}>
                        {item.isLowGI && <span className={styles.badge}>Low GI</span>}
                        {item.isGlutenFree && <span className={styles.badge}>Gut Healthy</span>}
                        {item.isVegan && <span className={styles.badge}>Vegan</span>}
                      </div>

                      <div className={styles.itemPriceRow}>
                        <span className={styles.itemPrice}>₹{item.price}</span>
                        {item.originalPrice > item.price && <span className={styles.itemOriginal}>₹{item.originalPrice}</span>}
                      </div>

                      <div className={styles.itemActions}>
                        <button className={styles.saveLaterBtn} onClick={() => handleSaveLater(item)}>
                          <FiHeart /> Save for later
                        </button>
                      </div>
                    </div>

                    <div className={styles.itemRight}>
                      <div className={styles.qtyControl}>
                        <button onClick={() => handleQty(id, -1, item.qty, item.countInStock || 99)}><FiMinus /></button>
                        <span>{item.qty}</span>
                        <button onClick={() => handleQty(id, 1, item.qty, item.countInStock || 99)}><FiPlus /></button>
                      </div>
                      <p className={styles.itemTotal}>₹{(item.price * item.qty).toFixed(0)}</p>
                      <button className={styles.removeBtn} onClick={() => handleRemove(id, item.name)} aria-label="Remove"><FiTrash2 /></button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div className={styles.summaryCol}>
            <div className={styles.summaryCard}>
              <h3>Order Summary</h3>
              <div className="gold-divider" style={{ margin: "12px 0 20px" }} />

              {/* Promo */}
              <div className={styles.promoSection}>
                <div className={styles.promoRow}>
                  <FiTag />
                  <input
                    type="text"
                    placeholder="Promo code"
                    value={promo}
                    onChange={(e) => setPromo(e.target.value)}
                    disabled={promoApplied}
                    className={styles.promoInput}
                  />
                  {!promoApplied ? (
                    <button 
                      className={styles.promoBtn} 
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promo.trim()}
                    >
                      {promoLoading ? "..." : "Apply"}
                    </button>
                  ) : (
                    <button className={styles.promoRemove} onClick={() => { 
                      setPromoApplied(false); 
                      setPromo(""); 
                      dispatch(setPromoApplied(false)); // Clear from Redux
                      dispatch(setPromoCode("")); // Clear code from Redux
                    }}>Remove</button>
                  )}
                </div>
                {promoApplied && <p className={styles.promoSuccess}>✓ {promo.toUpperCase()} applied</p>}
              </div>

              {/* Breakdown */}
              <div className={styles.breakdown}>
                <div className={styles.bRow}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                {promoApplied && <div className={`${styles.bRow} ${styles.bDiscount}`}><span>Discount</span><span>−₹{discount.toFixed(2)}</span></div>}
                <div className={styles.bRow}><span>Shipping</span><span className={shipping === 0 ? styles.free : ""}>{shipping === 0 ? "FREE" : `₹${shipping}`}</span></div>
              </div>

              <div className={styles.totalRow}>
                <span>Total <small style={{ fontWeight: 400, opacity: 0.7 }}>(GST included)</small></span>
                <span>₹{total.toFixed(2)}</span>
              </div>

              <button className={styles.checkoutBtn} onClick={handleCheckout}>
                Proceed to Checkout <FiArrowRight />
              </button>

              {/* Cart validation message */}
              {!isMultipleOfSix && (
                <div className={styles.validationMessage}>
                  <FiPackage />
                  <div>
                    <strong>Cart contains {totalPackets} packet{totalPackets !== 1 ? 's' : ''}</strong>
                    <p>
                      {packetsToAdd > 0 
                        ? `Add ${packetsToAdd} more packet${packetsToAdd > 1 ? 's' : ''} to proceed`
                        : `Remove ${packetsToRemove} packet${packetsToRemove > 1 ? 's' : ''} to proceed`
                      }
                    </p>
                    <small>Orders must be in multiples of 6 packets (1 bundle = 6 packets)</small>
                  </div>
                </div>
              )}

              {isMultipleOfSix && cartItems.length > 0 && (
                <div className={styles.readyMessage}>
                  <FiPackage />
                  <span>✓ Cart ready! {totalPackets} packets ({totalPackets / 6} bundle{totalPackets / 6 > 1 ? 's' : ''})</span>
                </div>
              )}

              <div className={styles.trustRow}>
                <span><FiShield /> Secure Payment</span>
                <span><FiTruck /> Pan India Delivery</span>
                <span><FiPackage /> Easy Returns</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


