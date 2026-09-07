import mongoose from "mongoose";

/**
 * Connect to MongoDB database using Mongoose.
 * Assumes dotenv has already been loaded before this is called.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error("❌ MONGO_URI is not defined in environment variables.");
    throw new Error("MONGO_URI is not defined in environment variables.");
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

export default connectDB;
