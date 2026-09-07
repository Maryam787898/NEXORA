import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ─── Protect: verify JWT and attach req.user ─────────────────────────────────
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Expect: Authorization: Bearer <token>
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Token is malformed.",
    });
  }

  // Fail loudly if JWT_SECRET was not set — never fall back to a default
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("❌ JWT_SECRET is not set in environment variables.");
    return res.status(500).json({
      success: false,
      message: "Server configuration error.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    // Fetch fresh user from DB — exclude password
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token is valid but the user no longer exists.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again.",
      });
    }
    // JsonWebTokenError, NotBeforeError, etc.
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// ─── Authorize: restrict access by role ──────────────────────────────────────
/**
 * Usage: router.delete('/:id', protect, authorizeRoles('admin'), handler)
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user?.role}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};
