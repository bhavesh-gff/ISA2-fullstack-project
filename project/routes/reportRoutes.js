// routes/reportRoutes.js
// Additive report endpoints (does not replace the existing
// /api/dashboard/report used by the current Reports page).
const express = require("express");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { nowInTimezone } = require("../utils/dateTime");
const reportService = require("../services/reportService");

const router = express.Router();

function todayStr() {
  const d = nowInTimezone();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET /api/reports/daily?date=YYYY-MM-DD (defaults to today)
router.get("/daily", verifyToken, isAdmin, async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const data = await reportService.getDailyReport(date);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error generating daily report:", error);
    return res.status(500).json({ success: false, message: "Server error while generating daily report." });
  }
});

// GET /api/reports/monthly?month=YYYY-MM (defaults to current month)
router.get("/monthly", verifyToken, isAdmin, async (req, res) => {
  try {
    const month = req.query.month || todayStr().slice(0, 7);
    const data = await reportService.getMonthlyReport(month);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error generating monthly report:", error);
    return res.status(500).json({ success: false, message: "Server error while generating monthly report." });
  }
});

// GET /api/reports/most-booked-service
router.get("/most-booked-service", verifyToken, isAdmin, async (req, res) => {
  try {
    const data = await reportService.getMostBookedService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error generating most-booked-service report:", error);
    return res.status(500).json({ success: false, message: "Server error while generating report." });
  }
});

// GET /api/reports/no-show
router.get("/no-show", verifyToken, isAdmin, async (req, res) => {
  try {
    const data = await reportService.getNoShowReport();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error generating no-show report:", error);
    return res.status(500).json({ success: false, message: "Server error while generating no-show report." });
  }
});

// POST /api/reports/export/:type  (type: daily | monthly | no-show)
// Generates a TXT file in /reports using Writable streams.
router.post("/export/:type", verifyToken, isAdmin, async (req, res) => {
  const { type } = req.params;
  try {
    let filePath;
    if (type === "daily") {
      filePath = await reportService.exportDailyReportTxt(req.query.date || todayStr());
    } else if (type === "monthly") {
      filePath = await reportService.exportMonthlyReportTxt(req.query.month || todayStr().slice(0, 7));
    } else if (type === "no-show") {
      filePath = await reportService.exportNoShowReportTxt();
    } else {
      return res.status(400).json({ success: false, message: "type must be daily, monthly or no-show." });
    }
    return res.status(200).json({ success: true, message: "Report exported.", filePath });
  } catch (error) {
    console.error("Error exporting report:", error);
    return res.status(500).json({ success: false, message: "Server error while exporting report." });
  }
});

// GET /api/reports/export/:type/download - reads back the generated TXT
// via a Readable stream and returns its content.
router.get("/export/:type/download", verifyToken, isAdmin, async (req, res) => {
  const { type } = req.params;
  const filenames = {
    daily: "daily-report.txt",
    monthly: "monthly-report.txt",
    "no-show": "no-show-report.txt",
  };
  const filename = filenames[type];
  if (!filename) {
    return res.status(400).json({ success: false, message: "type must be daily, monthly or no-show." });
  }
  try {
    const content = await reportService.readReportFile(filename);
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ success: false, message: "Report not generated yet. Export it first." });
    }
    console.error("Error reading report file:", error);
    return res.status(500).json({ success: false, message: "Server error while reading report." });
  }
});

module.exports = router;
