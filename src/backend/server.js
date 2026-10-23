import "dotenv/config";
import express from "express";
import cors from "cors";
import paymentRoutes from "./routes/payment.js";
import shippingRoutes from "./routes/shipping.js";

// Override with .env.local if it exists (takes priority over .env)
import { config } from "dotenv";
import { existsSync } from "fs";
if (existsSync(".env.local")) config({ path: ".env.local", override: true });

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// ── Raw body for Razorpay webhook (before JSON parser) ────────────────────────
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

// ── JSON parser ───────────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/payment", paymentRoutes);
app.use("/api/shipping", shippingRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "windia-pay-ship", timestamp: new Date().toISOString() });
});

// ── DEV: Test Supabase connection ─────────────────────────────────────────────
app.get("/dev/test-supabase", async (_req, res) => {
  if (process.env.NODE_ENV !== "development") return res.status(403).json({ error: "Dev only" });
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await client.from("orders").select("id").limit(1);
    if (error) return res.json({ success: false, error: error.message });
    return res.json({ success: true, message: "Supabase connected", rowCount: data?.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DEV: Check env vars ───────────────────────────────────────────────────────
app.get("/dev/check-env", (_req, res) => {
  if (process.env.NODE_ENV !== "development") return res.status(403).json({ error: "Dev only" });
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    serviceKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "NOT SET",
    razorpaySecretSet: !!process.env.RAZORPAY_KEY_SECRET,
    nodeEnv: process.env.NODE_ENV,
  });
});

// ── DEV: Test Razorpay keys ───────────────────────────────────────────────────
app.get("/dev/test-razorpay", async (_req, res) => {
  if (process.env.NODE_ENV !== "development") return res.status(403).json({ error: "Dev only" });
  try {
    const { getRazorpayClient } = await import("./lib/razorpay.js");
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({ amount: 100, currency: "INR", receipt: `test-${Date.now()}` });
    res.json({ success: true, message: "Razorpay keys valid", razorpayOrderId: order.id, amount: `₹${order.amount / 100}`, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => { console.error("Unhandled error:", err); res.status(500).json({ success: false, error: "Internal server error" }); });

app.listen(PORT, () => {
  console.log(`WIN-DIA pay_ship service running on http://localhost:${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`Dev bypass: ${process.env.NODE_ENV === "development" ? "ENABLED" : "DISABLED"}`);
});
