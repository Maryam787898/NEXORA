import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Sign a JWT for the given user id.
 * Throws clearly if JWT_SECRET is missing — no silent fallback.
 */
const signToken = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured in environment variables.");
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign({ id }, secret, { expiresIn });
};

/**
 * Send a consistent auth response: token + safe user object.
 * Password is never included here (Mongoose select:false + toJSON transform).
 */
const sendAuthResponse = (res, statusCode, user) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    data: { user },
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Create a new user account and return a JWT.
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic presence validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    // Check for existing account (normalised email)
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Create user — password is hashed in the pre-save hook.
    // Role is always "user". Client-supplied role/admin flags are ignored
    // so privilege cannot be self-assigned via registration.
    const user = await User.create({ name, email, password, role: "user" });

    sendAuthResponse(res, 201, user);
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }
    // Never leak internals
    res.status(500).json({ success: false, message: "Registration failed." });
  }
};

/**
 * POST /api/auth/login
 * Authenticate an existing user and return a JWT.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Explicitly select password because the schema has select:false
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+password"
    );

    if (!user) {
      // Use the same message for wrong email OR wrong password to avoid user enumeration
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Strip password before sending — toJSON transform handles this
    sendAuthResponse(res, 200, user);
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed." });
  }
};

/**
 * GET /api/auth/me
 * Return the currently authenticated user (set by protect middleware).
 * Password is already excluded by the middleware's .select('-password').
 */
export const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
};
