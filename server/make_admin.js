/**
 * make_admin.js — Development-only script to promote a user to admin role.
 *
 * Usage:
 *   node make_admin.js <email>
 *
 * Example:
 *   node make_admin.js admin@nexora.com
 *
 * This script is intentionally NOT exposed as an API endpoint.
 * Run it locally from the server/ directory only.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import mongoose from "mongoose";
import User from "./src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

const email = process.argv[2];
if (!email) {
  console.error("❌  Usage: node make_admin.js <email>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOneAndUpdate(
  { email: email.toLowerCase().trim() },
  { role: "admin" },
  { new: true }
);

if (!user) {
  console.error(`❌  No user found with email: ${email}`);
  console.error("    Register the account first via POST /api/auth/register");
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`✅  ${user.name} <${user.email}> is now role="${user.role}"`);
await mongoose.disconnect();
