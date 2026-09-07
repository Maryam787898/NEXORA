import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true, // normalize before saving
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never returned in queries by default
    },

    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "Role must be either 'user' or 'admin'",
      },
      default: "user",
    },
  },
  { timestamps: true }
);

// ─── Hash password before saving ─────────────────────────────────────────────
// Mongoose 7+: async pre-hooks are Promise-based — do NOT use next()
userSchema.pre("save", async function () {
  // Only hash if the password field was actually modified
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10); // 10 rounds = industry standard (secure + fast)
  this.password = await bcrypt.hash(this.password, salt);
});



// ─── Instance method: compare plain password with stored hash ─────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Omit password from all toJSON / toObject output ─────────────────────────
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
