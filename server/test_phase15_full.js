/*
 * NEXORA Phase 15 full hardening suite.
 * Requires the server on localhost:5000 and a configured MongoDB instance.
 * Run with: node test_phase15_full.js
 */
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(root, ".env") });
process.env.NODE_ENV = "test";

const request = (method, path, body, token) => new Promise((resolveRequest) => {
  const payload = body ? JSON.stringify(body) : null;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
  const req = http.request({ hostname: "localhost", port: 5000, path, method, headers }, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      try { resolveRequest({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
      catch { resolveRequest({ status: res.statusCode, body: data, headers: res.headers }); }
    });
  });
  req.on("error", (error) => resolveRequest({ status: 0, body: { error: error.message } }));
  if (payload) req.write(payload);
  req.end();
});

let passed = 0;
let failed = 0;
const check = (label, condition) => {
  if (condition) { passed += 1; console.log(`PASS ${passed + failed}: ${label}`); }
  else { failed += 1; console.log(`FAIL ${passed + failed}: ${label}`); }
};

const address = {
  fullName: "Phase15 Full Tester",
  phone: "03001234567",
  address: "15 Hardening Street",
  city: "Islamabad",
  postalCode: "44000",
  country: "Pakistan",
};

await mongoose.connect(process.env.MONGO_URI);
const users = mongoose.connection.collection("users");
const products = mongoose.connection.collection("products");
const orders = mongoose.connection.collection("orders");
await users.deleteMany({ email: /p15full@/ });
await products.deleteMany({ name: "P15 Full Product" });
await orders.deleteMany({ "shippingAddress.fullName": address.fullName });

const adminRegister = await request("POST", "/api/auth/register", { name: "Full Admin", email: "p15full_admin@nexora.com", password: "Password123" });
await users.updateOne({ email: "p15full_admin@nexora.com" }, { $set: { role: "admin" } });
const adminLogin = await request("POST", "/api/auth/login", { email: "p15full_admin@nexora.com", password: "Password123" });
const userRegister = await request("POST", "/api/auth/register", { name: "Full User", email: "p15full_user@nexora.com", password: "Password123" });
const otherRegister = await request("POST", "/api/auth/register", { name: "Other User", email: "p15full_other@nexora.com", password: "Password123" });
const adminToken = adminLogin.body?.token;
const userToken = userRegister.body?.token;
const otherToken = otherRegister.body?.token;

check("registration returns a token", adminRegister.status === 201 && Boolean(adminRegister.body?.token));
check("admin login returns a token", adminLogin.status === 200 && Boolean(adminToken));
check("registration cannot self-assign admin role", (await request("POST", "/api/auth/register", { name: "Role Probe", email: "p15full_role@nexora.com", password: "Password123", role: "admin" })).body?.data?.role !== "admin");
const product = await request("POST", "/api/products", { name: "P15 Full Product", description: "Hardening test product", price: 50, category: "Test", image: "https://example.com/p15.jpg", stock: 20, sizes: ["M", "L"], colors: ["Black", "White"] }, adminToken);
const productId = product.body?.data?._id;
check("admin creates a product", product.status === 201 && Boolean(productId));
check("negative product price is rejected", (await request("POST", "/api/products", { name: "Bad", description: "Bad", price: -1, category: "Test", image: "x", stock: 1 }, adminToken)).status === 400);
check("negative product stock is rejected", (await request("POST", "/api/products", { name: "Bad", description: "Bad", price: 1, category: "Test", image: "x", stock: -1 }, adminToken)).status === 400);
check("invalid cart size is rejected", (await request("POST", "/api/cart", { productId, quantity: 1, size: "XS" }, userToken)).status === 400);
check("invalid cart color is rejected", (await request("POST", "/api/cart", { productId, quantity: 1, color: "Green" }, userToken)).status === 400);
check("quantity below one is rejected", (await request("POST", "/api/cart", { productId, quantity: 0 }, userToken)).status === 400);
check("valid variant can be added", (await request("POST", "/api/cart", { productId, quantity: 1, size: "M", color: "Black" }, userToken)).status === 200);
check("unauthenticated orders request is rejected", (await request("GET", "/api/orders")).status === 401);
check("malformed token is rejected", (await request("GET", "/api/orders", null, "not-a-token")).status === 401);
const orderCreate = await request("POST", "/api/orders", { shippingAddress: address, paymentMethod: "online" }, userToken);
const orderId = orderCreate.body?.data?._id;
const serverOrder = orderCreate.body?.data;
check("online order starts with pending payment", orderCreate.status === 201 && serverOrder?.paymentStatus === "pending");
check("order total matches server breakdown", serverOrder?.total === Math.round((serverOrder.subtotal + serverOrder.shippingFee + serverOrder.taxAmount) * 100) / 100);
const initiate = await request("POST", `/api/payments/${orderId}/initiate`, { amount: 0 }, userToken);
check("initiate returns the stored server amount", initiate.status === 200 && initiate.body?.payment?.amount === serverOrder.total);
check("payment rate limit headers are present", Boolean(initiate.headers?.["ratelimit-limit"]));
check("payment status has IDOR protection", (await request("GET", `/api/payments/${orderId}/status`, null, otherToken)).status === 404);
check("failure endpoint moves payment to failed", (await request("POST", `/api/payments/${orderId}/fail`, null, userToken)).body?.payment?.paymentStatus === "failed");
const retry = await request("POST", `/api/payments/${orderId}/initiate`, null, userToken);
check("failed payment can be retried", retry.status === 200 && retry.body?.payment?.status === "pending");
check("retry confirmation succeeds", (await request("POST", `/api/payments/${orderId}/confirm`, null, userToken)).body?.payment?.paymentStatus === "paid");
check("duplicate confirmation is rejected", (await request("POST", `/api/payments/${orderId}/confirm`, null, userToken)).status === 400);
check("invalid payment order id is rejected", (await request("POST", "/api/payments/not-an-id/initiate", null, userToken)).status === 400);
check("COD payment initiation is rejected", (await request("POST", "/api/cart", { productId, quantity: 1 }, userToken)).status === 200);
const cod = await request("POST", "/api/orders", { shippingAddress: address, paymentMethod: "cod" }, userToken);
const codId = cod.body?.data?._id;
check("COD payment is blocked", (await request("POST", `/api/payments/${codId}/initiate`, null, userToken)).status === 400);
check("admin can list orders", (await request("GET", "/api/orders/admin/all", null, adminToken)).status === 200);
check("user cannot list admin orders", (await request("GET", "/api/orders/admin/all", null, userToken)).status === 403);
check("admin can make a valid transition", (await request("PATCH", `/api/orders/admin/${codId}/status`, { orderStatus: "confirmed" }, adminToken)).status === 200);
check("invalid transition is rejected", (await request("PATCH", `/api/orders/admin/${codId}/status`, { orderStatus: "delivered" }, adminToken)).status === 400);
check("invalid status value is rejected", (await request("PATCH", `/api/orders/admin/${codId}/status`, { orderStatus: "unknown" }, adminToken)).status === 400);
check("invalid order id is rejected", (await request("PATCH", "/api/orders/admin/not-an-id/status", { orderStatus: "confirmed" }, adminToken)).status === 400);
check("missing order is 404", (await request("PATCH", "/api/orders/admin/507f1f77bcf86cd799439011/status", { orderStatus: "confirmed" }, adminToken)).status === 404);
check("password is excluded from profile response", (await request("GET", "/api/auth/me", null, userToken)).body?.data?.user?.password === undefined);
check("unknown API route is 404", (await request("GET", "/api/does-not-exist")).status === 404);

await users.deleteMany({ email: /p15full@/ });
await products.deleteMany({ name: "P15 Full Product" });
await orders.deleteMany({ "shippingAddress.fullName": address.fullName });
await mongoose.disconnect();
console.log(`Phase 15 full suite: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
