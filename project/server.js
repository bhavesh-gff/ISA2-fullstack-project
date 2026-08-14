// server.js - Main Entry Point for Smart Salon Application
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// 1. Saare Route Modules Import Karein
const appointmentsRoutes = require("./routes/appointmentsRoutes");
const contactsRoutes = require("./routes/contactRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const authRoutes = require("./routes/authRoutes");
const noShowRoutes = require("./routes/noShowRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const staffRoutes = require("./routes/staffRoutes");
const reportRoutes = require("./routes/reportRoutes");
const { startReminderJob } = require("./jobs/reminderJob");

// 2. Express App Initialize Karein
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Middlewares Configure Karein
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Frontend Static Files Serve Karein
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
  console.log("Incoming Request URL:", req.method, req.url);
  next();
});

// 5. APIs ko Mount Karein (Yahan 'contacts' ko 'contact' kar diya hai)
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/contact", contactsRoutes); // ✅ FIXED: ab yeh /api/contact ban gaya hai
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/reports", reportRoutes);

// noShowRoutes relative paths handle karta hai (/noshows/:id/noshow aur /noshows/repeat)
app.use("/api/noshows", noShowRoutes);
app.use("/api", noShowRoutes); // Fallback mapping for /api/appointments/:id/noshow

// Basic API Status Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Salon API Backend is running smoothly!",
    timestamp: new Date().toISOString(),
  });
});

// 6. SPA / Page Refresh Fallback
app.get("/*splat", (req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    return next();
  }
  const indexPath = path.join(__dirname, "public", "index.html");
  return res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send("Smart Salon Backend is Running.");
    }
  });
});

// 7. Global 404 Route Handling
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint nahi mila. Please check URL.",
  });
});

// 8. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Global Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error. Please try again later.",
  });
});

// 9. Server Start Karein
const server = app.listen(PORT, () => {
  console.log(
    `[SERVER] Smart Salon backend successfully running on http://localhost:${PORT}`,
  );
  // Start the appointment reminder cron job. Wrapped so a scheduler
  // failure never prevents the HTTP server from staying up.
  try {
    startReminderJob();
  } catch (error) {
    console.error("[CRON] Failed to start reminder job:", error.message);
  }
});

// Graceful Shutdown Handling
process.on("SIGINT", () => {
  console.log("\nShutting down server gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});
