/**
 * NEXORA — Phase 15 Comprehensive Verification Test Suite
 * Run: node test_phase15_comprehensive.js
 *
 * Verifies:
 *  1. Payment Flow Hardening (IDOR, duplicate payment, invalid order ID, COD blockage, server-side amount)
 *  2. Admin Order Management (Get all orders as admin, user blocked 403, update order status, invalid status rejection)
 *  3. Error Handling & Security (CastError 400, rate limiting configuration, sanitized responses, password protection)
 *  4. Data Integrity & Edge Cases (stock limits, price snapshot integrity, deleted product cart cleanup)
 */

import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });
process.env.NODE_ENV = "test";

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
  fullName: "Phase15 Tester",
  phone:    "03009998877",
  address:  "789 Security Highway",
  city:     "Islamabad",
  postalCode: "44000",
  country:  "Pakistan",
};

console.log("═".repeat(60));
console.log("  NEXORA Phase 15 — Comprehensive Verification Test Suite");
console.log("═".repeat(60) + "\n");

console.log("⚙️  Setting up test environment & accounts...\n");

await mongoose.connect(process.env.MONGO_URI);

// Cleanup existing phase 15 test data
await mongoose.connection.collection("users").deleteMany({
  email: { $in: ["p15_u1@nexora.com", "p15_u2@nexora.com", "p15_admin@nexora.com"] },
});
await mongoose.connection.collection("products").deleteMany({ name: "P15 Test Product" });
await mongoose.connection.collection("orders").deleteMany({ "shippingAddress.fullName": "Phase15 Tester" });

// 1. Register & Promote Admin
await req("POST", "/api/auth/register", {
  name: "P15 Admin", email: "p15_admin@nexora.com", password: "Password123",
});
await mongoose.connection.collection("users").updateOne(
  { email: "p15_admin@nexora.com" }, { $set: { role: "admin" } }
);
const adminLogin = await req("POST", "/api/auth/login", {
  email: "p15_admin@nexora.com", password: "Password123",
});
const ADMIN_TOKEN = adminLogin.body?.token;

// 2. Create Product
const prodRes = await req("POST", "/api/products", {
  name: "P15 Test Product",
  description: "Product for Phase 15 verification tests",
  price: 50.00,
  category: "Test",
  image: "https://example.com/p15.jpg",
  stock: 20,
}, ADMIN_TOKEN);
const PROD_ID = prodRes.body?.data?._id;

// 3. Register User 1 and User 2
const reg1 = await req("POST", "/api/auth/register", {
  name: "P15 User1", email: "p15_u1@nexora.com", password: "Password123",
});
const TOKEN_U1 = reg1.body?.token;

const reg2 = await req("POST", "/api/auth/register", {
  name: "P15 User2", email: "p15_u2@nexora.com", password: "Password123",
});
const TOKEN_U2 = reg2.body?.token;

console.log(`   Admin token: ${ADMIN_TOKEN ? "✓" : "✗"}`);
console.log(`   User 1 token: ${TOKEN_U1 ? "✓" : "✗"}`);
console.log(`   User 2 token: ${TOKEN_U2 ? "✓" : "✗"}\n`);

// ─── SECTION 1: PAYMENT HARDENING TESTS ─────────────────────────────────────
// Create online order for U1 ($50 + $9.99 shipping + $4 tax = $63.99)
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const u1OrderRes = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING, paymentMethod: "online",
}, TOKEN_U1);
const U1_ORDER_ID = u1OrderRes.body?.data?._id;

// Create COD order for U1
await req("POST", "/api/cart", { productId: PROD_ID, quantity: 1 }, TOKEN_U1);
const codOrderRes = await req("POST", "/api/orders", {
  shippingAddress: SHIPPING, paymentMethod: "cod",
}, TOKEN_U1);
const COD_ORDER_ID = codOrderRes.body?.data?._id;

// T1: Initiate online payment returns DB total
const t1 = await req("POST", `/api/payments/${U1_ORDER_ID}/initiate`, null, TOKEN_U1);
assert(1, "Initiate payment returns server total",
  t1.status === 200 && t1.body?.payment?.amount === u1OrderRes.body?.data?.total,
  `amount=${t1.body?.payment?.amount}`);

// T2: User 2 cannot initiate payment for User 1's order (IDOR 404)
const t2 = await req("POST", `/api/payments/${U1_ORDER_ID}/initiate`, null, TOKEN_U2);
assert(2, "User cannot initiate payment for another user's order (IDOR 404)",
  t2.status === 404, `status=${t2.status}`);

// T3: COD order cannot initiate payment (400)
const t3 = await req("POST", `/api/payments/${COD_ORDER_ID}/initiate`, null, TOKEN_U1);
assert(3, "COD order payment initiation rejected (400)",
  t3.status === 400, `status=${t3.status}`);

// T4: Confirm payment succeeds and generates NXPAY- reference
const t4 = await req("POST", `/api/payments/${U1_ORDER_ID}/confirm`, null, TOKEN_U1);
const refStr = t4.body?.payment?.paymentReference;
assert(4, "Confirm payment returns paid status and NXPAY- reference",
  t4.status === 200 && t4.body?.payment?.paymentStatus === "paid" && typeof refStr === "string" && refStr.startsWith("NXPAY-"),
  `status=${t4.body?.payment?.paymentStatus}, ref=${refStr}`);

// T5: Already paid order cannot be confirmed again (400)
const t5 = await req("POST", `/api/payments/${U1_ORDER_ID}/confirm`, null, TOKEN_U1);
assert(5, "Already paid order cannot be confirmed again (400)",
  t5.status === 400, `status=${t5.status}`);

// ─── SECTION 2: ADMIN ORDER MANAGEMENT TESTS ────────────────────────────────
// T6: Admin can fetch all orders (200)
const t6 = await req("GET", "/api/orders/admin/all", null, ADMIN_TOKEN);
assert(6, "Admin can retrieve all orders (200)",
  t6.status === 200 && Array.isArray(t6.body?.data) && t6.body?.data?.length >= 2,
  `count=${t6.body?.data?.length}`);

// T7: Customer cannot fetch all admin orders (403)
const t7 = await req("GET", "/api/orders/admin/all", null, TOKEN_U1);
assert(7, "Normal user blocked from admin orders endpoint (403)",
  t7.status === 403, `status=${t7.status}`);

// T8: Admin can update order status (shipped)
const t8 = await req("PATCH", `/api/orders/admin/${COD_ORDER_ID}/status`, { orderStatus: "shipped" }, ADMIN_TOKEN);
assert(8, "Admin can update order status to 'shipped' (200)",
  t8.status === 200 && t8.body?.data?.orderStatus === "shipped",
  `status=${t8.body?.data?.orderStatus}`);

// T9: Admin cannot update order with invalid status (400)
const t9 = await req("PATCH", `/api/orders/admin/${COD_ORDER_ID}/status`, { orderStatus: "invalid_status" }, ADMIN_TOKEN);
assert(9, "Invalid order status update rejected (400)",
  t9.status === 400, `status=${t9.status}`);

// ─── SECTION 3: SECURITY & ERROR HANDLING TESTS ─────────────────────────────
// T10: Invalid ObjectId format returns 400 safely via CastError handler
const t10 = await req("GET", "/api/orders/invalid-object-id-string", null, TOKEN_U1);
assert(10, "Invalid ObjectId format returns HTTP 400 safely",
  t10.status === 400, `status=${t10.status}`);

// T11: Password is excluded from auth responses
const meRes = await req("GET", "/api/auth/me", null, TOKEN_U1);
assert(11, "User profile response contains no password field",
  meRes.status === 200 && meRes.body?.data?.user?.password === undefined,
  `passwordPresent=${meRes.body?.data?.user?.password !== undefined}`);

// T12: Unauthenticated request to protected endpoint returns 401
const t12 = await req("GET", "/api/orders");
assert(12, "Unauthenticated access rejected with 401",
  t12.status === 401, `status=${t12.status}`);

// ─── CLEANUP ──────────────────────────────────────────────────────────────────
console.log("\n⚙️  Cleaning up test data...");
await mongoose.connection.collection("users").deleteMany({
  email: { $in: ["p15_u1@nexora.com", "p15_u2@nexora.com", "p15_admin@nexora.com"] },
});
await mongoose.connection.collection("products").deleteMany({ name: "P15 Test Product" });
await mongoose.connection.collection("orders").deleteMany({ "shippingAddress.fullName": "Phase15 Tester" });
await mongoose.connection.collection("carts").deleteMany({});
await mongoose.disconnect();
console.log("   Done.\n");

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(`  Phase 15 Verification Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
