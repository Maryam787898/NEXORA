import app from "../src/app.js";
import connectDB from "../src/config/db.js";

let connectionPromise;

const handler = async (req, res) => {
  if (!connectionPromise) {
    connectionPromise = connectDB();
  }

  try {
    await connectionPromise;
    return app(req, res);
  } catch (error) {
    connectionPromise = undefined;
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Database connection failed.",
    });
  }
};

export default handler;