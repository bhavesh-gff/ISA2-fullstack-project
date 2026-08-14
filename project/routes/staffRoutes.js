// routes/staffRoutes.js
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const bcrypt = require("bcryptjs");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { readJson } = require("../utils/jsonStore");

const router = express.Router();
const usersFilePath = path.join(__dirname, "../data/users.json");

// UUID Generator (Unique ID)
function generateUUID() {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 15);
  return `staff_${time}-${random}`;
}

// Atomic Write Function (Prevents Data Corruption)
async function writeUsers(users) {
  const tempFilePath = path.join(__dirname, "../data/temp-users.json");
  try {
    await fs.writeFile(tempFilePath, JSON.stringify(users, null, 2), "utf-8");
    await fs.rename(tempFilePath, usersFilePath);
  } catch (error) {
    fs.unlink(tempFilePath).catch(() => {}); // Cleanup temp file
    throw new Error("Data write failed - rollback applied");
  }
}

// Helper: Safely read users file (tolerates missing/empty/malformed file)
async function readUsers() {
  return readJson(usersFilePath, []);
}

// 1. GET /api/staff (Admin only) - Fetch all staff members
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await readUsers();
    const staffList = users
      .filter((u) => u.role === "staff")
      .map(({ password, ...safeUser }) => safeUser);
    return res.status(200).json({ success: true, data: staffList });
  } catch (error) {
    console.error("Error fetching staff:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching staff.",
    });
  }
});

// 2. POST /api/staff (Admin only) - Create new staff
router.post("/", verifyToken, isAdmin, async (req, res) => {
  const { name, email, password, phone, specialization } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email aur password dena zaroori hai.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password kam se kam 6 characters ka hona chahiye.",
    });
  }

  try {
    const users = await readUsers();
    const cleanEmail = email.toLowerCase().trim();

    const existing = users.find(
      (u) => u.email && u.email.toLowerCase().trim() === cleanEmail,
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Is email se pehle se ek account maujood hai.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newStaff = {
      id: generateUUID(), // ✅ Unique ID
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : "",
      specialization: specialization ? specialization.trim() : "General Staff",
      password: hashedPassword,
      role: "staff",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newStaff);
    await writeUsers(users); // ✅ Atomic write

    const { password: _pw, ...safeStaff } = newStaff;

    return res.status(201).json({
      success: true,
      message: "Staff account create ho gaya!",
      data: safeStaff,
    });
  } catch (error) {
    console.error("Error creating staff:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating staff account.",
    });
  }
});

// 3. PUT /api/staff/:id (Admin only) - Update staff details
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, specialization, status, password } = req.body;

  try {
    const users = await readUsers();
    const index = users.findIndex(
      (u) =>
        (String(u.id) === String(id) || String(u._id) === String(id)) &&
        u.role === "staff",
    );

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Staff account nahi mila." });
    }

    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const duplicate = users.find(
        (u, idx) =>
          idx !== index &&
          u.email &&
          u.email.toLowerCase().trim() === cleanEmail,
      );
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Yeh email pehle se use mein hai.",
        });
      }
      users[index].email = cleanEmail;
    }

    if (name !== undefined) users[index].name = name.trim();
    if (phone !== undefined) users[index].phone = phone.trim();
    if (specialization !== undefined)
      users[index].specialization = specialization.trim();
    if (status !== undefined) users[index].status = status;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Naya password kam se kam 6 characters ka hona chahiye.",
        });
      }
      users[index].password = await bcrypt.hash(password, 10);
    }

    users[index].updatedAt = new Date().toISOString();

    await writeUsers(users); // ✅ Atomic write

    const { password: _pw, ...safeUpdatedStaff } = users[index];

    return res.status(200).json({
      success: true,
      message: "Staff details update ho gayi!",
      data: safeUpdatedStaff,
    });
  } catch (error) {
    console.error("Error updating staff:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating staff.",
    });
  }
});

// 4. DELETE /api/staff/:id (Admin only) - Remove staff account
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const users = await readUsers();
    const index = users.findIndex(
      (u) =>
        (String(u.id) === String(id) || String(u._id) === String(id)) &&
        u.role === "staff",
    );

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Staff account nahi mila." });
    }

    const [removed] = users.splice(index, 1);
    await writeUsers(users); // ✅ Atomic write

    const { password: _pw, ...safeRemoved } = removed;

    return res.status(200).json({
      success: true,
      message: "Staff account remove ho gaya.",
      data: safeRemoved,
    });
  } catch (error) {
    console.error("Error removing staff:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing staff.",
    });
  }
});

module.exports = router;
