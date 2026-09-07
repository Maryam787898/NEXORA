/**
 * NEXORA — Order Management API Test Suite (34 tests)
 * Run: node test_orders.js
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
process.env.NODE_ENV = "test";

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function req(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
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

// ─── Assertion helper ────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(n, label, status, body, expectStatus, notes = []) {
  const ok = status === expectStatus;
  ok ? passed++ : failed++;
  console.log(`${ok ? "✅" : "❌"} T${n}: ${label}`);
  console.log(`   HTTP ${status} (expected ${expectStatus}) ${ok ? "✓" : "✗"}`);
  if (body?.message) console.log(`   message: ${body.message}`);
  if (notes.length > 0) notes.forEach((n) => console.log(`   ${n}`));
  console.log();
}

console.log("═".repeat(60));
console.log("  NEXORA Order API — 34-Test Suite");
console.log("═".repeat(60) + "\n");

// ── Setup ────────────────────────────────────────────────────────────────────
console.log("⚙️  Setup: registering test accounts and products...\n");

// Register users
let regA = await req("POST", "/api/auth/register", { name: "OrderUser A", email: "ordera@test.com", password: "Password123" });
let TOKEN_A = regA.body?.token || (await req("POST", "/api/auth/login", { email: "ordera@test.com", password: "Password123" })).body?.token;

let regB = await req("POST", "/api/auth/register", { name: "OrderUser B", email: "orderb@test.com", password: "Password123" });
let TOKEN_B = regB.body?.token || (await req("POST", "/api/auth/login", { email: "orderb@test.com", password: "Password123" })).body?.token;

let regAdmin = await req("POST", "/api/auth/register", { name: "Admin Order", email: "adminorder@test.com", password: "Password123" });
try { execSync("node make_admin.js adminorder@test.com"); } catch(e) {}
let loginAdmin = await req("POST", "/api/auth/login", { email: "adminorder@test.com", password: "Password123" });
let TOKEN_ADMIN = loginAdmin.body?.token;

// Products
let prod1 = await req("POST", "/api/products", { name: "Order Item 1", description: "Desc", price: 100, category: "Test", image: "img1.jpg", stock: 10 }, TOKEN_ADMIN);
const PROD1_ID = prod1.body?.data?._id;

let prod2 = await req("POST", "/api/products", { name: "Order Item 2", description: "Desc", price: 50, category: "Test", image: "img2.jpg", stock: 5 }, TOKEN_ADMIN);
const PROD2_ID = prod2.body?.data?._id;

const shippingAddress = {
  fullName: "John Doe",
  phone: "1234567890",
  address: "123 Main St",
  city: "Cityville",
  postalCode: "12345",
  country: "Countryland"
};

// ─── Tests ───────────────────────────────────────────────────────────────────

// Auth
const t13 = await req("POST", "/api/orders", { shippingAddress });
assert(13, "Create order without token", t13.status, t13.body, 401);
const t14 = await req("GET", "/api/orders");
assert(14, "Get orders without token", t14.status, t14.body, 401);
const t15 = await req("GET", "/api/orders/invalidid");
assert(15, "Get order without token", t15.status, t15.body, 401);

// Creation
const t2 = await req("POST", "/api/orders", { shippingAddress }, TOKEN_A);
assert(2, "Empty cart", t2.status, t2.body, 400);

await req("POST", "/api/cart", { productId: PROD1_ID, quantity: 2 }, TOKEN_A);
const t3 = await req("POST", "/api/orders", { shippingAddress: { fullName: "Missing fields" } }, TOKEN_A);
assert(3, "Missing shipping fields", t3.status, t3.body, 400);

// For missing product, add a dummy one then delete it behind the scenes
await mongoose.connect(process.env.MONGO_URI);
const dummyProd = await mongoose.connection.collection("products").insertOne({ name: "Dummy", price: 10, stock: 10, category: "Dummy", image: "dummy.jpg", description: "Dummy" });
await req("POST", "/api/cart", { productId: dummyProd.insertedId.toString(), quantity: 1 }, TOKEN_A);
await mongoose.connection.collection("products").deleteOne({ _id: dummyProd.insertedId });
const t4 = await req("POST", "/api/orders", { shippingAddress }, TOKEN_A);
assert(4, "Non-existent product in cart", t4.status, t4.body, 400);

// Clear cart after failure to reset for next test
await req("DELETE", "/api/cart", null, TOKEN_A);

// For insufficient stock: add legal amount to cart, then reduce DB stock so checkout fails
const addRes = await req("POST", "/api/cart", { productId: PROD2_ID, quantity: 4 }, TOKEN_A); // stock is 5, so legal

// Artificially reduce stock in DB behind the scenes
await mongoose.connect(process.env.MONGO_URI);
await mongoose.connection.collection("products").updateOne({ _id: new mongoose.Types.ObjectId(String(PROD2_ID)) }, { $set: { stock: 2 } });
await mongoose.disconnect();

const t5 = await req("POST", "/api/orders", { shippingAddress }, TOKEN_A);
assert(5, "Insufficient stock", t5.status, t5.body, 400);

// Verify atomicity on failure
const cartAfterFail = await req("GET", "/api/cart", null, TOKEN_A);
const stockAfterFail = await req("GET", `/api/products/${PROD2_ID}`);
const t29 = cartAfterFail.body?.data?.items?.length === 1;
assert(29, "Failed order does not partially clear cart", t29 ? 200 : 500, {}, 200, [`Cart items: ${cartAfterFail.body?.data?.items?.length}`]);
const t30 = stockAfterFail.body?.data?.stock === 2;
assert(30, "Failed order does not partially reduce stock", t30 ? 200 : 500, {}, 200, [`Stock: ${stockAfterFail.body?.data?.stock}`]);

// Restore DB stock and clear cart for next tests
await mongoose.connect(process.env.MONGO_URI);
await mongoose.connection.collection("products").updateOne({ _id: new mongoose.Types.ObjectId(String(PROD2_ID)) }, { $set: { stock: 5 } });
await mongoose.disconnect();
await req("DELETE", "/api/cart", null, TOKEN_A);
await req("POST", "/api/cart", { productId: PROD1_ID, quantity: 2 }, TOKEN_A); // 2 x 100 = 200
await req("POST", "/api/cart", { productId: PROD2_ID, quantity: 1 }, TOKEN_A); // 1 x 50 = 50

const t1 = await req("POST", "/api/orders", {
  shippingAddress,
  total: 5, // Client trying to cheat
  subtotal: 5,
  price: 5
}, TOKEN_A);
assert(1, "Create order with valid cart", t1.status, t1.body, 201);
const ORDER_ID = t1.body?.data?._id;

const t6 = t1.body?.data?.subtotal === 250;
assert(6, "Server calculates subtotal correctly", t6 ? 200 : 500, {}, 200, [`Subtotal: ${t1.body?.data?.subtotal}`]);

const t7 = t1.body?.data?.total === 270; // subtotal=250, shippingFee=0 (≥$100), tax=250×0.08=20 → total=270
assert(7, "Server calculates total correctly", t7 ? 200 : 500, {}, 200, [`Total: ${t1.body?.data?.total}`]);

const t8 = t1.body?.data?.total !== 5;
assert(8, "Client-supplied price is ignored", t8 ? 200 : 500, {}, 200);

const t9 = t1.body?.data?.subtotal !== 5;
assert(9, "Client-supplied total is ignored", t9 ? 200 : 500, {}, 200);

// Admin changes price
await req("PUT", `/api/products/${PROD1_ID}`, { price: 200 }, TOKEN_ADMIN);
const t10_order = await req("GET", `/api/orders/${ORDER_ID}`, null, TOKEN_A);
const oldPrice = t10_order.body?.data?.items?.find(i => i.product === PROD1_ID)?.price;
const t10 = oldPrice === 100;
assert(10, "Order stores product price snapshot", t10 ? 200 : 500, {}, 200, [`Snapshot price: ${oldPrice}`]);

const prod1Updated = await req("GET", `/api/products/${PROD1_ID}`);
const stockDecreased = prod1Updated.body?.data?.stock === 8; // 10 - 2 = 8
assert(11, "Product stock decreases after successful order", stockDecreased ? 200 : 500, {}, 200, [`New stock: ${prod1Updated.body?.data?.stock}`]);

const cartEmpty = await req("GET", "/api/cart", null, TOKEN_A);
assert(12, "Cart becomes empty after successful order", cartEmpty.body?.data?.items?.length === 0 ? 200 : 500, {}, 200);

// User Orders
const t16 = await req("GET", "/api/orders", null, TOKEN_A);
assert(16, "User can get own orders", t16.status, t16.body, 200);

const t17 = await req("GET", `/api/orders/${ORDER_ID}`, null, TOKEN_A);
assert(17, "User can get own order", t17.status, t17.body, 200);

const t18 = await req("GET", `/api/orders/${ORDER_ID}`, null, TOKEN_B);
assert(18, "User cannot access another user's order", t18.status, t18.body, 404);

// Cancellation
const t19 = await req("PATCH", `/api/orders/${ORDER_ID}/cancel`, null, TOKEN_A);
assert(19, "User can cancel eligible own order", t19.status, t19.body, 200);

const t22 = await req("PATCH", `/api/orders/${ORDER_ID}/cancel`, null, TOKEN_A);
assert(22, "User cannot cancel already cancelled order", t22.status, t22.body, 400);

const prod1Restored = await req("GET", `/api/products/${PROD1_ID}`);
const stockRestored = prod1Restored.body?.data?.stock === 10;
assert(23, "Stock is restored after cancellation", stockRestored ? 200 : 500, {}, 200, [`Restored stock: ${prod1Restored.body?.data?.stock}`]);

// Create another order for status tests
await req("POST", "/api/cart", { productId: PROD1_ID, quantity: 1 }, TOKEN_A);
const order2 = await req("POST", "/api/orders", { shippingAddress }, TOKEN_A);
const ORDER2_ID = order2.body?.data?._id;

// Admin Authorization
const t24 = await req("GET", "/api/orders/admin/all", null, TOKEN_A);
assert(24, "Normal user cannot access admin orders", t24.status, t24.body, 403);

const t25 = await req("PATCH", `/api/orders/admin/${ORDER2_ID}/status`, { orderStatus: "shipped" }, TOKEN_A);
assert(25, "Normal user cannot update order status", t25.status, t25.body, 403);

const t26 = await req("GET", "/api/orders/admin/all", null, TOKEN_ADMIN);
assert(26, "Admin can get all orders", t26.status, t26.body, 200, [`Total orders: ${t26.body?.data?.length}`]);

const t28 = await req("PATCH", `/api/orders/admin/${ORDER2_ID}/status`, { orderStatus: "fakeStatus" }, TOKEN_ADMIN);
assert(28, "Invalid status", t28.status, t28.body, 400);

const t27 = await req("PATCH", `/api/orders/admin/${ORDER2_ID}/status`, { orderStatus: "shipped" }, TOKEN_ADMIN);
assert(27, "Admin can update order status", t27.status, t27.body, 200);

const t20 = await req("PATCH", `/api/orders/${ORDER2_ID}/cancel`, null, TOKEN_A);
assert(20, "User cannot cancel shipped order", t20.status, t20.body, 400);

await req("PATCH", `/api/orders/admin/${ORDER2_ID}/status`, { orderStatus: "delivered" }, TOKEN_ADMIN);
const t21 = await req("PATCH", `/api/orders/${ORDER2_ID}/cancel`, null, TOKEN_A);
assert(21, "User cannot cancel delivered order", t21.status, t21.body, 400);

// Regression
const t31 = await req("GET", "/api/products");
assert(31, "Existing Product API still works", t31.status, t31.body, 200);

const t32 = await req("GET", "/api/auth/me", null, TOKEN_A);
assert(32, "Existing Auth API still works", t32.status, t32.body, 200);

const t33 = await req("GET", "/api/cart", null, TOKEN_A);
assert(33, "Existing Cart API still works", t33.status, t33.body, 200);

const t34 = await req("POST", "/api/products", { name: "X", description: "Y", price: 1, category: "Z", image: "W", stock: 1 }, TOKEN_A);
assert(34, "Existing Admin Product authorization still works", t34.status, t34.body, 403);

// ─── Cleanup test accounts ───────────────────────────────────────────────────
await mongoose.connection.collection("users").deleteMany({ email: { $in: ["ordera@test.com", "orderb@test.com", "adminorder@test.com"] } });
await mongoose.connection.collection("products").deleteMany({ name: { $in: ["Order Item 1", "Order Item 2"] } });
await mongoose.connection.collection("orders").deleteMany({});
await mongoose.disconnect();

console.log("═".repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
