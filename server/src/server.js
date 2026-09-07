import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import app from "./app.js";
import connectDB from "./config/db.js";

// Resolve __dirname for ES Modules (not available by default)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the server root (one level above src/)
dotenv.config({ path: resolve(__dirname, "../.env") });

const PORT = process.env.PORT || 5000;

// Connect to MongoDB, then start the Express server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(
        `🚀 NEXORA Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(`❌ Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
