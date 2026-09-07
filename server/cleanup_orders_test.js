import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

await mongoose.connect(process.env.MONGO_URI);

const r1 = await mongoose.connection.collection("users").deleteMany({
  email: { $in: ["ordera@test.com", "orderb@test.com", "adminorder@test.com"] },
});
const r2 = await mongoose.connection.collection("products").deleteMany({
  name: { $in: ["Order Item 1", "Order Item 2"] },
});
const r3 = await mongoose.connection.collection("orders").deleteMany({});
const r4 = await mongoose.connection.collection("carts").deleteMany({});

console.log(`Cleaned: ${r1.deletedCount} users, ${r2.deletedCount} products, ${r3.deletedCount} orders, ${r4.deletedCount} carts`);
await mongoose.disconnect();
