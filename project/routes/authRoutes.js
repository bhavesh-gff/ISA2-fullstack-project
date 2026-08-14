// routes/auth.js
const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../middleware/authMiddleware");
const { readJson } = require("../utils/jsonStore");

// File path
const usersFilePath = path.join(__dirname, "../data/users.json");

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "smart_salon_secret_key_123";

// Helper function to read users safely (tolerates missing/empty/malformed file)
async function readUsers() {
  return readJson(usersFilePath, []);
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const users = await readUsers();

    // Email matching with case-insensitivity and trim
    const cleanEmail = email.toLowerCase().trim();
    const user = users.find(
      (u) => u.email && u.email.toLowerCase().trim() === cleanEmail,
    );

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    // Safe Password Match (Handles bcrypt hashes + dev plaintext safety)
    let isMatch = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = password === user.password;
    }

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const userId = user.id || user._id;

    // JWT Token Payload
    const token = jwt.sign(
      {
        id: userId,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: "1d" },
    );

    // Success response including normalized user details
    return res.json({
      success: true,
      message: "Login successful!",
      token: token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error. Please try again." });
  }
});

// GET /api/auth/me (Get current authenticated user details)
router.get("/me", verifyToken, (req, res) => {
  try {
    return res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("Auth Check Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error verifying authentication.",
      });
  }
});

module.exports = router;
