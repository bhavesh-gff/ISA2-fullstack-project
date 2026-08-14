// routes/noShowRoutes.js
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { minutesUntil } = require("../utils/dateTime");
const appointmentEvents = require("../events/appointmentEvents");
const { readJson } = require("../utils/jsonStore");

const router = express.Router();
const appointmentsFilePath = path.join(__dirname, "../data/appointments.json");
const REPEAT_OFFENDER_THRESHOLD = 2;
const GRACE_PERIOD_MINUTES = Number(process.env.GRACE_PERIOD_MINUTES || 15);

async function readAppointments() {
  return readJson(appointmentsFilePath, []);
}

async function writeAppointments(data) {
  await fs.writeFile(
    appointmentsFilePath,
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

// 1. PUT /api/noshows/:id/noshow OR /api/appointments/:id/noshow
router.put("/:id/noshow", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const appointments = await readAppointments();
    const index = appointments.findIndex(
      (a) => String(a.id) === String(id) || String(a._id) === String(id),
    );

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment nahi mili." });
    }

    // Permission check for Staff members
    if (req.user && req.user.role === "staff") {
      const isAssigned =
        (appointments[index].assignedToId &&
          String(appointments[index].assignedToId) ===
            String(req.user.id || req.user._id)) ||
        (appointments[index].assignedToName &&
          appointments[index].assignedToName.toLowerCase() ===
            req.user.name?.toLowerCase()) ||
        (appointments[index].specialist &&
          appointments[index].specialist.toLowerCase() ===
            req.user.name?.toLowerCase());

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message:
            "Aap sirf apni assigned appointments hi update kar sakte hain.",
        });
      }
    }

    const target = appointments[index];

    if (["Completed", "Cancelled", "Rejected", "No-Show"].includes(target.status)) {
      return res.status(400).json({
        success: false,
        message: `Appointment already ${target.status}, cannot mark as No-Show.`,
      });
    }

    // Grace-period enforcement: an appointment only becomes No-Show
    // eligible once (appointment time + GRACE_PERIOD_MINUTES) has passed.
    const minutesRemaining = minutesUntil(target.date, target.time);
    if (minutesRemaining !== null && minutesRemaining > -GRACE_PERIOD_MINUTES) {
      return res.status(400).json({
        success: false,
        message: `Appointment is not yet eligible for No-Show. Please wait until ${GRACE_PERIOD_MINUTES} minutes after the appointment time.`,
      });
    }

    appointments[index].status = "No-Show";
    appointments[index].markedNoShowAt = new Date().toISOString();

    await writeAppointments(appointments);

    // Emit event-driven No-Show handling (logging/history) without
    // blocking the HTTP response.
    appointmentEvents.emit("appointment:no-show", appointments[index]);

    return res.status(200).json({
      success: true,
      message: "Appointment No-Show mark ho gayi.",
      data: appointments[index],
    });
  } catch (error) {
    console.error("Error marking no-show:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while marking no-show.",
    });
  }
});

// 2. GET /api/noshows/repeat (Admin only) - Repeat offenders ki list (2+ no-shows)
router.get("/repeat", verifyToken, isAdmin, async (req, res) => {
  try {
    const appointments = await readAppointments();
    const noShows = appointments.filter((a) => a.status === "No-Show");

    // Phone number ya email ke hisaab se group karein (Customer identification)
    const grouped = {};
    noShows.forEach((a) => {
      const key = (a.phone || a.email || a.name || "").trim().toLowerCase();
      if (!key) return;

      if (!grouped[key]) {
        grouped[key] = {
          name: a.name || "Unknown Customer",
          phone: a.phone || "N/A",
          email: a.email || "N/A",
          noShowCount: 0,
          lastNoShowDate: a.date,
        };
      }
      grouped[key].noShowCount += 1;

      if (a.date && new Date(a.date) > new Date(grouped[key].lastNoShowDate)) {
        grouped[key].lastNoShowDate = a.date;
      }
    });

    const repeatOffenders = Object.values(grouped)
      .filter((c) => c.noShowCount >= REPEAT_OFFENDER_THRESHOLD)
      .sort((a, b) => b.noShowCount - a.noShowCount);

    return res.status(200).json({
      success: true,
      data: repeatOffenders,
    });
  } catch (error) {
    console.error("Error fetching repeat offenders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching repeat offenders.",
    });
  }
});

module.exports = router;
