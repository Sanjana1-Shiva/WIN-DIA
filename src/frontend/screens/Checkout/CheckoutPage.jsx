"use client";
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowLeft, FiCheck, FiPlus, FiHome, FiBriefcase,
  FiMapPin, FiTruck, FiShield, FiCreditCard, FiPackage,
  FiChevronRight, FiLoader, FiTag
} from "react-icons/fi";
import toast from "react-hot-toast";
import { saveShippingAddress, savePaymentMethod, clearCart, clearBuyNowItem, setPromoApplied, setPromoCode } from "@/src/frontend/redux/slices/cartSlice";
import { useAuth } from "@/src/frontend/hooks/useAuth";
import { validateAddress } from "@/src/frontend/lib/validation";
import styles from "./CheckoutPage.module.css";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
const LOCAL_ADDRESS_KEY = "checkoutAddress";

function loadRazorpay() {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`)) { resolve(true); return; }
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT; s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const STATES = ["Karnataka","Tamil Nadu","Kerala","Maharashtra","Delhi","Gujarat","Rajasthan","Uttar Pradesh","West Bengal","Telangana","Andhra Pradesh","Madhya Pradesh","Bihar","Punjab","Haryana","Odisha","Assam","Other"];

export default function CheckoutPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { cartItems, buyNowItem, promoApplied, promoCode } = useSelector((s) => s.cart);
  const { user, authFetch } = useAuth();

  // If buyNowItem is set, checkout only that single item; otherwise use full cart
  const checkoutItems = buyNowItem ? [buyNowItem] : cartItems;

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [payMethod, setPayMethod] = useState("razorpay");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState(promoApplied ? (promoCode || "WINDIA10") : "");
  const [couponApplied, setCouponApplied] = useState(promoApplied);
  const [couponLoading, setCouponLoading] = useState(false);

  const [form, setForm] = useState({ type: "home", name: "", street: "", city: "", state: "Karnataka", pincode: "", phone: "", isDefault: false });

  // Handle coupon application
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          cart_total: subtotal,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCouponApplied(true);
        dispatch(setPromoApplied(true)); // Save to Redux
        dispatch(setPromoCode(couponCode.trim())); // Save code to Redux
        toast.success(`Coupon applied! You saved ₹${data.data.discount_amount.toFixed(0)}`);
      } else {
        toast.error(data.error || "Invalid coupon code");
      }
    } catch (error) {
      toast.error("Failed to apply coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(false);
    setCouponCode("");
    dispatch(setPromoApplied(false)); // Clear from Redux
    dispatch(setPromoCode("")); // Clear code from Redux
    toast.success("Coupon removed");
  };

  // Load addresses
  useEffect(() => {
    const localAddress = (() => {
      try { return JSON.parse(localStorage.getItem(LOCAL_ADDRESS_KEY) || "null"); } catch { return null; }
    })();

    if (!user) {
      if (localAddress) {
        Promise.resolve().then(() => {
          setAddresses([localAddress]);
          setSelectedAddr(localAddress._id);
        });
      }
      return;
    }

    localStorage.removeItem(LOCAL_ADDRESS_KEY);
    setAddresses([]);
    setSelectedAddr(null);
    authFetch("/api/addresses").then((r) => r.json()).then((d) => {
      const rawAddresses = d.addresses || d.data || [];
      if (rawAddresses.length > 0) {
        const normalized = rawAddresses.map((a) => ({
          ...a,
          _id: a.id,
          name: a.full_name || a.name,
          street: a.address_line1 || a.street,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          phone: a.phone,
          type: a.type || "home",
          isDefault: a.is_default,
        }));
        setAddresses(normalized);
        const def = normalized.find((a) => a.isDefault) || normalized[0];
        if (def) setSelectedAddr(def._id);
      }
    }).catch(() => toast.error("Could not load addresses"));
  }, [user]);

  const saveLocalAddress = () => {
    const localId = `local-${Date.now()}`;
    const saved = {
      ...form,
      _id: localId,
      id: localId,
      is_default: form.isDefault,
      isDefault: form.isDefault,
    };
    localStorage.setItem(LOCAL_ADDRESS_KEY, JSON.stringify(saved));
    setAddresses((prev) => [saved, ...prev.filter((a) => !String(a._id || a.id).startsWith("local-"))]);
    setSelectedAddr(saved._id);
    setShowForm(false);
    setForm({ type: "home", name: "", street: "", city: "", state: "Karnataka", pincode: "", phone: "", isDefault: false });
    setFormErrors({});
    return saved;
  };

  // Calculations — SERVER-SIDE is the source of truth, this is display only
  // IMPORTANT: Cart items may have per-bundle prices from the product catalog.
  // However, we need to apply tiered pricing across ALL bundles in the order.
  // The server independently recalculates using tiered pricing, so this is for preview.
  
  // Calculate total bundles in order for tiered pricing
  const totalBundles = checkoutItems.reduce((sum, i) => sum + i.qty, 0);
  
  // For display purposes, calculate what the server will charge using tiered pricing
  // Formula: total = 384 + (N - 1) × 256
  const tieredTotal = 384 + (Math.max(1, totalBundles) - 1) * 256;
  
  const subtotal = tieredTotal;
  const discount = couponApplied ? subtotal * 0.1 : 0;
  const shipping = 0; // FREE DELIVERY — always ₹0, enforced server-side
  // GST is deactivated: no separate tax line is added. Price shown already
  // includes GST rather than adding it on top — see bundle-pricing.constants.ts.
  const total = subtotal - discount + shipping;

  const handleSaveAddress = async () => {
    const errors = validateAddress(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) { toast.error("Please fix the form errors"); return; }

    if (!user) {
      saveLocalAddress();
      toast.success("Address saved. Login before placing order.");
      return;
    }

    try {
      const res = await authFetch("/api/addresses", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.name,
          phone: form.phone,
          address_line1: form.street,
          address_line2: null,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          is_default: form.isDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        // Real save failure — tell the user, don't silently pretend it worked.
        toast.error(data.error || "Could not save address. Please try again.");
        return;
      }
      const addr = data.address;
      const saved = {
        ...addr,
        _id: addr.id,
        name: addr.full_name || form.name,
        street: addr.address_line1 || form.street,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        phone: addr.phone,
        type: form.type,
        isDefault: addr.is_default,
      };
      setAddresses((prev) => [saved, ...prev]);
      setSelectedAddr(saved._id);
      setShowForm(false);
      setForm({ type: "home", name: "", street: "", city: "", state: "Karnataka", pincode: "", phone: "", isDefault: false });
      setFormErrors({});
      toast.success("Address saved!");
    } catch {
      toast.error("Could not save address. Please check your connection and try again.");
    }
  };

  const handlePlaceOrder = async () => {
    if (placing) return;
    if (!user) {
      toast.error("Please login before placing the order");
      router.push("/login?next=/checkout");
      return;
    }
    const addr = addresses.find((a) => a._id === selectedAddr);
    if (!addr) { toast.error("Please select a delivery address"); return; }
    setPlacing(true);
    dispatch(savePaymentMethod(payMethod));

    try {
      const res = await authFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: checkoutItems.map((i) => ({
            productId: i._id || i.id,
            id: i.id || i._id,
            name: i.name,
            price: i.price,
            image: i.image,
            qty: i.qty,
            flavor: i.flavor,
            netWeight: i.netWeight,
          })),
          shippingAddress: { name: addr.name || addr.full_name, phone: addr.phone, street: addr.street || addr.address_line1, city: addr.city, state: addr.state, pincode: addr.pincode },
          paymentMethod: payMethod, orderNotes: notes,
          couponCode: couponApplied ? couponCode : null,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || "Could not place order"); setPlacing(false); return; }

      if (!data.requiresPayment) {
        dispatch(clearBuyNowItem());
        dispatch(clearCart());
        router.push(`/order-confirmation?orderId=${data.order.id}`);
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) { toast.error("Could not load payment gateway"); setPlacing(false); return; }

      const rzp = new window.Razorpay({
        key: data.razorpay.keyId,
        amount: data.razorpay.amount,
        currency: data.razorpay.currency,
        order_id: data.razorpay.orderId,
        name: "WIN-DIA",
        description: `Order ${data.order.order_number}`,
        image: "/images/windia-logo.png",
        prefill: { name: addr.name, contact: addr.phone, email: user?.email || "" },
        theme: { color: "#3B1F0F" },
        handler: async (response) => {
          try {
            const vRes = await authFetch("/api/payment/verify", {
              method: "POST",
              body: JSON.stringify({ orderId: data.order.id, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }),
            });
            const vData = await vRes.json();
            if (vData.success) { dispatch(clearBuyNowItem()); dispatch(clearCart()); toast.success("Payment successful!"); router.push(`/order-confirmation?orderId=${data.order.id}`); }
            else toast.error(vData.error || "Payment verification failed");
          } finally { setPlacing(false); }
        },
        modal: {
          ondismiss: async () => {
            // User closed the Razorpay popup without paying. Mark the order as
            // cancelled instead of leaving it stuck at "placed / pending" forever
            // with no way to tell it apart from a genuinely in-progress order.
            try {
              await authFetch(`/api/orders/${data.order.id}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "cancel", reason: "Payment cancelled by customer" }),
              });
            } catch {
              // Best-effort — even if this fails, don't block the UI on it.
            } finally {
              setPlacing(false);
              toast("Payment cancelled — order was not placed");
            }
          },
        },
      });
      rzp.on("payment.failed", async () => {
        try {
          await authFetch(`/api/orders/${data.order.id}`, {
            method: "PATCH",
            body: JSON.stringify({ action: "cancel", reason: "Payment failed" }),
          });
        } catch {
          // Best-effort.
        } finally {
          setPlacing(false);
          toast.error("Payment failed — order was cancelled");
        }
      });
      rzp.open();
    } catch { toast.error("Something went wrong"); setPlacing(false); }
  };

  if (!checkoutItems.length) return (
    <div className={styles.emptyWrap}>
      <div className={styles.emptyCard}>
        <h2>Nothing to checkout</h2>
        <Link href="/cart" className={styles.backBtn}><FiArrowLeft /> Back to Cart</Link>
      </div>
    </div>
  );

  const addrObj = addresses.find((a) => a._id === selectedAddr);

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className="container">
          <Link href="/cart" className={styles.backLink}><FiArrowLeft /> Back to Cart</Link>
          <h1>Secure <span className="gold-text">Checkout</span></h1>

          {/* Steps */}
          <div className={styles.steps}>
            {["Delivery Details", "Review", "Payment"].map((label, i) => (
              <div key={label} className={styles.stepGroup}>
                <div className={`${styles.step} ${step > i + 1 ? styles.stepDone : ""} ${step === i + 1 ? styles.stepActive : ""}`}>
                  <span>{step > i + 1 ? <FiCheck /> : i + 1}</span>
                  <p>{label}</p>
                </div>
                {i < 2 && <div className={`${styles.stepLine} ${step > i + 1 ? styles.stepLineDone : ""}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        <div className={styles.layout}>

          {/* ── Main ── */}
          <div className={styles.main}>
            <AnimatePresence mode="wait">

              {/* Step 1 — Address */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>Delivery Address</h2>
                    {!showForm && (
                      <button className={styles.addAddrBtn} onClick={() => setShowForm(true)}>
                        <FiPlus /> New Address
                      </button>
                    )}
                  </div>

                  {/* Address Form */}
                  <AnimatePresence>
                    {showForm && (
                      <motion.div className={styles.addrForm} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <div className={styles.typeRow}>
                          {[{ id: "home", icon: FiHome, label: "Home" }, { id: "office", icon: FiBriefcase, label: "Office" }, { id: "other", icon: FiMapPin, label: "Other" }].map(({ id, icon: Icon, label }) => (
                            <button key={id} className={`${styles.typeBtn} ${form.type === id ? styles.typeBtnActive : ""}`} onClick={() => setForm({ ...form, type: id })}>
                              <Icon /> {label}
                            </button>
                          ))}
                        </div>

                        <div className={styles.formGrid}>
                          <div className={`${styles.formGroup} ${styles.span2}`}>
                            <label>Full Name *</label>
                            <input type="text" placeholder="Your full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={formErrors.name ? styles.inputError : ""} />
                            {formErrors.name && <span className={styles.errMsg}>{formErrors.name}</span>}
                          </div>
                          <div className={`${styles.formGroup} ${styles.span2}`}>
                            <label>Phone *</label>
                            <input type="tel" placeholder="10-digit mobile" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={formErrors.phone ? styles.inputError : ""} />
                            {formErrors.phone && <span className={styles.errMsg}>{formErrors.phone}</span>}
                          </div>
                          <div className={`${styles.formGroup} ${styles.span4}`}>
                            <label>Street Address *</label>
                            <textarea rows={2} placeholder="House No., Street, Landmark" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className={formErrors.street ? styles.inputError : ""} />
                            {formErrors.street && <span className={styles.errMsg}>{formErrors.street}</span>}
                          </div>
                          <div className={`${styles.formGroup} ${styles.span2}`}>
                            <label>City *</label>
                            <input type="text" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={formErrors.city ? styles.inputError : ""} />
                            {formErrors.city && <span className={styles.errMsg}>{formErrors.city}</span>}
                          </div>
                          <div className={styles.formGroup}>
                            <label>State *</label>
                            <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                              {STATES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div className={styles.formGroup}>
                            <label>Pincode *</label>
                            <input type="text" maxLength={6} placeholder="6-digit pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className={formErrors.pincode ? styles.inputError : ""} />
                            {formErrors.pincode && <span className={styles.errMsg}>{formErrors.pincode}</span>}
                          </div>
                          <div className={`${styles.formGroup} ${styles.span4} ${styles.checkRow}`}>
                            <label className={styles.checkLabel}>
                              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
                              Set as default address
                            </label>
                          </div>
                        </div>

                        <div className={styles.formActions}>
                          <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
                          <button className={styles.saveBtn} onClick={handleSaveAddress}>Save Address</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Saved addresses */}
                  {!showForm && (
                    <div className={styles.addrList}>
                      {addresses.length === 0 && (
                        <div className={styles.noAddr}>
                          <FiMapPin />
                          <p>No saved addresses yet.</p>
                          <button className={styles.addAddrBtn} onClick={() => setShowForm(true)}>
                            <FiPlus /> Add Your First Address
                          </button>
                        </div>
                      )}
                      {addresses.map((a) => {
                        const TypeIcon = a.type === "office" ? FiBriefcase : a.type === "other" ? FiMapPin : FiHome;
                        const isSelected = selectedAddr === a._id;
                        return (
                          <motion.div key={a._id} className={`${styles.addrCard} ${isSelected ? styles.addrSelected : ""}`} onClick={() => setSelectedAddr(a._id)} whileHover={{ y: -2 }}>
                            <div className={styles.addrRadio}>
                              <span className={`${styles.radio} ${isSelected ? styles.radioChecked : ""}`}>{isSelected && <FiCheck />}</span>
                            </div>
                            <div className={styles.addrContent}>
                              <div className={styles.addrTop}>
                                <span className={styles.addrType}><TypeIcon />{a.type}</span>
                                {a.isDefault && <span className={styles.defaultTag}>Default</span>}
                              </div>
                              <p className={styles.addrName}>{a.name}</p>
                              <p className={styles.addrLine}>{a.street}</p>
                              <p className={styles.addrLine}>{a.city}, {a.state} — {a.pincode}</p>
                              <p className={styles.addrPhone}>{a.phone}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  <div className={styles.notesRow}>
                    <label>Order Notes (optional)</label>
                    <textarea rows={2} placeholder="Special delivery instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>

                  <div className={styles.stepFooter}>
                    <button className={styles.proceedBtn} onClick={() => { if (!selectedAddr) { toast.error("Select an address"); return; } const a = addresses.find((x) => x._id === selectedAddr); dispatch(saveShippingAddress(a)); setStep(2); }} disabled={!selectedAddr}>
                      Continue to Payment <FiChevronRight />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2 — Payment */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={styles.section}>
                  <h2>Payment & Delivery</h2>

                  {/* Delivery — Always Free */}
                  <div className={styles.optGroup}>
                    <h3>Delivery</h3>
                    <div className={styles.optGrid}>
                      <motion.div className={`${styles.optCard} ${styles.optSelected}`} whileHover={{ y: -2 }}>
                        <span className={`${styles.optRadio} ${styles.optRadioChecked}`}><FiCheck /></span>
                        <FiTruck className={styles.optIcon} />
                        <div><p className={styles.optLabel}>Free Delivery</p><p className={styles.optSub}>3–5 business days</p></div>
                        <span className={styles.optCost}>FREE</span>
                      </motion.div>
                    </div>
                  </div>

                  {/* Payment options */}
                  <div className={styles.optGroup}>
                    <h3>Payment Method</h3>
                    <div className={styles.optGrid}>
                      {[
                        { id: "razorpay", label: "Pay Online", sub: "Cards, UPI, NetBanking", icon: FiCreditCard },
                        { id: "cod", label: "Cash on Delivery", sub: "Pay when you receive", icon: FiPackage },
                      ].map(({ id, label, sub, icon: Icon }) => (
                        <motion.div key={id} className={`${styles.optCard} ${payMethod === id ? styles.optSelected : ""}`} onClick={() => setPayMethod(id)} whileHover={{ y: -2 }}>
                          <span className={`${styles.optRadio} ${payMethod === id ? styles.optRadioChecked : ""}`}>{payMethod === id && <FiCheck />}</span>
                          <Icon className={styles.optIcon} />
                          <div><p className={styles.optLabel}>{label}</p><p className={styles.optSub}>{sub}</p></div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.stepFooter}>
                    <button className={styles.backBtn2} onClick={() => setStep(1)}><FiArrowLeft /> Back</button>
                    <button className={styles.proceedBtn} onClick={handlePlaceOrder} disabled={placing}>
                      {placing ? <><FiLoader className="spin" /> Placing Order...</> : <>Place Order <FiChevronRight /></>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Sidebar ── */}
          <div className={styles.sidebar}>
            <div className={styles.summaryCard}>
              <h3>Order Summary</h3>
              <div className="gold-divider" style={{ margin: "12px 0 16px" }} />

              <div className={styles.summaryItems}>
                {checkoutItems.map((item) => (
                  <div key={item._id || item.id} className={styles.summaryItem}>
                    <img src={item.image || "/images/product-methi.jpg"} alt={item.name} />
                    <div>
                      <p className={styles.sItemName}>{item.name}</p>
                      <p className={styles.sItemQty}>× {item.qty} {item.qty === 1 ? 'bundle' : 'bundles'}</p>
                    </div>
                    <span className={styles.sItemPrice}>{item.qty} × 6 packets</span>
                  </div>
                ))}
              </div>

              {/* Promo Code Section */}
              <div style={{ margin: "16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: couponApplied ? "8px" : "0" }}>
                  <FiTag style={{ color: "#D4AF37", fontSize: "18px" }} />
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={couponApplied || couponLoading}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      border: "1px solid #E0E0E0",
                      borderRadius: "4px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                  {!couponApplied ? (
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      style={{
                        padding: "10px 16px",
                        backgroundColor: "#D4AF37",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        fontWeight: 600,
                        cursor: couponLoading || !couponCode.trim() ? "not-allowed" : "pointer",
                        opacity: couponLoading || !couponCode.trim() ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  ) : (
                    <button
                      onClick={handleRemoveCoupon}
                      style={{
                        padding: "10px 16px",
                        backgroundColor: "#e53e3e",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {couponApplied && (
                  <p style={{ fontSize: "13px", color: "#22c55e", fontWeight: 500, marginLeft: "26px" }}>
                    ✓ {couponCode.toUpperCase()} applied — 10% off
                  </p>
                )}
              </div>

              <div className={styles.breakdown}>
                <div className={styles.bRow}>
                  <span>{totalBundles} {totalBundles === 1 ? 'Bundle' : 'Bundles'} × 6 packets each</span>
                  <span>₹{subtotal.toFixed(0)}</span>
                </div>
                {couponApplied && <div className={`${styles.bRow} ${styles.bDiscount}`}><span>Discount (10%)</span><span>−₹{discount.toFixed(2)}</span></div>}
                <div className={styles.bRow}><span>Shipping</span><span className={styles.free}>FREE</span></div>
              </div>

              <div className={styles.totalRow}>
                <span>Total <small style={{ fontWeight: 400, opacity: 0.7 }}>(GST included)</small></span>
                <span>₹{total.toFixed(2)}</span>
              </div>

              {/* Delivering to (step 2) */}
              {step === 2 && addrObj && (
                <div className={styles.deliverTo}>
                  <p className={styles.deliverLabel}>Delivering to</p>
                  <p className={styles.deliverName}>{addrObj.name}</p>
                  <p className={styles.deliverAddr}>{addrObj.street}, {addrObj.city}</p>
                  <p className={styles.deliverAddr}>{addrObj.state} — {addrObj.pincode}</p>
                  <button className={styles.changeAddr} onClick={() => setStep(1)}>Change</button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


