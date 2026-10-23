"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/src/frontend/hooks/useAuth";
import styles from "../admin.module.css";
import * as XLSX from "xlsx";

const STATUSES = [
  "placed",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "payment_collected",
  "cancelled",
  "rto_initiated",
  "rto_delivered",
];

// Date filter options for sales reports
const DATE_FILTERS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 Days" },
  { value: "thisweek", label: "This Week" },
  { value: "lastweek", label: "Last Week" },
  { value: "thismonth", label: "This Month" },
  { value: "lastmonth", label: "Last Month" },
];

function formatStatusLabel(status) {
  return (status || "placed").replace(/_/g, " ");
}

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toFixed(0)}`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Packing Slip Generator (Receipt size - 80mm thermal printer format) ────

function generateShippingLabel(order) {
  const addr = order.shipping_address || {};
  const orderDate = new Date(order.created_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const orderNumber = order.order_number || order.id;
  
  // Get order items - REAL DATA
  const items = order.order_items || [];
  console.log('[DEBUG] Packing slip - Order items:', items);
  console.log('[DEBUG] Packing slip - Items count:', items.length);
  
  const totalItems = items.reduce((sum, item) => sum + (item.qty || item.quantity || 1), 0);
  const subtotal = order.items_price || 0;
  const shipping = order.shipping_price || 0;
  const discount = order.discount_price || 0;
  const total = order.total_price || 0;
  
  console.log('[DEBUG] Packing slip - Pricing breakdown:', {
    subtotal,
    shipping,
    discount,
    total,
    order_discount_price: order.discount_price
  });
  
  // Payment status
  const paymentStatus = order.payment_status === 'paid' ? 'PAID' : 
                        order.payment_method === 'cod' ? 'COD' : 'PENDING';

  const slipHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Packing Slip - ${orderNumber}</title>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    /* Receipt size: 80mm width (thermal printer standard) */
    @page {
      size: 80mm auto;
      margin: 0;
    }
    
    body { 
      font-family: Arial, sans-serif;
      width: 80mm;
      padding: 5mm;
      margin: 0 auto;
      background: white;
      color: #000;
      font-size: 11px;
    }
    
    /* Header: Logo + TM + Brand name - matching reference design */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      margin-bottom: 8px;
      gap: 12px;
    }
    .logo-with-tm {
      position: relative;
      display: inline-block;
    }
    .logo {
      max-width: 45px;
      height: auto;
      display: block;
    }
    .tm-badge {
      position: absolute;
      top: 0;
      right: 2px;
      font-size: 8px;
      font-weight: bold;
      color: #000;
    }
    .brand-name {
      font-family: Georgia, serif;
      font-size: 26px;
      font-weight: bold;
      letter-spacing: 1px;
      color: #000;
      line-height: 1;
      padding-top: 2px;
    }
    
    /* Title */
    .title {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 3px;
      padding: 8px 0;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      margin: 8px 0 12px 0;
    }
    
    /* Order info */
    .info-section {
      margin-bottom: 10px;
      line-height: 1.7;
      font-size: 11px;
    }
    .info-row {
      display: flex;
      gap: 5px;
    }
    .info-label {
      width: 80px;
    }
    .info-value {
      font-weight: bold;
    }
    
    .divider {
      border-top: 1px dashed #000;
      margin: 10px 0;
    }
    
    /* Ship to */
    .ship-to-title {
      font-weight: bold;
      margin-bottom: 6px;
    }
    .address-block {
      line-height: 1.6;
      margin-bottom: 10px;
      font-size: 11px;
    }
    
    /* Items table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 10px;
    }
    .items-table th {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px 4px;
      text-align: left;
      font-weight: bold;
    }
    .items-table td {
      padding: 6px 4px;
      border-bottom: 1px dashed #ccc;
    }
    .items-table .text-right {
      text-align: right;
    }
    .items-table .qty-col {
      width: 30px;
      text-align: center;
    }
    .items-table .price-col {
      width: 60px;
      text-align: right;
    }
    
    /* Summary */
    .summary {
      margin-top: 10px;
      font-size: 11px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    .total-section {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      margin-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 14px;
      font-weight: bold;
    }
    
    /* Thank you */
    .thank-you {
      text-align: center;
      margin: 15px 0 10px 0;
      font-size: 11px;
    }
    
    /* Footer contact */
    .footer {
      margin-top: 15px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      line-height: 1.8;
      font-size: 10px;
      text-align: center;
    }
    
    /* Packed message */
    .packed {
      text-align: center;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #000;
      font-weight: bold;
      font-size: 10px;
    }
    
    @media print {
      body { 
        width: 80mm;
      }
    }
  </style>
</head>
<body>
  <!-- Header: Logo with TM + WIN-DIA brand (matching reference) -->
  <div class="header">
    <div class="logo-with-tm">
      <img src="/images/windia-logo.png" alt="WIN-DIA" class="logo" />
      <span class="tm-badge">TM</span>
    </div>
    <div class="brand-name">WIN-DIA</div>
  </div>

  <!-- Title -->
  <div class="title">PACKING SLIP</div>

  <!-- Order Info -->
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">Order #</span>
      <span class="info-value">: ${orderNumber}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Order Date</span>
      <span class="info-value">: ${orderDate}</span>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Ship To -->
  <div class="ship-to-title">SHIP TO:</div>
  <div class="address-block">
    ${addr.full_name || addr.name || 'Customer Name'}<br>
    ${addr.address_line1 || addr.street || 'Address Line 1'}<br>
    ${addr.address_line2 ? addr.address_line2 + '<br>' : ''}${addr.city || 'City'}, ${addr.state || 'State'} - ${addr.pincode || 'PIN'}<br>
    Phone: +91 ${addr.phone || '00000 00000'}
  </div>

  <div class="divider"></div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th>ITEM NAME</th>
        <th class="qty-col">QTY</th>
        <th class="price-col">PRICE</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => {
        const productName = item.name || item.product_name || 'Product';
        const flavor = item.flavor || '';
        const displayName = flavor ? `${productName} - ${flavor}` : productName;
        return `
        <tr>
          <td>${displayName}</td>
          <td class="qty-col">${item.qty || item.quantity || 1}</td>
          <td class="price-col">₹${((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}</td>
        </tr>
      `}).join('')}
    </tbody>
  </table>

  <!-- Summary -->
  <div class="summary">
    <div class="summary-row">
      <span>Items</span>
      <span>${totalItems}</span>
    </div>
    <div class="summary-row">
      <span>Subtotal</span>
      <span>₹${subtotal.toFixed(0)}</span>
    </div>
    <div class="summary-row">
      <span>Shipping</span>
      <span>₹${shipping.toFixed(0)}</span>
    </div>
    ${discount > 0 ? `
    <div class="summary-row">
      <span>Discount</span>
      <span>- ₹${discount.toFixed(0)}</span>
    </div>
    ` : ''}
  </div>

  <!-- Total -->
  <div class="total-section">
    <div class="total-row">
      <span>TOTAL</span>
      <span>₹${total.toFixed(0)}</span>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Thank You -->
  <div class="thank-you">
    Thank you for choosing WIN-DIA! 🌿
  </div>

  <!-- Footer: Company Details -->
  <div class="footer">
    🌐 www.windiafoods.com<br>
    📞 Customer Support: +91 96861 53413<br>
    📷 @Kalpavristi_Coco_FAB
  </div>

  <!-- Packed Message -->
  <div class="packed">
    🌱 Packed with care in Mysuru
  </div>

  <script>
    window.onload = () => {
      setTimeout(() => window.print(), 300);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(slipHtml);
  printWindow.document.close();
}

// ─── Components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const colorMap = {
    placed: "#f59e0b",
    confirmed: "#3b82f6",
    shipped: "#06b6d4",
    out_for_delivery: "#8b5cf6",
    delivered: "#10b981",
    payment_collected: "#059669",
    cancelled: "#ef4444",
    rto_initiated: "#f97316",
    rto_delivered: "#dc2626",
  };
  const color = colorMap[status] || "#6b7280";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 600,
        textTransform: "capitalize",
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

function OrderRow({ order, authFetch }) {
  const handleGenerateLabel = async () => {
    try {
      // Fetch full order details WITH items
      const response = await authFetch(`/api/admin/orders/${order.id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('[DEBUG] Full order data:', data.data);
        generateShippingLabel(data.data);
      } else {
        toast.error("Could not load order details");
      }
    } catch (err) {
      console.error("Error fetching order details:", err);
      toast.error("Failed to load order details");
    }
  };

  return (
    <tr>
      <td>
        <strong>{order.order_number || order.id}</strong>
      </td>
      <td>{formatDate(order.created_at)}</td>
      <td>{formatCurrency(order.total_price)}</td>
      <td>
        <span className={styles.status}>
          {order.payment_status === "paid" 
            ? "Paid" 
            : order.payment_status === "cod_pending" 
            ? "COD Pending" 
            : order.payment_status === "cod_collected"
            ? "COD Collected"
            : order.payment_status === "refund_initiated"
            ? "Refunding"
            : order.payment_status === "refunded"
            ? "Refunded"
            : order.payment_status || "pending"}
        </span>
      </td>
      <td>
        <StatusBadge status={order.order_status || "placed"} />
      </td>
      <td>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          style={{ fontSize: "12px", padding: "6px 12px" }}
          onClick={handleGenerateLabel}
        >
          📦 Label
        </button>
      </td>
    </tr>
  );
}

function OrdersTable({ orders, loading, authFetch, columnFilters, setColumnFilters }) {
  if (loading) return <div className={styles.empty}>Loading orders...</div>;

  // Get unique values for dropdown filters
  const uniquePaymentStatuses = [...new Set(orders.map(o => o.payment_status || "pending"))];
  const uniqueOrderStatuses = [...new Set(orders.map(o => o.order_status || "placed"))];

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Label</th>
          </tr>
          <tr>
            <th>
              <input
                type="text"
                placeholder="Search..."
                className={styles.filterInput}
                value={columnFilters.orderNumber || ""}
                onChange={(e) => setColumnFilters({ ...columnFilters, orderNumber: e.target.value })}
              />
            </th>
            <th>
              <select
                className={styles.filterInput}
                value={columnFilters.dateRange || ""}
                onChange={(e) => setColumnFilters({ ...columnFilters, dateRange: e.target.value })}
              >
                <option value="">All Time</option>
                {DATE_FILTERS.slice(1).map((df) => (
                  <option key={df.value} value={df.value}>
                    {df.label}
                  </option>
                ))}
              </select>
            </th>
            <th>
              <input
                type="text"
                placeholder="Amount..."
                className={styles.filterInput}
                value={columnFilters.total || ""}
                onChange={(e) => setColumnFilters({ ...columnFilters, total: e.target.value })}
              />
            </th>
            <th>
              <select
                className={styles.filterInput}
                value={columnFilters.payment || ""}
                onChange={(e) => setColumnFilters({ ...columnFilters, payment: e.target.value })}
              >
                <option value="">All</option>
                {uniquePaymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </th>
            <th>
              <select
                className={styles.filterInput}
                value={columnFilters.status || ""}
                onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
              >
                <option value="">All</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} authFetch={authFetch} />
          ))}
          {!orders.length && (
            <tr>
              <td colSpan="6">No orders found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Excel Export (Real .xlsx format using xlsx library) ────────────────────

function exportToExcel(orders) {
  if (!orders.length) {
    toast.error("No orders to export");
    return;
  }

  // Prepare data rows for Excel
  const excelData = orders.map((order) => {
    const addr = order.shipping_address || {};
    const shippingLine = [
      addr.address_line1 || "",
      addr.city || "",
      addr.state || "",
      addr.pincode || "",
    ]
      .filter(Boolean)
      .join(", ");

    return {
      "Order Number": order.order_number || order.id,
      "Order Date": formatDate(order.created_at),
      "Customer Email": order.user_email || order.email || "",
      "Total Amount": order.total_price || 0,
      "Payment Method": order.payment_method || "online",
      "Payment Status": order.payment_status || "pending",
      "Order Status": order.order_status || "placed",
      "Shipping Address": shippingLine,
      "Phone": addr.phone || "",
    };
  });

  // Create a new workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

  // Set column widths for better readability
  const columnWidths = [
    { wch: 20 }, // Order Number
    { wch: 12 }, // Order Date
    { wch: 25 }, // Customer Email
    { wch: 12 }, // Total Amount
    { wch: 15 }, // Payment Method
    { wch: 15 }, // Payment Status
    { wch: 15 }, // Order Status
    { wch: 40 }, // Shipping Address
    { wch: 15 }, // Phone
  ];
  worksheet['!cols'] = columnWidths;

  // Generate Excel file and trigger download
  const fileName = `orders-export-${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  toast.success(`Exported ${orders.length} orders to Excel`);
}

// ─── Transaction Details Table (view in browser) ────────────────────────────

function TransactionDetailsTable({ orders, onClose }) {
  const [columnFilters, setColumnFilters] = useState({
    orderNumber: "",
    dateRange: "",
    total: "",
    payment: "",
    status: "",
  });
  const [filteredOrders, setFilteredOrders] = useState(orders);

  // Get unique values for dropdown filters
  const uniquePaymentStatuses = [...new Set(orders.map(o => o.payment_status || "pending"))];

  // Apply filters
  useEffect(() => {
    let filtered = [...orders];

    if (columnFilters.orderNumber) {
      filtered = filtered.filter(order =>
        (order.order_number || order.id).toLowerCase().includes(columnFilters.orderNumber.toLowerCase())
      );
    }
    if (columnFilters.total) {
      filtered = filtered.filter(order =>
        formatCurrency(order.total_price).includes(columnFilters.total)
      );
    }
    if (columnFilters.payment) {
      filtered = filtered.filter(order =>
        (order.payment_status || "pending") === columnFilters.payment
      );
    }
    if (columnFilters.status) {
      filtered = filtered.filter(order =>
        (order.order_status || "placed") === columnFilters.status
      );
    }

    // Date range filter
    if (columnFilters.dateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        
        switch (columnFilters.dateRange) {
          case "today":
            return orderDate >= today;
          case "yesterday":
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return orderDate >= yesterday && orderDate < today;
          case "last7days":
            const last7 = new Date(today);
            last7.setDate(last7.getDate() - 7);
            return orderDate >= last7;
          case "thisweek":
            const thisWeekStart = new Date(today);
            thisWeekStart.setDate(today.getDate() - today.getDay());
            return orderDate >= thisWeekStart;
          case "lastweek":
            const lastWeekEnd = new Date(today);
            lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
            const lastWeekStart = new Date(lastWeekEnd);
            lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
            return orderDate >= lastWeekStart && orderDate <= lastWeekEnd;
          case "thismonth":
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return orderDate >= thisMonthStart;
          case "lastmonth":
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
          default:
            return true;
        }
      });
    }

    setFilteredOrders(filtered);
  }, [orders, columnFilters]);

  if (!orders.length) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <h2>Transaction Details</h2>
          <p>No orders to display</p>
          <button className={styles.button} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Transaction Details ({filteredOrders.length} orders)</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.tableWrap} style={{ maxHeight: "70vh", overflow: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Shipping</th>
                <th>Phone</th>
              </tr>
              <tr>
                <th>
                  <input
                    type="text"
                    placeholder="Search..."
                    className={styles.filterInput}
                    value={columnFilters.orderNumber || ""}
                    onChange={(e) => setColumnFilters({ ...columnFilters, orderNumber: e.target.value })}
                  />
                </th>
                <th>
                  <select
                    className={styles.filterInput}
                    value={columnFilters.dateRange || ""}
                    onChange={(e) => setColumnFilters({ ...columnFilters, dateRange: e.target.value })}
                  >
                    <option value="">All Time</option>
                    {DATE_FILTERS.slice(1).map((df) => (
                      <option key={df.value} value={df.value}>
                        {df.label}
                      </option>
                    ))}
                  </select>
                </th>
                <th></th>
                <th>
                  <input
                    type="text"
                    placeholder="Amount..."
                    className={styles.filterInput}
                    value={columnFilters.total || ""}
                    onChange={(e) => setColumnFilters({ ...columnFilters, total: e.target.value })}
                  />
                </th>
                <th>
                  <select
                    className={styles.filterInput}
                    value={columnFilters.payment || ""}
                    onChange={(e) => setColumnFilters({ ...columnFilters, payment: e.target.value })}
                  >
                    <option value="">All</option>
                    {uniquePaymentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </th>
                <th>
                  <select
                    className={styles.filterInput}
                    value={columnFilters.status || ""}
                    onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                  >
                    <option value="">All</option>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const addr = order.shipping_address || {};
                const shippingLine = [addr.address_line1, addr.city, addr.state, addr.pincode]
                  .filter(Boolean)
                  .join(", ");
                
                return (
                  <tr key={order.id}>
                    <td><strong>{order.order_number || order.id}</strong></td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.user_email || order.email || "-"}</td>
                    <td>{formatCurrency(order.total_price)}</td>
                    <td>
                      <span className={styles.status}>{order.payment_status || "pending"}</span>
                      <br />
                      <small>{order.payment_method || "online"}</small>
                    </td>
                    <td><StatusBadge status={order.order_status || "placed"} /></td>
                    <td style={{ fontSize: "12px", maxWidth: "200px" }}>{shippingLine || "-"}</td>
                    <td>{addr.phone || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.button} onClick={() => exportToExcel(filteredOrders)}>
            📥 Download Excel
          </button>
          <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [columnFilters, setColumnFilters] = useState({
    orderNumber: "",
    dateRange: "",
    total: "",
    payment: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authFetch(`/api/admin/orders`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const items = data.data?.items || data.orders || data.data || [];
          setOrders(Array.isArray(items) ? items : []);
        } else {
          toast.error(data.error || "Could not load orders");
        }
      })
      .catch((err) => {
        console.error("Error loading orders:", err);
        toast.error("Failed to load orders");
      })
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  // Apply column filters
  useEffect(() => {
    let filtered = [...orders];

    // Apply column filters
    if (columnFilters.orderNumber) {
      filtered = filtered.filter(order =>
        (order.order_number || order.id).toLowerCase().includes(columnFilters.orderNumber.toLowerCase())
      );
    }
    if (columnFilters.total) {
      filtered = filtered.filter(order =>
        formatCurrency(order.total_price).includes(columnFilters.total)
      );
    }
    if (columnFilters.payment) {
      filtered = filtered.filter(order =>
        (order.payment_status || "pending") === columnFilters.payment
      );
    }
    if (columnFilters.status) {
      filtered = filtered.filter(order =>
        (order.order_status || "placed") === columnFilters.status
      );
    }

    // Apply date range filter
    if (columnFilters.dateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        
        switch (columnFilters.dateRange) {
          case "today":
            return orderDate >= today;
          case "yesterday":
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return orderDate >= yesterday && orderDate < today;
          case "last7days":
            const last7 = new Date(today);
            last7.setDate(last7.getDate() - 7);
            return orderDate >= last7;
          case "thisweek":
            const thisWeekStart = new Date(today);
            thisWeekStart.setDate(today.getDate() - today.getDay());
            return orderDate >= thisWeekStart;
          case "lastweek":
            const lastWeekEnd = new Date(today);
            lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
            const lastWeekStart = new Date(lastWeekEnd);
            lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
            return orderDate >= lastWeekStart && orderDate <= lastWeekEnd;
          case "thismonth":
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return orderDate >= thisMonthStart;
          case "lastmonth":
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
          default:
            return true;
        }
      });
    }

    setFilteredOrders(filtered);
  }, [orders, columnFilters]);

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.topTitle}>Orders</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={styles.button}
            onClick={() => setShowDetails(true)}
            disabled={loading || !filteredOrders.length}
          >
            📊 View Details
          </button>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => exportToExcel(filteredOrders)}
            disabled={loading || !filteredOrders.length}
          >
            📥 Export Excel
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <OrdersTable 
          orders={filteredOrders} 
          loading={loading} 
          authFetch={authFetch} 
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
        />
      </section>

      {showDetails && <TransactionDetailsTable orders={filteredOrders} onClose={() => setShowDetails(false)} />}
    </>
  );
}
