import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

await mongoose.connect(process.env.MONGO_URI);
const r = await mongoose.connection.collection("users").deleteMany({
  email: {
    $in: [
      "admin.test@nexora.com",
      "user.test@nexora.com",
      "nexora.test@example.com",
      "hacker@nexora.com",
      "order_user1@nexora.com",
      "order_user2@nexora.com",
      "order_admin@nexora.com",
      "usera@nexora.com",
      "userb@nexora.com",
      "admin@nexora.com",
      "p13_u1@nexora.com",
      "p13_u2@nexora.com",
      "p13_admin@nexora.com",
      "p15_u1@nexora.com",
      "p15_u2@nexora.com",
      "p15_admin@nexora.com",
      "ordera@test.com",
      "orderb@test.com",
      "adminorder@test.com",
    ],
  },
});
console.log(`Cleaned ${r.deletedCount} test user(s)`);
await mongoose.disconnect();
