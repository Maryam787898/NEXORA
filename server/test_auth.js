/**
 * NEXORA Auth API — Complete 12-test suite
 * Run with: node test_auth.js
 */
import http from "http";

const BASE = "http://localhost:5000";
const EMAIL = "nexora.test@example.com";
const PASS  = "Test@12345";
let TOKEN   = null;
let PASS_IN_DB = "unknown";

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function request(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);

    const req = http.request(
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
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, body: { error: "timeout" } }); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Result printer ───────────────────────────────────────────────────────────
function result(n, label, status, body, expectStatus, expectKey = null) {
  const statusOK = status === expectStatus;
  const keyOK    = expectKey === null ? true : body?.[expectKey] !== undefined;
  const pass     = statusOK && keyOK;
  const icon     = pass ? "✅" : "❌";
  const noPass   = body?.data?.user?.password === undefined;
  console.log(`${icon} T${n}: ${label}`);
  console.log(`   Status: ${status} (expected ${expectStatus}) ${statusOK ? "✓" : "✗"}`);
  if (expectKey) console.log(`   Has '${expectKey}': ${keyOK ? "yes ✓" : "no ✗"}`);
  if (body?.message) console.log(`   Message: ${body.message}`);
  if (body?.token)   console.log(`   Token: ${body.token.substring(0, 40)}...`);
  if (body?.data?.user) {
    const u = body.data.user;
    console.log(`   User: ${u.name} <${u.email}> role=${u.role}`);
    console.log(`   password field absent: ${noPass ? "✓" : "✗ FAIL — password exposed!"}`);
  }
  console.log();
}

// ─── Tests ───────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log("  NEXORA Auth API — 12-Test Suite");
console.log("═".repeat(60) + "\n");

// T1 — Register new user (201)
console.log("Running T1: Register new user...");
const t1 = await request("POST", "/api/auth/register", { name: "Nexora Tester", email: EMAIL, password: PASS });
result(1, "Register valid user", t1.status, t1.body, 201, "token");
if (t1.body?.token) TOKEN = t1.body.token;

// T2 — Duplicate email (409)
console.log("Running T2: Duplicate email...");
const t2 = await request("POST", "/api/auth/register", { name: "Nexora Tester", email: EMAIL, password: PASS });
result(2, "Register duplicate email", t2.status, t2.body, 409);

// T3 — Missing fields (400)
console.log("Running T3: Missing fields...");
const t3 = await request("POST", "/api/auth/register", { email: EMAIL });
result(3, "Register missing fields", t3.status, t3.body, 400);

// T4 — Login valid (200)
console.log("Running T4: Login valid credentials...");
const t4 = await request("POST", "/api/auth/login", { email: EMAIL, password: PASS });
result(4, "Login valid credentials", t4.status, t4.body, 200, "token");
if (t4.body?.token) TOKEN = t4.body.token; // refresh token

// T5 — Login wrong password (401)
console.log("Running T5: Wrong password...");
const t5 = await request("POST", "/api/auth/login", { email: EMAIL, password: "wrongpassword" });
result(5, "Login wrong password", t5.status, t5.body, 401);

// T6 — Login non-existent email (401)
console.log("Running T6: Non-existent email...");
const t6 = await request("POST", "/api/auth/login", { email: "nobody@nowhere.com", password: PASS });
result(6, "Login non-existent user", t6.status, t6.body, 401);

// T7 — /me no token (401)
console.log("Running T7: /me no token...");
const t7 = await request("GET", "/api/auth/me");
result(7, "/me without token", t7.status, t7.body, 401);

// T8 — /me invalid token (401)
console.log("Running T8: /me invalid token...");
const t8 = await request("GET", "/api/auth/me", null, "this.is.not.a.real.token");
result(8, "/me with invalid token", t8.status, t8.body, 401);

// T9 — /me valid token (200)
console.log("Running T9: /me valid token...");
const t9 = await request("GET", "/api/auth/me", null, TOKEN);
result(9, "/me with valid token", t9.status, t9.body, 200, "data");

// T10 — password not in response
console.log("T10: Password absent from all responses...");
const noPassT1 = t1.body?.data?.user?.password === undefined;
const noPassT4 = t4.body?.data?.user?.password === undefined;
const noPassT9 = t9.body?.data?.user?.password === undefined;
const t10pass  = noPassT1 && noPassT4 && noPassT9;
console.log(`${t10pass ? "✅" : "❌"} T10: Password never in API response`);
console.log(`   register response: ${noPassT1 ? "no password ✓" : "HAS PASSWORD ✗"}`);
console.log(`   login response:    ${noPassT4 ? "no password ✓" : "HAS PASSWORD ✗"}`);
console.log(`   /me response:      ${noPassT9 ? "no password ✓" : "HAS PASSWORD ✗"}`);
console.log();

// T11 — password is hashed in DB (verify via direct Mongoose query)
console.log("Running T11: Verifying password is hashed in MongoDB...");
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });
await mongoose.connect(process.env.MONGO_URI);
const raw = await mongoose.connection.collection("users").findOne({ email: EMAIL });
await mongoose.disconnect();
const isHashed = raw?.password?.startsWith("$2b$");
console.log(`${isHashed ? "✅" : "❌"} T11: Password stored as bcrypt hash`);
console.log(`   Stored value: ${raw?.password?.substring(0, 30) ?? "NOT FOUND"}...`);
console.log(`   Starts with $2b$: ${isHashed}`);
console.log();

// T12 — Product API regression
console.log("Running T12: Product API regression...");
const t12 = await request("GET", "/api/products");
result(12, "GET /api/products still works", t12.status, { ...t12.body, data: undefined }, 200);
console.log(`   count: ${t12.body?.count}, success: ${t12.body?.success}`);
console.log();

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log("  DONE — check ✅ / ❌ above for each test");
console.log("═".repeat(60));
