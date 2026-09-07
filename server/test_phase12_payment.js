/**
 * NEXORA — Phase 12 Payment API Test Suite (25 tests)
 * Run: node test_phase12_payment.js
 *
 * Tests:
 *  T1  COD order creation succeeds
 *  T2  Online order creation succeeds
 *  T3  Invalid paymentMethod rejected (400)
 *  T4  Payment initiate requires authentication (401)
 *  T5  Payment initiate works for order owner
 *  T6  User cannot initiate payment for another user's order (404)
 *  T7  Payment amount comes from backend Order total
 *  T8  Client cannot manipulate payment amount
 *  T9  Payment confirmation requires authentication (401)
 *  T10 User can confirm payment for their own online order
 *  T11 Payment status becomes "paid" after confirmation
 *  T12 paidAt is stored after confirmation
 *  T13 paymentReference is generated safely
 *  T14 User cannot confirm another user's payment (404)
 *  T15 Already-paid order cannot be confirmed again (400)
 *  T16 Payment status endpoint requires authentication (401)
 *  T17 User can fetch their own payment status
 *  T18 User cannot fetch another user's payment status (404)
 *  T19 Cancelled order cannot be paid (400)
 *  T20 Existing Product API still works
 *  T21 Existing Auth API still works
 *  T22 Existing Cart API still works
 *  T23 Existing Order API still works
 *  T24 Existing Admin authorization still works
 *  T25 Frontend Vite build succeeds
 */

import http from "http";
import { execSync } from "child_process";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function req(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token)   headers["Authorization"] = `Bearer ${token}`;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);

    const r = http.request(
      { hostname: "localhost", port: 5000, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    r.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    r.setTimeout(60000, () => { r.destroy(); resolve({ status: 0, body: { error: "timeout" } }); });
    if (payload) r.write(payload);
    r.end();
  });
}

// ─── Assertion helper ─────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(n, label, condition, details = "") {
  if (condition) {
    passed++;
    console.log(`✅ T${n}: ${label}`);
  } else {
    failed++;
    console.log(`❌ T${n}: ${label}`);
  }
  if (details) console.log(`   └─ ${details}`);
}

const SHIPPING = {
  fullName: "Phase12 Tester",
  phone:    "03001234567",
  address:  "123 Test Street",
  city:     "Karachi",
  postalCode: "75000",
  country:  "Pakistan",
};

console.log("═".repeat(60));
console.log("  NEXORA Phase 12 — Payment API — 25-Test Suite");
console.log("═".repeat(60) + "\n");

// ─── Setup ────────────────────────────────────────────────────────────────────
console.log("⚙️  Setup: creating test accounts and products...\n");

await mongoose.connect(process.env.MONGO_URI);

// Clean up any leftover test data from previous runs
await mongoose.connection.collection("users").deleteMany({
  email: { $in: [
    "p12_user1@nexora.com",
    "p12_user2@nexora.com",
    "p12_admin@nexora.com",
  ]},
});
await mongoose.connection.collection("products").deleteMany({
  name: "Phase12 Test Product",
});

// Create admin
const regAdmin = await req("POST", "/api/auth/register", {
  name: "P12 Admin", email: "p12_admin@nexora.com", password: "Password123",
});
await mongoose.connection.collection("users").updateOne(
  { email: "p12_admin@nexora.com" },
  { $set: { role: "admin" } }
);
const loginAdmin = await req("POST", "/api/auth/login", {
  email: "p12_admin@nexora.com", password: "Password123",
});
const ADMIN_TOKEN = loginAdmin.body?.token;

// Create product with stock
const prodRes = await req("POST", "/api/products", {
  name: "Phase12 Test Product",
  description: "Product for Phase 12 payment tests",
  price: 99.99,
  category: "Test",
  image: "https://example.com/p12.jpg",
  stock: 20,
}, ADMIN_TOKEN);
const PROD_ID = prodRes.body?.data?._id;
console.log(`   Product created: ${PROD_ID}`);

// Register User 1
const regU1 = await req("POST", "/api/auth/register", {
  name: "P12 User1", email: "p12_user1@nexora.com", password: "Password123",
});
const TOKEN_U1 = regU1.body?.token;

// Register User 2
const regU2 = await req("POST", "/api/auth/register", {
  name: "P12 User2", email: "p12_user2@nexora.com", password: "Password123",
});
const TOKEN_U2 = regU2.body?.token;

console.log(`   User1 token: ${TOKEN_U1 ? "✓" : "✗ MISSING"}`);
console.log(`   User2 token: ${TOKEN_U2 ? "✓" : "✗ MISSING"}`);
console.log(`   Admin token: ${ADMIN_TOKEN ? "✓" : "✗ MISSING"}\n`);

// ─── T1: COD order creation succeeds ─────────────────────────────────────────
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const t1 = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "cod",
}, TOKEN_U1);
assert(1, "COD order creation succeeds (201)",
  t1.status === 201 && t1.body?.data?.paymentMethod === "cod",
  `status=${t1.status}, paymentMethod=${t1.body?.data?.paymentMethod}, paymentStatus=${t1.body?.data?.paymentStatus}`
);
const COD_ORDER_ID = t1.body?.data?._id;

// ─── T2: Online order creation succeeds ──────────────────────────────────────
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const t2 = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "online",
}, TOKEN_U1);
assert(2, "Online order creation succeeds (201)",
  t2.status === 201 && t2.body?.data?.paymentMethod === "online",
  `status=${t2.status}, paymentMethod=${t2.body?.data?.paymentMethod}, paymentStatus=${t2.body?.data?.paymentStatus}`
);
const ONLINE_ORDER_ID = t2.body?.data?._id;

// ─── T3: Invalid paymentMethod rejected ──────────────────────────────────────
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const t3 = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "bitcoin",
}, TOKEN_U1);
assert(3, "Invalid paymentMethod 'bitcoin' rejected (400)",
  t3.status === 400,
  `status=${t3.status}, message=${t3.body?.message}`
);
// Clear leftover cart item if it wasn't consumed
await req("DELETE", "/api/cart", null, TOKEN_U1);

// ─── T4: Initiate requires auth ───────────────────────────────────────────────
const t4 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/initiate`);
assert(4, "Payment initiate requires authentication (401)",
  t4.status === 401,
  `status=${t4.status}`
);

// ─── T5: Initiate works for owner ────────────────────────────────────────────
const t5 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/initiate`, null, TOKEN_U1);
assert(5, "Payment initiate works for order owner (200)",
  t5.status === 200 && t5.body?.success === true && t5.body?.payment?.orderId,
  `status=${t5.status}, amount=${t5.body?.payment?.amount}`
);

// ─── T6: User cannot initiate payment for another user's order ───────────────
const t6 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/initiate`, null, TOKEN_U2);
assert(6, "User cannot initiate payment for another user's order (404)",
  t6.status === 404,
  `status=${t6.status}, message=${t6.body?.message}`
);

// ─── T7: Amount comes from backend Order total ────────────────────────────────
const t7amount = t5.body?.payment?.amount;
const t7expected = t2.body?.data?.total;
assert(7, "Payment amount comes from backend Order total",
  typeof t7amount === "number" && t7amount === t7expected,
  `returned=${t7amount}, order.total=${t7expected}`
);

// ─── T8: Client cannot manipulate payment amount ─────────────────────────────
// Attempt to sneak amount into the body — backend should ignore it
const t8 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/initiate`,
  { amount: 0.01, total: 0.01 },
  TOKEN_U1
);
assert(8, "Client cannot manipulate payment amount (amount still from DB)",
  t8.status === 200 && t8.body?.payment?.amount === t7expected,
  `returned=${t8.body?.payment?.amount}, expected=${t7expected}`
);

// ─── T9: Confirm requires auth ────────────────────────────────────────────────
const t9 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/confirm`);
assert(9, "Payment confirmation requires authentication (401)",
  t9.status === 401,
  `status=${t9.status}`
);

// ─── T10: User can confirm own online order ───────────────────────────────────
const t10 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/confirm`, null, TOKEN_U1);
assert(10, "User can confirm payment for their own online order (200)",
  t10.status === 200 && t10.body?.success === true,
  `status=${t10.status}, message=${t10.body?.message}`
);

// ─── T11: Payment status becomes "paid" ──────────────────────────────────────
assert(11, "Payment status becomes 'paid' after confirmation",
  t10.body?.payment?.paymentStatus === "paid",
  `paymentStatus=${t10.body?.payment?.paymentStatus}`
);

// ─── T12: paidAt is stored ───────────────────────────────────────────────────
assert(12, "paidAt is stored after confirmation",
  !!t10.body?.payment?.paidAt,
  `paidAt=${t10.body?.payment?.paidAt}`
);

// ─── T13: paymentReference is generated safely ───────────────────────────────
const ref = t10.body?.payment?.paymentReference;
assert(13, "paymentReference is generated and starts with NXPAY-",
  typeof ref === "string" && ref.startsWith("NXPAY-"),
  `paymentReference=${ref}`
);

// ─── T14: User cannot confirm another user's payment ─────────────────────────
// Create a fresh online order for User2
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U2);
const u2order = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "online",
}, TOKEN_U2);
const U2_ORDER_ID = u2order.body?.data?._id;

const t14 = await req("POST", `/api/payments/${U2_ORDER_ID}/confirm`, null, TOKEN_U1);
assert(14, "User cannot confirm another user's payment (404)",
  t14.status === 404,
  `status=${t14.status}, message=${t14.body?.message}`
);

// ─── T15: Already-paid order cannot be confirmed again ───────────────────────
const t15 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/confirm`, null, TOKEN_U1);
assert(15, "Already-paid order cannot be confirmed again (400)",
  t15.status === 400,
  `status=${t15.status}, message=${t15.body?.message}`
);

// ─── T16: Status endpoint requires auth ──────────────────────────────────────
const t16 = await req("GET", `/api/payments/${ONLINE_ORDER_ID}/status`);
assert(16, "Payment status endpoint requires authentication (401)",
  t16.status === 401,
  `status=${t16.status}`
);

// ─── T17: User can fetch their own payment status ────────────────────────────
const t17 = await req("GET", `/api/payments/${ONLINE_ORDER_ID}/status`, null, TOKEN_U1);
assert(17, "User can fetch their own payment status (200)",
  t17.status === 200 &&
  t17.body?.data?.paymentStatus === "paid" &&
  t17.body?.data?.orderId,
  `status=${t17.status}, paymentStatus=${t17.body?.data?.paymentStatus}`
);

// ─── T18: User cannot fetch another user's payment status ────────────────────
const t18 = await req("GET", `/api/payments/${ONLINE_ORDER_ID}/status`, null, TOKEN_U2);
assert(18, "User cannot fetch another user's payment status (404)",
  t18.status === 404,
  `status=${t18.status}`
);

// ─── T19: Cancelled order cannot be paid ─────────────────────────────────────
// Cancel the COD order (cancellation still works — payment method is irrelevant to cancellation)
await req("PATCH", `/api/orders/${COD_ORDER_ID}/cancel`, null, TOKEN_U1);

// Create a fresh online order then cancel it, then try to pay
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const cancelledOnline = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING, paymentMethod: "online",
}, TOKEN_U1);
const CANCELLED_ONLINE_ID = cancelledOnline.body?.data?._id;
await req("PATCH", `/api/orders/${CANCELLED_ONLINE_ID}/cancel`, null, TOKEN_U1);

const t19 = await req("POST", `/api/payments/${CANCELLED_ONLINE_ID}/initiate`, null, TOKEN_U1);
assert(19, "Cancelled order cannot be initiated for payment (400)",
  t19.status === 400,
  `status=${t19.status}, message=${t19.body?.message}`
);

// ─── T20: Existing Product API regression ────────────────────────────────────
const t20 = await req("GET", "/api/products");
assert(20, "Existing Product API still works (200)",
  t20.status === 200 && t20.body?.success === true,
  `count=${t20.body?.count}`
);

// ─── T21: Existing Auth API regression ───────────────────────────────────────
const t21 = await req("GET", "/api/auth/me", null, TOKEN_U1);
assert(21, "Existing Auth API still works (200)",
  t21.status === 200 && t21.body?.data?.user?.email === "p12_user1@nexora.com",
  `user=${t21.body?.data?.user?.email}`
);

// ─── T22: Existing Cart API regression ───────────────────────────────────────
const t22 = await req("GET", "/api/cart", null, TOKEN_U1);
assert(22, "Existing Cart API still works (200)",
  t22.status === 200 && t22.body?.success === true,
  `status=${t22.status}`
);

// ─── T23: Existing Order API regression ──────────────────────────────────────
const t23 = await req("GET", "/api/orders", null, TOKEN_U1);
assert(23, "Existing Order API still works (200)",
  t23.status === 200 && Array.isArray(t23.body?.data),
  `orderCount=${t23.body?.data?.length}`
);

// ─── T24: Admin authorization regression ─────────────────────────────────────
// Normal user cannot create products
const t24 = await req("POST", "/api/products", {
  name: "Hack", description: "X", price: 1, category: "X", image: "X", stock: 1,
}, TOKEN_U1);
assert(24, "Admin authorization still works — user cannot create products (403)",
  t24.status === 403,
  `status=${t24.status}`
);

// ─── T25: Frontend build ──────────────────────────────────────────────────────
console.log("\n⚙️  Running frontend Vite production build...");
let buildOk = false;
try {
  const clientDir = resolve(__dirname, "../client");
  execSync("npm run build", { cwd: clientDir, stdio: "pipe" });
  buildOk = true;
} catch (e) {
  console.error("   Build FAILED:", e.stderr?.toString()?.slice(0, 300));
}
assert(25, "Frontend Vite production build succeeds",
  buildOk,
  buildOk ? "Build passed with 0 errors" : "Build failed — see output above"
);

// ─── Cleanup ──────────────────────────────────────────────────────────────────
console.log("\n⚙️  Cleaning up test data...");
await mongoose.connect(process.env.MONGO_URI);
await mongoose.connection.collection("users").deleteMany({
  email: { $in: [
    "p12_user1@nexora.com",
    "p12_user2@nexora.com",
    "p12_admin@nexora.com",
  ]},
});
await mongoose.connection.collection("products").deleteMany({
  name: "Phase12 Test Product",
});
await mongoose.connection.collection("orders").deleteMany({
  "shippingAddress.fullName": "Phase12 Tester",
});
await mongoose.connection.collection("carts").deleteMany({});
await mongoose.disconnect();
console.log("   Cleanup done.\n");

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
