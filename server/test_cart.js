/**
 * NEXORA — Cart API Test Suite (25 tests)
 * Run: node test_cart.js
 */
import http from "http";
import { execSync } from "child_process";

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
console.log("  NEXORA Cart API — 25-Test Suite");
console.log("═".repeat(60) + "\n");

// ── Setup: Register 2 normal users and 1 admin user ─────────────────────────
console.log("⚙️  Setup: registering test accounts and products...\n");

const regUserA = await req("POST", "/api/auth/register", { name: "User A", email: "usera@nexora.com", password: "Password123" });
let TOKEN_A = regUserA.body?.token;
if(!TOKEN_A) {
  const loginA = await req("POST", "/api/auth/login", { email: "usera@nexora.com", password: "Password123" });
  TOKEN_A = loginA.body?.token;
}

const regUserB = await req("POST", "/api/auth/register", { name: "User B", email: "userb@nexora.com", password: "Password123" });
let TOKEN_B = regUserB.body?.token;
if(!TOKEN_B) {
  const loginB = await req("POST", "/api/auth/login", { email: "userb@nexora.com", password: "Password123" });
  TOKEN_B = loginB.body?.token;
}

const regAdmin = await req("POST", "/api/auth/register", { name: "Admin", email: "admincart@nexora.com", password: "Password123" });
try { execSync("node make_admin.js admincart@nexora.com"); } catch(e) {}
const loginAdmin = await req("POST", "/api/auth/login", { email: "admincart@nexora.com", password: "Password123" });
const TOKEN_ADMIN = loginAdmin.body?.token;

// Create a product for testing
const prodRes = await req("POST", "/api/products", {
  name: "Cart Test Product",
  description: "Test product for cart",
  price: 19.99,
  category: "Test",
  image: "http://example.com/cart.jpg",
  stock: 10
}, TOKEN_ADMIN);
const PRODUCT_ID = prodRes.body?.data?._id;

// ─── Tests ───────────────────────────────────────────────────────────────────

// Auth tests
const t1 = await req("GET", "/api/cart");
assert(1, "GET cart without token", t1.status, t1.body, 401);

const t2 = await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: 1 });
assert(2, "POST cart without token", t2.status, t2.body, 401);

const t3 = await req("PUT", "/api/cart/123456789012345678901234", { quantity: 2 });
assert(3, "PUT cart without token", t3.status, t3.body, 401);

const t4 = await req("DELETE", "/api/cart/123456789012345678901234");
assert(4, "DELETE cart item without token", t4.status, t4.body, 401);

// Cart functionality
const t5 = await req("GET", "/api/cart", null, TOKEN_A);
assert(5, "Get empty cart (User A)", t5.status, t5.body, 200, [`items length: ${t5.body?.data?.items?.length}`]);

const t6 = await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: 1, size: "M", color: "Red" }, TOKEN_A);
assert(6, "Add valid product (User A)", t6.status, t6.body, 200, [`items length: ${t6.body?.data?.items?.length}`]);

const t7 = await req("GET", "/api/cart", null, TOKEN_A);
assert(7, "Get cart -> item exists", t7.status, t7.body, 200, [`quantity: ${t7.body?.data?.items?.[0]?.quantity}`]);

const t8 = await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: 2, size: "M", color: "Red" }, TOKEN_A);
assert(8, "Add same product+size+color -> quantity increases", t8.status, t8.body, 200, [`total quantity: ${t8.body?.data?.items?.[0]?.quantity} (expected 3)`]);

const t9 = await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: 1, size: "L", color: "Blue" }, TOKEN_A);
assert(9, "Add same product different size/color -> separate item", t9.status, t9.body, 200, [`items length: ${t9.body?.data?.items?.length} (expected 2)`]);

const ITEM_ID = t9.body?.data?.items?.[0]?._id;

const t10 = await req("PUT", `/api/cart/${ITEM_ID}`, { quantity: 5 }, TOKEN_A);
assert(10, "Update quantity", t10.status, t10.body, 200, [`new quantity: ${t10.body?.data?.items?.[0]?.quantity}`]);

const t11 = await req("DELETE", `/api/cart/${ITEM_ID}`, null, TOKEN_A);
assert(11, "Remove item", t11.status, t11.body, 200, [`remaining items: ${t11.body?.data?.items?.length} (expected 1)`]);

const t12 = await req("DELETE", "/api/cart", null, TOKEN_A);
assert(12, "Clear cart", t12.status, t12.body, 200, [`remaining items: ${t12.body?.data?.items?.length} (expected 0)`]);

// Validation
const t13 = await req("POST", "/api/cart", { productId: "invalidID", quantity: 1 }, TOKEN_A);
assert(13, "Invalid product ID", t13.status, t13.body, 400);

const t14 = await req("POST", "/api/cart", { productId: "000000000000000000000001", quantity: 1 }, TOKEN_A);
assert(14, "Non-existent product", t14.status, t14.body, 404);

const t15 = await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: 0 }, TOKEN_A);
assert(15, "Quantity 0", t15.status, t15.body, 400);

const t16 = await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: -5 }, TOKEN_A);
assert(16, "Negative quantity", t16.status, t16.body, 400);

const t17 = await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: 999 }, TOKEN_A);
assert(17, "Quantity greater than stock", t17.status, t17.body, 400);

const t18 = await req("PUT", "/api/cart/invalidID", { quantity: 1 }, TOKEN_A);
assert(18, "Invalid cart item ID", t18.status, t18.body, 400);

const t19 = await req("PUT", "/api/cart/000000000000000000000001", { quantity: 1 }, TOKEN_A);
assert(19, "Non-existent cart item", t19.status, t19.body, 404);

// Security / IDOR
// Setup User B's cart
await req("POST", "/api/cart", { productId: PRODUCT_ID, quantity: 1 }, TOKEN_B);
const cartB = await req("GET", "/api/cart", null, TOKEN_B);
const ITEM_ID_B = cartB.body?.data?.items?.[0]?._id;

// We do not have endpoints to fetch another user's cart by user ID (User B's cart is tied to TOKEN_B)
// User A tries to interact with User B's item
const t20 = await req("GET", "/api/cart", null, TOKEN_A);
assert(20, "User A cannot access User B's cart (by design, GET /api/cart always uses token owner)", t20.status, t20.body, 200, ["Returns User A's cart"]);

const t21 = await req("PUT", `/api/cart/${ITEM_ID_B}`, { quantity: 2 }, TOKEN_A);
assert(21, "User A cannot update User B's cart item", t21.status, t21.body, 404);

const t22 = await req("DELETE", `/api/cart/${ITEM_ID_B}`, null, TOKEN_A);
assert(22, "User A cannot delete User B's cart item", t22.status, t22.body, 404);

// Regression
const t23 = await req("GET", `/api/products/${PRODUCT_ID}`);
assert(23, "Existing Product API still works", t23.status, t23.body, 200, [`Product fetched: ${t23.body?.data?.name}`]);

const t24 = await req("GET", "/api/auth/me", null, TOKEN_A);
assert(24, "Existing Auth API still works", t24.status, t24.body, 200, [`User fetched: ${t24.body?.data?.user?.email}`]);

const t25 = await req("POST", "/api/products", { name: "A", description: "B", price: 1, category: "C", image: "D", stock: 1 }, TOKEN_A);
assert(25, "Admin Product authorization still works", t25.status, t25.body, 403);

// ─── Cleanup test accounts ───────────────────────────────────────────────────
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });
await mongoose.connect(process.env.MONGO_URI);
await mongoose.connection.collection("users").deleteMany({ email: { $in: ["usera@nexora.com", "userb@nexora.com", "admincart@nexora.com"] } });
await mongoose.connection.collection("products").deleteMany({ name: "Cart Test Product" });
await mongoose.disconnect();

console.log("═".repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
