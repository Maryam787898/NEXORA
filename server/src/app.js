import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

// ─── Security Headers (helmet) ────────────────────────────────────────────────
// Sets X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, etc.
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In development CLIENT_URL defaults to localhost:5173.
// In production set CLIENT_URL to the real frontend origin in .env.
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ─── Body Parsers (with size limits) ──────────────────────────────────────────
// 10 KB limit prevents oversized payload attacks.
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── Rate Limiting on Auth Endpoints ─────────────────────────────────────────
// 30 requests per 15-minute window per IP (unrestricted in test environment)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
});

// ─── Rate Limiting on Payment Endpoints ──────────────────────────────────────
// 20 requests per 15-minute window — prevents brute-force payment attempts
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment requests. Please try again later.",
  },
});

// ─── General API Rate Limiter (safety net) ───────────────────────────────────
// 200 requests per 15-minute window — broad protection against API abuse
// Applied AFTER more specific limiters so they take precedence
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 5000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NEXORA API is running",
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// General rate limiter as a safety net on all API routes
app.use("/api", generalLimiter);

app.use("/api/products", productRoutes);
// Rate limit only the mutation auth endpoints (login + register) not /me
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentLimiter);
app.use("/api/payments", paymentRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Last-resort handler — never exposes stack traces or internal details in production.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === "development";

  // Log full error server-side in all environments for debugging
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: `Invalid ID format: ${err.value}` });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(", ") });
  }

  // Mongoose duplicate key (e.g. unique email)
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate value for a unique field." });
  }

  // JWT errors that somehow slip through (belt-and-suspenders)
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }

  // Generic 500 — never expose stack trace or internal message in production
  res.status(err.statusCode || 500).json({
    success: false,
    message: isDev ? err.message : "Internal server error.",
    ...(isDev && { stack: err.stack }),
  });
});

export default app;
