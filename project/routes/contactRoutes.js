// routes/contactRoutes.js
const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");

const contactFilePath = path.join(__dirname, "../data/contacts.json");
const { readJson } = require("../utils/jsonStore");

// Helper: Read contacts (tolerates missing/empty/malformed file)
async function readContacts() {
  return readJson(contactFilePath, []);
}

// POST /api/contact - Submit contact form
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    const contacts = await readContacts();

    const newContact = {
      id: "contact_" + Date.now(),
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "",
      subject: subject || "General Inquiry",
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    contacts.push(newContact);

    // Ensure directory/file exists or write securely
    const tempFilePath = path.join(__dirname, "../data/temp-contacts.json");
    await fs.writeFile(
      tempFilePath,
      JSON.stringify(contacts, null, 2),
      "utf-8",
    );
    await fs.rename(tempFilePath, contactFilePath);

    return res.status(201).json({
      success: true,
      message: "Contact message sent successfully!",
      data: newContact,
    });
  } catch (error) {
    console.error("Error saving contact:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while sending message.",
    });
  }
});

module.exports = router;
