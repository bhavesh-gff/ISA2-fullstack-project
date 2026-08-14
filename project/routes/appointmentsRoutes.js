// routes/appointmentsRoutes.js
const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { isValidDate, isValidTime, isPastDate } = require("../utils/dateTime");
const { readJson } = require("../utils/jsonStore");

const appointmentsFilePath = path.join(__dirname, "../data/appointments.json");

// Loose phone validation: 7-15 digits, optional +, spaces or dashes allowed.
const PHONE_REGEX = /^\+?[\d\s-]{7,15}$/;

// Helper: Read appointments
async function readAppointments() {
  const appointments = await readJson(appointmentsFilePath, []);
  // Backward-compatible: safely add default reminder fields for older
  // records that were created before the reminder system existed.
  return appointments.map((a) => {
    if (!a.reminder || typeof a.reminder !== "object") {
      a.reminder = { oneHourSent: false, thirtyMinSent: false };
    }
    return a;
  });
}

// Helper: Write appointments securely
async function writeAppointments(appointments) {
  const tempFilePath = path.join(__dirname, "../data/temp-appointments.json");
  try {
    await fs.writeFile(tempFilePath, JSON.stringify(appointments, null, 2), "utf-8");
    await fs.rename(tempFilePath, appointmentsFilePath);
  } catch (error) {
    fs.unlink(tempFilePath).catch(() => {});
    throw new Error("Failed to save appointment data.");
  }
}

// POST /api/appointments - Book appointment
router.post("/", async (req, res) => {
  try {
    const { name, phone, service, specialist, date, time } = req.body;

    if (!name || !phone || !service || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields."
      });
    }

    if (!PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number."
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid date in YYYY-MM-DD format."
      });
    }

    if (!isValidTime(time)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid time in HH:mm format."
      });
    }

    if (isPastDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Appointments cannot be booked for a past date."
      });
    }

    const appointments = await readAppointments();

    // Duplicate booking protection: same specialist + date + time, on an
    // active (not cancelled/rejected) appointment.
    if (specialist) {
      const conflict = appointments.find(
        (a) =>
          a.specialist === specialist &&
          a.date === date &&
          a.time === time &&
          a.status !== "Cancelled" &&
          a.status !== "Rejected" &&
          a.status !== "No-Show",
      );
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "Selected appointment time is already booked."
        });
      }
    }

    const newAppointment = {
      id: "appt_" + Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      service,
      specialist: specialist || "General",
      date,
      time,
      status: "Pending",
      createdAt: new Date().toISOString(),
      reminder: { oneHourSent: false, thirtyMinSent: false },
    };

    appointments.push(newAppointment);
    await writeAppointments(appointments);

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully!",
      data: newAppointment
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while booking appointment."
    });
  }
});

// GET /api/appointments - Fetch all appointments (Admin + Staff, login required)
// Ye route missing tha isliye frontend par 404 aa raha tha.
router.get("/", verifyToken, async (req, res) => {
  try {
    const appointments = await readAppointments();
    return res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching appointments.",
    });
  }
});

// GET /api/appointments/:id - Single appointment fetch (Admin + Staff)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const appointments = await readAppointments();
    const appointment = appointments.find(
      (a) => String(a.id) === String(req.params.id) || String(a._id) === String(req.params.id),
    );

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment nahi mili." });
    }

    return res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    console.error("Error fetching appointment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching appointment.",
    });
  }
});

// PUT /api/appointments/:id/assign - Assign a staff member (Admin only)
router.put("/:id/assign", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { assignedToStaffId, assignedToStaffName } = req.body;

  if (!assignedToStaffId) {
    return res.status(400).json({
      success: false,
      message: "assignedToStaffId dena zaroori hai.",
    });
  }

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

    if (appointments[index].status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Yeh appointment already Completed hai, ab staff re-assign nahi ki ja sakti.",
      });
    }

    appointments[index].assignedToStaffId = assignedToStaffId;
    appointments[index].assignedToStaffName = assignedToStaffName || "";
    // Backward-compatible aliases (noShowRoutes.js in isi/similar keys ko check karta hai)
    appointments[index].assignedToId = assignedToStaffId;
    appointments[index].assignedToName = assignedToStaffName || "";
    appointments[index].status = "Assigned";
    appointments[index].updatedAt = new Date().toISOString();

    await writeAppointments(appointments);

    return res.status(200).json({
      success: true,
      message: "Staff assign ho gaya!",
      data: appointments[index],
    });
  } catch (error) {
    console.error("Error assigning staff:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while assigning staff.",
    });
  }
});

// PUT/PATCH /api/appointments/:id/status - Update status (Admin ya assigned Staff)
//
// Workflow: Pending -> (Admin assigns) -> Assigned -> (Staff) In Progress -> (Staff) Completed
// Staff transitions ke liye ownership check hai: sirf apni assigned appointment update kar sakte hain,
// aur sirf "Assigned -> In Progress" ya "In Progress -> Completed" transitions allowed hain.
// Ek baar "Completed" ho jaane ke baad, koi bhi (Admin included) status wapas nahi badal sakta.
async function updateAppointmentStatusHandler(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = [
    "Pending",
    "Confirmed",
    "Assigned",
    "In Progress",
    "Completed",
    "Cancelled",
    "Rejected",
    "No-Show",
  ];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status ek valid value honi chahiye: ${allowedStatuses.join(", ")}`,
    });
  }

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

    const appointment = appointments[index];
    const currentStatus = appointment.status || "Pending";
    const userRole = req.user && req.user.role;
    const userId = req.user && (req.user.id || req.user._id);

    // Ek baar Completed ho jaane ke baad, koi bhi status change nahi kar sakta
    // (Admin bhi manually wapas nahi badal sakta).
    if (currentStatus === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Yeh appointment already Completed hai, ab status update nahi ho sakta.",
      });
    }

    if (userRole === "staff") {
      const assignedId = appointment.assignedToStaffId || appointment.assignedToId;
      const isOwnAppointment =
        assignedId && String(assignedId) === String(userId);

      // Security: Staff sirf apni assigned appointment hi update kar sakta hai
      if (!isOwnAppointment) {
        return res.status(403).json({
          success: false,
          message: "Aap sirf apni assigned appointments hi update kar sakte hain.",
        });
      }

      // Staff sirf yeh 2 exact transitions kar sakta hai
      const allowedStaffTransition = {
        Assigned: "In Progress",
        "In Progress": "Completed",
      };

      if (allowedStaffTransition[currentStatus] !== status) {
        return res.status(400).json({
          success: false,
          message: `Invalid transition. Current status "${currentStatus}" se sirf "${allowedStaffTransition[currentStatus] || "koi status nahi"}" mein jaa sakte hain.`,
        });
      }
    }
    // Admin: existing behaviour maintained (Pending/Confirmed/Assigned/Cancelled/Rejected/No-Show
    // set kar sakta hai), sirf upar wala "already Completed" guard lagta hai.

    appointments[index].status = status;
    appointments[index].updatedAt = new Date().toISOString();

    await writeAppointments(appointments);

    return res.status(200).json({
      success: true,
      message: "Appointment status update ho gaya!",
      data: appointments[index],
    });
  } catch (error) {
    console.error("Error updating appointment status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating appointment status.",
    });
  }
}

router.put("/:id/status", verifyToken, updateAppointmentStatusHandler);
// PATCH alias (spec-preferred verb) — same handler, existing PUT route untouched for backward compatibility
router.patch("/:id/status", verifyToken, updateAppointmentStatusHandler);

module.exports = router;