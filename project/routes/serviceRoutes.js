// routes/serviceRoutes.js
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { readJson } = require("../utils/jsonStore");

const router = express.Router();

// Data file path
const dataFilePath = path.join(__dirname, "../data/services.json");

// Helper: Read services.json safely (tolerates missing/empty/malformed file)
async function readServices() {
  return readJson(dataFilePath, []);
}

// Helper: Save to services.json
async function writeServices(services) {
  await fs.writeFile(dataFilePath, JSON.stringify(services, null, 2), "utf-8");
}

// GET /api/services - Public/Authenticated access for fetching services list
router.get("/", async (req, res) => {
  try {
    const services = await readServices();

    return res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Error reading services.json:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while reading services data.",
    });
  }
});

// POST /api/services (Admin only) - Create a new service
router.post("/", verifyToken, isAdmin, async (req, res) => {
  const { name, price, duration, description, category, imageUrl } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({
      success: false,
      message: "Service name aur price dena zaroori hai.",
    });
  }

  const parsedPrice = Number(price);
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "Price ek valid positive number honi chahiye.",
    });
  }

  try {
    const services = await readServices();

    // Prevent duplicate service names (case-insensitive)
    const exists = services.some(
      (s) => s.name && s.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Iss naam ki service pehle se exist karti hai.",
      });
    }

    const newService = {
      id: "svc_" + Date.now().toString(),
      name: name.trim(),
      price: parsedPrice,
      duration: duration || "N/A",
      description: description ? description.trim() : "",
      category: category ? category.trim() : "General",
      imageUrl: imageUrl || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    services.push(newService);
    await writeServices(services);

    return res.status(201).json({
      success: true,
      message: "Service create ho gayi!",
      data: newService,
    });
  } catch (error) {
    console.error("Error creating service:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating service.",
    });
  }
});

// PUT /api/services/:id (Admin only) - Update existing service
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, price, duration, description, category, imageUrl } = req.body;

  try {
    const services = await readServices();
    const index = services.findIndex(
      (s) => String(s.id) === String(id) || String(s._id) === String(id)
    );

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Service nahi mili." });
    }

    if (name !== undefined) services[index].name = name.trim();
    if (duration !== undefined) services[index].duration = duration;
    if (description !== undefined) services[index].description = description.trim();
    if (category !== undefined) services[index].category = category.trim();
    if (imageUrl !== undefined) services[index].imageUrl = imageUrl;

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Price ek valid positive number honi chahiye.",
        });
      }
      services[index].price = parsedPrice;
    }

    services[index].updatedAt = new Date().toISOString();

    await writeServices(services);

    return res.status(200).json({
      success: true,
      message: "Service update ho gayi!",
      data: services[index],
    });
  } catch (error) {
    console.error("Error updating service:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating service.",
    });
  }
});

// DELETE /api/services/:id (Admin only) - Delete service
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const services = await readServices();
    const index = services.findIndex(
      (s) => String(s.id) === String(id) || String(s._id) === String(id)
    );

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Service nahi mili." });
    }

    const [removed] = services.splice(index, 1);
    await writeServices(services);

    return res.status(200).json({
      success: true,
      message: "Service delete ho gayi!",
      data: removed,
    });
  } catch (error) {
    console.error("Error deleting service:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting service.",
    });
  }
});

module.exports = router;