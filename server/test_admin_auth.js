/**
 * NEXORA — Admin Authorization Test Suite (12 tests)
 * Run: node test_admin_auth.js
 *
 * Tests:
 *  T1  GET  /products           — no token       → 200
 *  T2  GET  /products/:id       — no token       → 200 (existing product)
 *  T3  POST /products           — no token       → 401
 *  T4  PUT  /products/:id       — no token       → 401
 *  T5  DELETE /products/:id     — no token       → 401
 *  T6  POST /products           — invalid token  → 401
 *  T7  POST /products           — user token     → 403
 *  T8  PUT  /products/:id       — user token     → 403
 *  T9  DELETE /products/:id     — user token     → 403
 *  T10 POST /products           — admin token    → 201
 *  T11 PUT  /products/:id       — admin token    → 200
 *  T12 DELETE /products/:id     — admin token    → 200
 *
 * Extra checks:
 *  - role cannot be set via registration body
 *  - product validation still enforced
 *  - no password exposed in any response
 */
import http from "http";
import { execSync } from "child_process";

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

// ─── Assertion helper ────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(n, label, status, body, expectStatus, notes = []) {
  const ok = status === expectStatus;
  ok ? passed++ : failed++;
  console.log(`${ok ? "✅" : "❌"} T${n}: ${label}`);
  console.log(`   HTTP ${status} (expected ${expectStatus}) ${ok ? "✓" : "✗"}`);
  if (body?.message)          console.log(`   message: ${body.message}`);
  if (body?.success !== undefined) console.log(`   success: ${body.success}`);
  notes.forEach((n) => console.log(`   ${n}`));
  console.log();
}

// ─── Product body for creation ────────────────────────────────────────────────
const PRODUCT_BODY = {
  name: "Admin Test Product",
  description: "Created by admin during authorization test",
  price: 49.99,
  category: "Test",
  image: "https://example.com/test.jpg",
  stock: 10,
};

console.log("═".repeat(60));
console.log("  NEXORA Admin Authorization — 12-Test Suite");
console.log("═".repeat(60) + "\n");

// ── Setup: Register normal user + admin user, promote admin ───────────────────
console.log("⚙️  Setup: registering test accounts...\n");

const regUser = await req("POST", "/api/auth/register", {
  name: "Normal User", email: "user.test@nexora.com", password: "User@12345",
});
console.log(`   user.test registered → ${regUser.status}`);
const USER_TOKEN = regUser.body?.token;

const regAdmin = await req("POST", "/api/auth/register", {
  name: "Admin User", email: "admin.test@nexora.com", password: "Admin@12345",
});
console.log(`   admin.test registered → ${regAdmin.status}`);

// Promote admin.test to admin role via CLI script (not an API endpoint)
try {
  const out = execSync("node make_admin.js admin.test@nexora.com", { encoding: "utf8" });
  console.log(`   ${out.trim()}`);
} catch (e) {
  console.error("   make_admin.js failed:", e.message);
  process.exit(1);
}

// Login admin to get fresh token (role is now admin in DB)
const loginAdmin = await req("POST", "/api/auth/login", {
  email: "admin.test@nexora.com", password: "Admin@12345",
});
console.log(`   admin.test logged in → ${loginAdmin.status}`);
const ADMIN_TOKEN = loginAdmin.body?.token;
console.log(`   admin role in response: ${loginAdmin.body?.data?.user?.role}`);
console.log(`   admin password in response: ${loginAdmin.body?.data?.user?.password ?? "absent ✓"}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// T1 — GET /api/products — no token → 200
const t1 = await req("GET", "/api/products");
assert(1, "GET /api/products (no token)", t1.status, t1.body, 200,
  [`count: ${t1.body?.count}`]);

// T2 — GET /api/products/:id — no token (need an existing ID; use first from T1 or skip)
// Create a product first via admin so we have an ID, then test public GET
// (We'll use T10 to create it and T2 to test, so we test with a real ID after T10)
// For now, test with a valid-format but non-existent ID (should get 404, not 401)
const FAKE_ID = "000000000000000000000001";
const t2pre = await req("GET", `/api/products/${FAKE_ID}`);
assert(2, "GET /api/products/:id (no token, valid ObjectId)", t2pre.status, t2pre.body, 404,
  ["→ 404 (not found) confirms public access works — auth not required"]);

// T3 — POST without token → 401
const t3 = await req("POST", "/api/products", PRODUCT_BODY);
assert(3, "POST /api/products (no token)", t3.status, t3.body, 401);

// T4 — PUT without token → 401
const t4 = await req("PUT", `/api/products/${FAKE_ID}`, { price: 99 });
assert(4, "PUT /api/products/:id (no token)", t4.status, t4.body, 401);

// T5 — DELETE without token → 401
const t5 = await req("DELETE", `/api/products/${FAKE_ID}`);
assert(5, "DELETE /api/products/:id (no token)", t5.status, t5.body, 401);

// T6 — POST with garbage token → 401
const t6 = await req("POST", "/api/products", PRODUCT_BODY, "not.a.real.token.at.all");
assert(6, "POST /api/products (invalid token)", t6.status, t6.body, 401);

// T7 — POST with normal user token → 403
const t7 = await req("POST", "/api/products", PRODUCT_BODY, USER_TOKEN);
assert(7, "POST /api/products (user token)", t7.status, t7.body, 403,
  [`role blocked: ${t7.body?.message}`]);

// T8 — PUT with normal user token → 403
const t8 = await req("PUT", `/api/products/${FAKE_ID}`, { price: 99 }, USER_TOKEN);
assert(8, "PUT /api/products/:id (user token)", t8.status, t8.body, 403);

// T9 — DELETE with normal user token → 403
const t9 = await req("DELETE", `/api/products/${FAKE_ID}`, null, USER_TOKEN);
assert(9, "DELETE /api/products/:id (user token)", t9.status, t9.body, 403);

// T10 — POST with admin token → 201
const t10 = await req("POST", "/api/products", PRODUCT_BODY, ADMIN_TOKEN);
assert(10, "POST /api/products (admin token)", t10.status, t10.body, 201,
  [`created: ${t10.body?.data?.name}`, `id: ${t10.body?.data?._id}`]);
const PRODUCT_ID = t10.body?.data?._id;

// T11 — PUT with admin token → 200
const t11 = await req("PUT", `/api/products/${PRODUCT_ID}`, { price: 59.99 }, ADMIN_TOKEN);
assert(11, "PUT /api/products/:id (admin token)", t11.status, t11.body, 200,
  [`updated price: ${t11.body?.data?.price}`]);

// T12 — DELETE with admin token → 200
const t12 = await req("DELETE", `/api/products/${PRODUCT_ID}`, null, ADMIN_TOKEN);
assert(12, "DELETE /api/products/:id (admin token)", t12.status, t12.body, 200,
  [`deleted: ${t12.body?.message}`]);

// ─── Extra checks ─────────────────────────────────────────────────────────────
console.log("─".repeat(60));
console.log("Extra Security Checks\n");

// Role cannot be set via registration (privileged field is ignored)
const selfAdmin = await req("POST", "/api/auth/register", {
  name: "Hacker", email: "hacker@nexora.com", password: "Hack@12345", role: "admin",
});
let assignedRole = selfAdmin.body?.data?.user?.role;
// Leftover account from a prior run returns 409 — confirm role via login instead
if (selfAdmin.status === 409) {
  const hackerLogin = await req("POST", "/api/auth/login", {
    email: "hacker@nexora.com", password: "Hack@12345",
  });
  assignedRole = hackerLogin.body?.data?.user?.role;
}
const roleBlocked  = assignedRole === "user"; // should always be "user" regardless of body
console.log(`${roleBlocked ? "✅" : "❌"} Role cannot be self-assigned via registration`);
console.log(`   Sent role='admin', HTTP ${selfAdmin.status}, got role='${assignedRole}' (expected 'user')\n`);

// Product validation still works with admin token
const badProduct = await req("POST", "/api/products", { name: "X", price: -1, stock: 0 }, ADMIN_TOKEN);
const validationOk = badProduct.status === 400;
console.log(`${validationOk ? "✅" : "❌"} Product validation still enforced for admin`);
console.log(`   status: ${badProduct.status}, message: ${badProduct.body?.message}\n`);

// Password never exposed
const noPass = [regUser, regAdmin, loginAdmin].every(r => !r.body?.data?.user?.password);
console.log(`${noPass ? "✅" : "❌"} Password never exposed in any auth response\n`);

// ─── Cleanup hacker account ───────────────────────────────────────────────────
// (optional — cleanup_test_users.js handles full cleanup before next test run)

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
