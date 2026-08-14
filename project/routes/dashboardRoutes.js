// routes/dashboardRoutes.js
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { readJson } = require("../utils/jsonStore");

const router = express.Router();
const appointmentsFilePath = path.join(__dirname, "../data/appointments.json");
const servicesFilePath = path.join(__dirname, "../data/services.json");

async function readJsonFile(filePath) {
  return readJson(filePath, []);
}

// Helper: Get local YYYY-MM-DD date string safely
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: Get service price safely from appointment object or services list
function getServicePrice(appointment, servicesList) {
  if (!appointment) return 0;

  // 1. Check direct price field in appointment object
  if (appointment.price && !isNaN(Number(appointment.price))) {
    return Number(appointment.price);
  }

  const serviceLabel = appointment.service || "";
  if (!serviceLabel) return 0;

  // 2. Try exact/partial match with services list
  const matched = servicesList.find(
    (s) => s.name && serviceLabel.toLowerCase().includes(s.name.toLowerCase()),
  );
  if (matched && matched.price) return Number(matched.price) || 0;

  // 3. Fallback: Parse price from label string (e.g., "$85" or "85")
  const priceMatch = serviceLabel.match(/\$?([\d,.]+)/);
  if (priceMatch) {
    return parseFloat(priceMatch[1].replace(/,/g, "")) || 0;
  }

  return 0;
}

// GET /api/dashboard/stats (Admin only) - Overall dashboard metrics & KPI cards
router.get("/stats", verifyToken, isAdmin, async (req, res) => {
  try {
    const [appointments, services] = await Promise.all([
      readJsonFile(appointmentsFilePath),
      readJsonFile(servicesFilePath),
    ]);

    const todayStr = getTodayDateString();

    const totalBookings = appointments.length;
    const todaysAppointments = appointments.filter((a) =>
      (a.date || "").startsWith(todayStr),
    ).length;
    const completed = appointments.filter(
      (a) => a.status === "Completed",
    ).length;
    const cancelled = appointments.filter(
      (a) => a.status === "Cancelled" || a.status === "Rejected",
    ).length;
    const noShows = appointments.filter((a) => a.status === "No-Show").length;
    const pending = appointments.filter(
      (a) => !a.status || a.status === "Pending",
    ).length;
    const confirmed = appointments.filter(
      (a) => a.status === "Confirmed",
    ).length;

    // Direct revenue estimation for dashboard KPI display
    const totalRevenue = appointments
      .filter((a) => a.status === "Completed")
      .reduce((sum, a) => sum + getServicePrice(a, services), 0);

    return res.status(200).json({
      success: true,
      data: {
        totalBookings,
        todaysAppointments,
        completed,
        cancelled,
        noShows,
        pending,
        confirmed,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard stats.",
    });
  }
});

// GET /api/dashboard/report?period=daily|monthly (Admin only) - Analytics & Revenue Report
router.get("/report", verifyToken, isAdmin, async (req, res) => {
  const period = (req.query.period || "daily").toLowerCase();

  if (!["daily", "monthly"].includes(period)) {
    return res.status(400).json({
      success: false,
      message: "period query param 'daily' ya 'monthly' hona chahiye.",
    });
  }

  try {
    const [appointments, services] = await Promise.all([
      readJsonFile(appointmentsFilePath),
      readJsonFile(servicesFilePath),
    ]);

    // Sirf Completed appointments hi revenue mein count hoti hain
    const completedAppointments = appointments.filter(
      (a) => a.status === "Completed",
    );

    // Grouping key: daily -> date (YYYY-MM-DD), monthly -> YYYY-MM
    const groups = {};

    completedAppointments.forEach((a) => {
      let rawDate = a.date || "";
      if (rawDate.includes("T")) {
        rawDate = rawDate.split("T")[0]; // Handle ISO date strings
      }

      const key = period === "daily" ? rawDate : rawDate.slice(0, 7);
      if (!key) return;

      const price = getServicePrice(a, services);

      if (!groups[key]) {
        groups[key] = { period: key, totalBookings: 0, revenue: 0 };
      }
      groups[key].totalBookings += 1;
      groups[key].revenue += price;
    });

    const reportData = Object.values(groups).sort((a, b) =>
      a.period.localeCompare(b.period),
    );

    // Top-booked service across all appointments
    const allServiceCount = {};
    appointments.forEach((a) => {
      if (a.service) {
        allServiceCount[a.service] = (allServiceCount[a.service] || 0) + 1;
      }
    });

    let topService = null;
    let topCount = 0;
    Object.entries(allServiceCount).forEach(([service, count]) => {
      if (count > topCount) {
        topService = service;
        topCount = count;
      }
    });

    const totalRevenue = reportData.reduce((sum, g) => sum + g.revenue, 0);

    return res.status(200).json({
      success: true,
      data: {
        period,
        report: reportData,
        totalRevenue,
        topBookedService: topService,
        topBookedServiceCount: topCount,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while generating report.",
    });
  }
});

module.exports = router;
