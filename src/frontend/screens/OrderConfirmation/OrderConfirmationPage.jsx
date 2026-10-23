"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FiCheckCircle, FiPackage, FiMapPin, FiCreditCard,
  FiArrowRight, FiShoppingBag, FiTruck, FiClock, FiXCircle
} from "react-icons/fi";
import { useAuth } from "@/src/frontend/hooks/useAuth";
import styles from "./OrderConfirmationPage.module.css";

// Status steps differ based on payment method
const getCODStatusSteps = () => ["placed", "confirmed", "shipped", "out_for_delivery", "delivered", "payment_collected"];
const getCODStatusLabels = () => ({ 
  placed: "Order Placed", 
  confirmed: "Confirmed", 
  shipped: "Shipped", 
  out_for_delivery: "Out for Delivery", 
  delivered: "Delivered",
  payment_collected: "Payment Collected"
});

const getOnlineStatusSteps = () => ["placed", "paid", "shipped", "out_for_delivery", "delivered"];
const getOnlineStatusLabels = () => ({ 
  placed: "Order Placed", 
  paid: "Payment Confirmed", 
  shipped: "Shipped", 
  out_for_delivery: "Out for Delivery", 
  delivered: "Delivered"
});

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { authFetch, user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !authFetch) return;
    authFetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setOrder(d.order); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId, authFetch]);

  if (loading) return (
    <div className={styles.loadWrap}>
      <div className={styles.loadCard}>
        <div className={styles.loadSpinner} />
        <p>Loading your order...</p>
      </div>
    </div>
  );

  if (!order) return (
    <div className={styles.loadWrap}>
      <div className={styles.loadCard}>
        <FiPackage size={48} style={{ color: "var(--coco-faint)" }} />
        <h2>Order not found</h2>
        <Link href="/" className={styles.homeBtn}>Go Home</Link>
      </div>
    </div>
  );

  const isCOD = order.payment_method === 'cod';
  const STATUS_STEPS = isCOD ? getCODStatusSteps() : getOnlineStatusSteps();
  const STATUS_LABELS = isCOD ? getCODStatusLabels() : getOnlineStatusLabels();
  
  // For COD orders, map 'confirmed' status to same position, but show different flow
  // For online orders, map payment_status to appropriate step
  let displayStatus = order.order_status;
  if (!isCOD && order.payment_status === 'paid' && order.order_status === 'placed') {
    displayStatus = 'paid'; // Show as paid step for online orders
  }
  if (isCOD && order.order_status === 'delivered' && order.payment_status === 'cod_collected') {
    displayStatus = 'payment_collected'; // COD final step
  }
  
  const statusIdx = STATUS_STEPS.indexOf(displayStatus);
  const addr = order.shipping_address || {};

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className="container">
          <motion.div className={styles.heroInner} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <motion.div className={styles.checkIcon} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, delay: 0.2 }}>
              <FiCheckCircle />
            </motion.div>
            <h1>Order <span className="gold-text">Confirmed!</span></h1>
            <p className={styles.heroSub}>Thank you{user?.user_metadata?.name ? `, ${user.user_metadata.name.split(" ")[0]}` : ""}! Your order has been placed successfully.</p>
            <div className={styles.orderBadge}>
              <FiPackage /> Order #{order.order_number}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container">
        <div className={styles.layout}>

          {/* ── Main ── */}
          <div className={styles.main}>

            {/* Status tracker */}
            <motion.div className={styles.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2><FiTruck style={{ color: "var(--gold)" }} /> Order Status</h2>
              
              {order.order_status === 'cancelled' ? (
                <div style={{
                  padding: "20px",
                  background: "#fef2f2",
                  border: "2px solid #ef4444",
                  borderRadius: "12px",
                  textAlign: "center"
                }}>
                  <FiXCircle size={48} style={{ color: "#ef4444", marginBottom: "12px" }} />
                  <h3 style={{ color: "#dc2626", marginBottom: "8px" }}>Order Cancelled</h3>
                  <p style={{ fontSize: "14px", color: "#991b1b" }}>
                    This order has been cancelled.
                    {order.payment_status === 'refunded' && <><br />Your payment has been refunded.</>}
                    {order.payment_status === 'paid' && <><br />Refund is being processed.</>}
                  </p>
                </div>
              ) : (
                <div className={styles.tracker}>
                  {STATUS_STEPS.map((s, i) => (
                    <div key={s} className={styles.trackerStep}>
                      <div className={`${styles.trackerDot} ${i <= statusIdx ? styles.trackerDotDone : ""} ${i === statusIdx ? styles.trackerDotActive : ""}`}>
                        {i < statusIdx ? <FiCheckCircle /> : i + 1}
                      </div>
                      <p className={`${styles.trackerLabel} ${i <= statusIdx ? styles.trackerLabelDone : ""}`}>{STATUS_LABELS[s]}</p>
                      {i < STATUS_STEPS.length - 1 && <div className={`${styles.trackerLine} ${i < statusIdx ? styles.trackerLineDone : ""}`} />}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Order items */}
            <motion.div className={styles.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h2><FiPackage style={{ color: "var(--gold)" }} /> Items Ordered</h2>
              <div className={styles.itemsList}>
                {(order.order_items || []).map((item, i) => (
                  <div key={i} className={styles.orderItem}>
                    <div className={styles.itemImg}>
                      {item.image ? <img src={item.image} alt={item.name} /> : <FiPackage />}
                    </div>
                    <div className={styles.itemDetails}>
                      <p className={styles.itemName}>{item.name}</p>
                      {item.flavor && <p className={styles.itemFlavor}>{item.flavor}</p>}
                      <p className={styles.itemQty}>Qty: {item.qty}</p>
                      
                      {/* Combo Flavor Breakdown */}
                      {item.flavorSelections && (
                        <div style={{ 
                          background: 'rgba(201,168,76,0.08)', 
                          border: '1px solid rgba(201,168,76,0.25)', 
                          borderRadius: '4px', 
                          padding: '8px 10px', 
                          marginTop: '8px',
                          fontSize: '0.75rem'
                        }}>
                          <p style={{ fontWeight: 700, marginBottom: '6px', color: '#3B1F0F', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📦 Your Combo Contents:
                          </p>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
                                  <li key={flavorId} style={{ color: '#6B5948', paddingLeft: '12px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0, color: '#C9A84C', fontWeight: 'bold' }}>•</span>
                                    <strong style={{ color: '#3B1F0F' }}>{flavorNames[flavorId]}</strong>: {count} packet{count > 1 ? 's' : ''} ({count * 40}g)
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className={styles.itemPrice}>₹{(item.price * item.qty).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Delivery info */}
            <motion.div className={styles.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2><FiMapPin style={{ color: "var(--gold)" }} /> Delivery Address</h2>
              <div className={styles.addrBlock}>
                <p className={styles.addrName}>{addr.name}</p>
                <p>{addr.street}</p>
                <p>{addr.city}, {addr.state} — {addr.pincode}</p>
                <p>{addr.phone}</p>
              </div>
            </motion.div>

          </div>

          {/* ── Sidebar ── */}
          <div className={styles.sidebar}>
            <motion.div className={styles.summaryCard} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <h3>Order Summary</h3>
              <div className="gold-divider" style={{ margin: "12px 0 16px" }} />

              <div className={styles.breakdown}>
                <div className={styles.bRow}><span>Items</span><span>₹{order.items_price?.toFixed(2)}</span></div>
                {order.discount_price > 0 && <div className={`${styles.bRow} ${styles.bGreen}`}><span>Discount</span><span>−₹{order.discount_price?.toFixed(2)}</span></div>}
                <div className={styles.bRow}><span>Shipping</span><span className={order.shipping_price === 0 ? styles.free : ""}>{order.shipping_price === 0 ? "FREE" : `₹${order.shipping_price?.toFixed(2)}`}</span></div>
                {/* Older orders placed before GST was deactivated may still have a non-zero tax_price on record. */}
                {order.tax_price > 0 && <div className={styles.bRow}><span>Tax</span><span>₹{order.tax_price?.toFixed(2)}</span></div>}
              </div>

              <div className={styles.totalRow}>
                <span>
                  {order.order_status === 'cancelled' 
                    ? 'Order Total' 
                    : order.payment_method === 'cod' && order.payment_status === 'cod_pending'
                    ? 'Total Amount'
                    : 'Total Paid'
                  } <small style={{ fontWeight: 400, opacity: 0.7 }}>(GST included)</small>
                </span>
                <span>₹{order.total_price?.toFixed(2)}</span>
              </div>
              
              {/* Show cancellation notice in order summary */}
              {order.order_status === 'cancelled' && (
                <div style={{
                  padding: "12px",
                  marginTop: "12px",
                  background: "#fef2f2",
                  border: "1px solid #ef4444",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#dc2626",
                  textAlign: "center"
                }}>
                  <strong>Order Cancelled</strong>
                  {order.payment_status === 'refunded' && (
                    <><br /><span style={{ color: "#059669" }}>Refund: ₹{order.total_price?.toFixed(2)}</span></>
                  )}
                  {order.payment_status === 'refund_initiated' && (
                    <><br /><span style={{ color: "#f59e0b" }}>Refund Processing</span></>
                  )}
                  {order.payment_status === 'failed' && order.payment_method === 'cod' && (
                    <><br /><span style={{ color: "#6b7280" }}>No payment collected</span></>
                  )}
                </div>
              )}

              {/* Payment info */}
              <div className={styles.payInfo}>
                <FiCreditCard />
                <div>
                  <p className={styles.payLabel}>Payment</p>
                  <p className={styles.payValue}>
                    {order.payment_method === "cod" ? "Cash on Delivery" : "Paid Online"}
                    {" · "}
                    <span className={`${styles.payStatus} ${
                      order.payment_status === "paid" || order.payment_status === "cod_collected" 
                        ? styles.payPaid 
                        : order.payment_status === "cod_pending"
                        ? styles.payPending
                        : order.payment_status === "refund_initiated"
                        ? styles.payPending
                        : order.payment_status === "refunded"
                        ? styles.payPaid
                        : styles.payPending
                    }`}>
                      {order.payment_status === "paid" 
                        ? "Paid" 
                        : order.payment_status === "cod_pending" 
                        ? "Pending" 
                        : order.payment_status === "cod_collected"
                        ? "Collected"
                        : order.payment_status === "refund_initiated"
                        ? "Refund Processing"
                        : order.payment_status === "refunded"
                        ? "Refunded"
                        : "Pending"}
                    </span>
                  </p>
                </div>
              </div>

              {/* ETA - only show if order is not cancelled */}
              {order.order_status !== 'cancelled' && (
                <div className={styles.etaBox}>
                  <FiClock />
                  <div>
                    <p className={styles.etaLabel}>Estimated Delivery</p>
                    <p className={styles.etaValue}>
                      {(() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 5);
                        return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* CTA buttons */}
            <motion.div className={styles.ctaCard} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              {order.order_status === 'cancelled' && (
                <div style={{
                  padding: "12px",
                  marginBottom: "12px",
                  background: "#fef2f2",
                  border: "1px solid #ef4444",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#dc2626",
                  textAlign: "center"
                }}>
                  <strong>Order Cancelled</strong><br />
                  For assistance, please contact customer support.
                </div>
              )}
              
              <Link href="/profile/orders" className={styles.ordersBtn}>
                View All Orders <FiArrowRight />
              </Link>
              <Link href="/shop" className={styles.ordersBtn}>
                <FiShoppingBag /> Continue Shopping
              </Link>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}


