import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import mongoose from "mongoose";
import User from "./src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

await mongoose.connect(process.env.MONGO_URI);
console.log("DB connected");

// Drop existing test user so we start fresh
await mongoose.connection.collection("users").deleteOne({ email: "debug@nexora.com" });

try {
  const user = await User.create({
    name: "Debug User",
    email: "debug@nexora.com",
    password: "secret123",
  });
  console.log("✅ User created:", user.name, user.email, user.role);
  console.log("   Password in doc (should be hash):", user.password ? "HIDDEN (select:false)" : "undefined");
} catch (e) {
  console.error("❌ Error name:", e.name);
  console.error("❌ Error message:", e.message);
  console.error("❌ Error code:", e.code);
  if (e.errors) {
    Object.entries(e.errors).forEach(([k, v]) => console.error(`   Field [${k}]:`, v.message));
  }
}

await mongoose.disconnect();
