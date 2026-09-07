/**
 * NEXORA — Phase 13 Payment UX & Security Test Suite (25 tests)
 * Run: node test_phase13_payment_ux_security.js
 *
 * Covers:
 *  T1  Guest cannot initiate payment (401)
 *  T2  Guest cannot confirm payment (401)
 *  T3  User can initiate payment for own online order
 *  T4  User cannot initiate payment for another user's order (404)
 *  T5  User can confirm own pending online order
 *  T6  Payment amount comes from database Order total
 *  T7  Client-supplied fake payment amount is ignored
 *  T8  Paid order cannot be paid again (400)
 *  T9  Cancelled order cannot be paid (400)
 *  T10 Payment reference generated correctly (NXPAY- prefix)
 *  T11 paidAt is stored correctly after confirmation
 *  T12 User cannot access another user's payment status (404)
 *  T13 Admin can access all orders
 *  T14 Normal user cannot access admin order list (403)
 *  T15 Invalid payment status string is rejected on order create (400)
 *  T16 Invalid payment method is rejected on order create (400)
 *  T17 Order total is authoritative — matches backend-calculated amount
 *  T18 getPaymentStatus returns paymentReference when paid
 *  T19 getPaymentStatus does NOT return paymentReference when pending
 *  T20 COD order cannot use payment initiate endpoint (400)
 *  T21 Existing cart API regression
 *  T22 Existing auth API regression
 *  T23 Existing product API regression
 *  T24 Existing order API regression
 *  T25 Invalid ObjectId on payment endpoints handled safely (400)
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
  fullName: "Phase13 Tester",
  phone:    "03001234567",
  address:  "456 Security Lane",
  city:     "Karachi",
  postalCode: "75500",
  country:  "Pakistan",
};

console.log("═".repeat(60));
console.log("  NEXORA Phase 13 — Payment UX & Security — 25 Tests");
console.log("═".repeat(60) + "\n");

// ─── Setup ────────────────────────────────────────────────────────────────────
console.log("⚙️  Setting up test accounts and products…\n");

await mongoose.connect(process.env.MONGO_URI);

// Cleanup any leftover Phase 13 data from a prior run
await mongoose.connection.collection("users").deleteMany({
  email: { $in: ["p13_u1@nexora.com", "p13_u2@nexora.com", "p13_admin@nexora.com"] },
});
await mongoose.connection.collection("products").deleteMany({ name: "P13 Test Product" });
await mongoose.connection.collection("orders").deleteMany({ "shippingAddress.fullName": "Phase13 Tester" });
await mongoose.connection.collection("carts").deleteMany({});

// Admin
await req("POST", "/api/auth/register", {
  name: "P13 Admin", email: "p13_admin@nexora.com", password: "Password123",
});
await mongoose.connection.collection("users").updateOne(
  { email: "p13_admin@nexora.com" }, { $set: { role: "admin" } }
);
const adminLogin = await req("POST", "/api/auth/login", {
  email: "p13_admin@nexora.com", password: "Password123",
});
const ADMIN_TOKEN = adminLogin.body?.token;

// Product ($75, stock 50)
const prodRes = await req("POST", "/api/products", {
  name: "P13 Test Product",
  description: "Phase 13 payment security test",
  price: 75.00,
  category: "Test",
  image: "https://example.com/p13.jpg",
  stock: 50,
}, ADMIN_TOKEN);
const PROD_ID = prodRes.body?.data?._id;

// User 1 and User 2
const reg1 = await req("POST", "/api/auth/register", {
  name: "P13 User1", email: "p13_u1@nexora.com", password: "Password123",
});
const TOKEN_U1 = reg1.body?.token;

const reg2 = await req("POST", "/api/auth/register", {
  name: "P13 User2", email: "p13_u2@nexora.com", password: "Password123",
});
const TOKEN_U2 = reg2.body?.token;

console.log(`   Product: ${PROD_ID}`);
console.log(`   U1 token: ${TOKEN_U1 ? "✓" : "✗ MISSING"}`);
console.log(`   U2 token: ${TOKEN_U2 ? "✓" : "✗ MISSING"}`);
console.log(`   Admin token: ${ADMIN_TOKEN ? "✓" : "✗ MISSING"}\n`);

// Create an online order for U1 ($75)
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const onlineOrder = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "online",
}, TOKEN_U1);
const ONLINE_ORDER_ID = onlineOrder.body?.data?._id;

// Create a COD order for U1
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const codOrder = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "cod",
}, TOKEN_U1);
const COD_ORDER_ID = codOrder.body?.data?._id;

// Create an online order for U2
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U2);
const u2Order = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "online",
}, TOKEN_U2);
const U2_ORDER_ID = u2Order.body?.data?._id;

console.log(`   U1 online order: ${ONLINE_ORDER_ID}`);
console.log(`   U1 COD order:    ${COD_ORDER_ID}`);
console.log(`   U2 online order: ${U2_ORDER_ID}\n`);

// ─── T1: Guest cannot initiate payment ───────────────────────────────────────
const t1 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/initiate`);
assert(1, "Guest cannot initiate payment (401)", t1.status === 401,
  `status=${t1.status}`);

// ─── T2: Guest cannot confirm payment ────────────────────────────────────────
const t2 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/confirm`);
assert(2, "Guest cannot confirm payment (401)", t2.status === 401,
  `status=${t2.status}`);

// ─── T3: User can initiate for own online order ───────────────────────────────
const t3 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/initiate`, null, TOKEN_U1);
assert(3, "User can initiate payment for own online order (200)",
  t3.status === 200 && t3.body?.payment?.orderId,
  `status=${t3.status}, amount=${t3.body?.payment?.amount}`);

// ─── T4: User cannot initiate for another user's order ───────────────────────
const t4 = await req("POST", `/api/payments/${U2_ORDER_ID}/initiate`, null, TOKEN_U1);
assert(4, "User cannot initiate payment for another user's order (404)",
  t4.status === 404,
  `status=${t4.status}, message=${t4.body?.message}`);

// ─── T5: User can confirm own pending online order ────────────────────────────
const t5 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/confirm`, null, TOKEN_U1);
assert(5, "User can confirm own pending online order (200)",
  t5.status === 200 && t5.body?.payment?.paymentStatus === "paid",
  `status=${t5.status}, paymentStatus=${t5.body?.payment?.paymentStatus}`);

// ─── T6: Payment amount comes from DB Order total ─────────────────────────────
// Create a fresh online order so we can test initiate amount
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 2 }, TOKEN_U1);
const freshOrder = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING, paymentMethod: "online",
}, TOKEN_U1);
const FRESH_ORDER_ID = freshOrder.body?.data?._id;
const expectedTotal  = freshOrder.body?.data?.total; // 2 × $75 = $150

const t6init = await req("POST", `/api/payments/${FRESH_ORDER_ID}/initiate`, null, TOKEN_U1);
assert(6, "Payment amount comes from DB Order total",
  t6init.body?.payment?.amount === expectedTotal,
  `returned=${t6init.body?.payment?.amount}, expected=${expectedTotal}`);

// ─── T7: Client-supplied fake amount is ignored ───────────────────────────────
const t7 = await req("POST", `/api/payments/${FRESH_ORDER_ID}/initiate`,
  { amount: 0.01, total: 0.01, price: 0.01 }, TOKEN_U1);
assert(7, "Client-supplied fake amount is ignored (amount still from DB)",
  t7.body?.payment?.amount === expectedTotal,
  `returned=${t7.body?.payment?.amount}, expected=${expectedTotal}`);

// ─── T8: Paid order cannot be paid again ─────────────────────────────────────
const t8 = await req("POST", `/api/payments/${ONLINE_ORDER_ID}/confirm`, null, TOKEN_U1);
assert(8, "Paid order cannot be confirmed again (400)",
  t8.status === 400,
  `status=${t8.status}, message=${t8.body?.message}`);

// ─── T9: Cancelled order cannot be paid ──────────────────────────────────────
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const cancelTarget = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING, paymentMethod: "online",
}, TOKEN_U1);
const CANCEL_ID = cancelTarget.body?.data?._id;
await req("PATCH", `/api/orders/${CANCEL_ID}/cancel`, null, TOKEN_U1);

const t9 = await req("POST", `/api/payments/${CANCEL_ID}/initiate`, null, TOKEN_U1);
assert(9, "Cancelled order cannot be initiated for payment (400)",
  t9.status === 400,
  `status=${t9.status}, message=${t9.body?.message}`);

// ─── T10: Payment reference starts with NXPAY- ───────────────────────────────
const ref10 = t5.body?.payment?.paymentReference;
assert(10, "Payment reference generated with NXPAY- prefix",
  typeof ref10 === "string" && ref10.startsWith("NXPAY-"),
  `reference=${ref10}`);

// ─── T11: paidAt is stored after confirmation ─────────────────────────────────
const paidAt11 = t5.body?.payment?.paidAt;
assert(11, "paidAt is stored correctly after confirmation",
  !!paidAt11 && !isNaN(new Date(paidAt11).getTime()),
  `paidAt=${paidAt11}`);

// ─── T12: User cannot access another user's payment status ───────────────────
const t12 = await req("GET", `/api/payments/${ONLINE_ORDER_ID}/status`, null, TOKEN_U2);
assert(12, "User cannot access another user's payment status (404)",
  t12.status === 404,
  `status=${t12.status}`);

// ─── T13: Admin can access all orders ────────────────────────────────────────
const t13 = await req("GET", "/api/orders/admin/all", null, ADMIN_TOKEN);
assert(13, "Admin can access all orders (200)",
  t13.status === 200 && Array.isArray(t13.body?.data),
  `status=${t13.status}, count=${t13.body?.data?.length}`);

// ─── T14: Normal user cannot access admin order list ─────────────────────────
const t14 = await req("GET", "/api/orders/admin/all", null, TOKEN_U1);
assert(14, "Normal user cannot access admin order list (403)",
  t14.status === 403,
  `status=${t14.status}`);

// ─── T15: Invalid paymentStatus string rejected on order create ──────────────
// paymentStatus is backend-only; but test that passing it in body doesn't override
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const t15order = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "online",
  paymentStatus: "paid",   // should be ignored/overridden by backend
}, TOKEN_U1);
const t15actualStatus = t15order.body?.data?.paymentStatus;
assert(15, "Client-supplied paymentStatus is ignored — backend sets 'pending'",
  t15order.status === 201 && t15actualStatus === "pending",
  `status=${t15order.status}, paymentStatus=${t15actualStatus} (expected pending)`);
const T15_ORDER_ID = t15order.body?.data?._id;

// ─── T16: Invalid paymentMethod rejected on order create ─────────────────────
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const t16 = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING,
  paymentMethod: "stripe",   // not in ["cod","online"]
}, TOKEN_U1);
assert(16, "Invalid paymentMethod 'stripe' rejected (400)",
  t16.status === 400,
  `status=${t16.status}, message=${t16.body?.message}`);
// Clear cart from failed attempt
await req("DELETE", "/api/cart", null, TOKEN_U1);

// ─── T17: Order total is authoritative ───────────────────────────────────────
// The fresh order was 2 × $75 = $150; ensure backend-calculated total matches
assert(17, "Order total is authoritative — 2×$75 = $150",
  expectedTotal === 150,
  `total=${expectedTotal}`);

// ─── T18: getPaymentStatus returns paymentReference when paid ─────────────────
const t18 = await req("GET", `/api/payments/${ONLINE_ORDER_ID}/status`, null, TOKEN_U1);
assert(18, "getPaymentStatus returns paymentReference when order is paid",
  t18.status === 200 &&
  t18.body?.data?.paymentStatus === "paid" &&
  typeof t18.body?.data?.paymentReference === "string" &&
  t18.body?.data?.paymentReference.startsWith("NXPAY-"),
  `paymentStatus=${t18.body?.data?.paymentStatus}, ref=${t18.body?.data?.paymentReference}`);

// ─── T19: getPaymentStatus does NOT return paymentReference when pending ──────
const t19 = await req("GET", `/api/payments/${FRESH_ORDER_ID}/status`, null, TOKEN_U1);
assert(19, "getPaymentStatus does NOT return paymentReference when pending",
  t19.status === 200 &&
  t19.body?.data?.paymentStatus === "pending" &&
  t19.body?.data?.paymentReference === undefined,
  `paymentStatus=${t19.body?.data?.paymentStatus}, ref=${t19.body?.data?.paymentReference}`);

// ─── T20: COD order cannot use payment initiate endpoint ─────────────────────
const t20 = await req("POST", `/api/payments/${COD_ORDER_ID}/initiate`, null, TOKEN_U1);
assert(20, "COD order cannot use payment initiate endpoint (400)",
  t20.status === 400,
  `status=${t20.status}, message=${t20.body?.message}`);

// ─── T21: Existing cart API regression ───────────────────────────────────────
const t21 = await req("GET", "/api/cart", null, TOKEN_U1);
assert(21, "Existing cart API still works (200)",
  t21.status === 200 && t21.body?.success === true,
  `status=${t21.status}`);

// ─── T22: Existing auth API regression ───────────────────────────────────────
const t22 = await req("GET", "/api/auth/me", null, TOKEN_U1);
assert(22, "Existing auth API still works (200)",
  t22.status === 200 && t22.body?.data?.user?.email === "p13_u1@nexora.com",
  `user=${t22.body?.data?.user?.email}`);

// ─── T23: Existing product API regression ────────────────────────────────────
const t23 = await req("GET", "/api/products");
assert(23, "Existing product API still works (200)",
  t23.status === 200 && t23.body?.success === true,
  `count=${t23.body?.count}`);

// ─── T24: Existing order API regression ──────────────────────────────────────
const t24 = await req("GET", "/api/orders", null, TOKEN_U1);
assert(24, "Existing order API still works (200)",
  t24.status === 200 && Array.isArray(t24.body?.data),
  `orderCount=${t24.body?.data?.length}`);

// ─── T25: Invalid ObjectId on payment endpoints handled safely ────────────────
const badId = "not-an-objectid";
const t25a = await req("POST", `/api/payments/${badId}/initiate`, null, TOKEN_U1);
const t25b = await req("POST", `/api/payments/${badId}/confirm`,  null, TOKEN_U1);
const t25c = await req("GET",  `/api/payments/${badId}/status`,   null, TOKEN_U1);
assert(25, "Invalid ObjectId on all payment endpoints returns 400 safely",
  t25a.status === 400 && t25b.status === 400 && t25c.status === 400,
  `initiate=${t25a.status}, confirm=${t25b.status}, status=${t25c.status}`);

// ─── Cleanup ──────────────────────────────────────────────────────────────────
console.log("\n⚙️  Cleaning up…");
await mongoose.connection.collection("users").deleteMany({
  email: { $in: ["p13_u1@nexora.com", "p13_u2@nexora.com", "p13_admin@nexora.com"] },
});
await mongoose.connection.collection("products").deleteMany({ name: "P13 Test Product" });
await mongoose.connection.collection("orders").deleteMany({
  "shippingAddress.fullName": "Phase13 Tester",
});
await mongoose.connection.collection("carts").deleteMany({});
await mongoose.disconnect();
console.log("   Done.\n");

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
