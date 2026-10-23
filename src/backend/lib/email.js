// Ported from windia-integrated-version3-main/src/lib/email.js
// Change: none — this file had zero Next.js dependencies, works as-is.

import nodemailer from "nodemailer";

let cachedTransporter = null;

function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
  }
  return cachedTransporter;
}

async function sendMail({ to, subject, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      `Email not sent (GMAIL_USER/GMAIL_APP_PASSWORD not configured): "${subject}" to ${to}`
    );
    return { sent: false, reason: "not_configured" };
  }
  try {
    await transporter.sendMail({
      from: `"WIN-DIA" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send email "${subject}" to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

// --- Formatting helpers -----------------------------------------------

const money = (n) => `₹${Number(n).toFixed(2)}`;

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const formatAddress = (address) =>
  address
    ? `${address.name}, ${address.street}, ${address.city}, ${address.state} – ${address.pincode}`
    : "";

// --- Template shell ------------------------------------------------------

const wrap = (innerHtml) => `
  <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:40px;background:#fff;border-radius:16px;border:1px solid #f0e6df">
    <h1 style="font-family:'Cormorant Garamond',serif;font-size:28px;color:#c56a3d;margin:0 0 24px">WIN·DIA</h1>
    ${innerHtml}
    <p style="color:#a89a92;font-size:12px;margin-top:32px;border-top:1px solid #f5ede6;padding-top:16px">
      Questions about your order? Reply to this email or contact care@windia.com.
    </p>
  </div>
`;

const orderItemsRow = (item) => `
  <tr>
    <td style="padding:8px 0;color:#3a2a1e">${item.name}${item.flavor ? ` (${item.flavor})` : ""} × ${item.qty}</td>
    <td style="padding:8px 0;text-align:right;color:#3a2a1e">${money(item.price * item.qty)}</td>
  </tr>
`;

// --- Email templates -------------------------------------------------

/** Sent right after an order is placed / payment is verified. */
export async function sendOrderConfirmationEmail(order, to) {
  if (!to) return { sent: false, reason: "no_email_provided" };

  const itemsHtml = (order.order_items || []).map(orderItemsRow).join("");

  const html = wrap(`
    <p style="color:#84766f;font-size:15px">Thanks for your order! Here's your confirmation.</p>
    <div style="background:#fff9f4;border-radius:12px;padding:20px;margin:20px 0">
      <p style="margin:0 0 4px;font-weight:700;color:#3a2a1e">Order #${order.order_number}</p>
      <p style="margin:0;color:#a89a92;font-size:13px">${formatDate(order.created_at)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>
    <div style="border-top:2px solid #3a2a1e;margin-top:12px;padding-top:12px">
      <strong style="color:#3a2a1e">Total: ${money(order.total_price)}</strong>
    </div>
    <p style="color:#84766f;font-size:14px;margin-top:24px">
      Delivering to: ${formatAddress(order.shipping_address)}
    </p>
  `);

  return sendMail({ to, subject: `Order Confirmed – #${order.order_number}`, html });
}

const STATUS_COPY = {
  confirmed:        { subject: "Your order has been confirmed",         headline: "Order Confirmed"      },
  processing:       { subject: "Your order is being prepared",          headline: "Preparing Your Order" },
  shipped:          { subject: "Your order has shipped!",               headline: "On Its Way"           },
  out_for_delivery: { subject: "Your order is out for delivery",        headline: "Out for Delivery"     },
  delivered:        { subject: "Your order has been delivered",         headline: "Delivered"            },
  cancelled:        { subject: "Your order has been cancelled",         headline: "Order Cancelled"      },
  returned:         { subject: "Your order return has been processed",  headline: "Order Returned"       },
};

/** Sent whenever order_status changes (from webhook or admin update). */
export async function sendShippingUpdateEmail(order, to) {
  if (!to) return { sent: false, reason: "no_email_provided" };

  const copy = STATUS_COPY[order.order_status];
  if (!copy) return { sent: false, reason: "no_template_for_status" };

  const trackingHtml = order.awb_code
    ? `<p style="color:#6b5d55;font-size:14px">Tracking (AWB): <strong>${order.awb_code}</strong>${order.courier_name ? ` via ${order.courier_name}` : ""}</p>`
    : "";

  const html = wrap(`
    <p style="color:#84766f;font-size:15px">Order #${order.order_number}</p>
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:26px;color:#3a2a1e;margin:8px 0 16px">${copy.headline}</h2>
    ${trackingHtml}
    <p style="color:#84766f;font-size:14px;margin-top:16px">You can check live status anytime from your account's Orders page.</p>
  `);

  return sendMail({ to, subject: `${copy.subject} – #${order.order_number}`, html });
}

/** Notifies the admin of a new order. */
export async function sendAdminNewOrderAlert(order) {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.GMAIL_USER;
  if (!adminEmail) return { sent: false, reason: "no_admin_email_configured" };

  const paymentLabel =
    order.payment_method === "cod" ? "Cash on Delivery" : "Razorpay (Prepaid)";

  const html = wrap(`
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:24px;color:#3a2a1e;margin:0 0 16px">New Order Received</h2>
    <p style="color:#3a2a1e"><strong>Order #${order.order_number}</strong> – ${money(order.total_price)}</p>
    <p style="color:#6b5d55;font-size:14px">${order.shipping_address?.name} · ${order.shipping_address?.city}, ${order.shipping_address?.state}</p>
    <p style="color:#6b5d55;font-size:14px">Payment: ${paymentLabel}</p>
  `);

  return sendMail({
    to: adminEmail,
    subject: `New order #${order.order_number} – ${money(order.total_price)}`,
    html,
  });
}