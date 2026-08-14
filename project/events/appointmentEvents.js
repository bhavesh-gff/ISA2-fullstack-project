// events/appointmentEvents.js
// Demonstrates Node.js EventEmitter / event-driven architecture.
// Used specifically for the No-Show flow:
//
//   Staff/Admin marks No-Show
//        -> route updates JSON
//        -> emits "appointment:no-show"
//        -> this module's listener logs/records history
//
// Kept intentionally small: EventEmitter is used only where it genuinely
// demonstrates event-driven design, not sprinkled across the whole app.

const EventEmitter = require("events");
const fs = require("fs").promises;
const path = require("path");

const appointmentEvents = new EventEmitter();

const noShowLogPath = path.join(__dirname, "../logs/no-show-history.log");

async function appendNoShowLog(appointment) {
  try {
    await fs.mkdir(path.dirname(noShowLogPath), { recursive: true });
    const line = `[${new Date().toISOString()}] No-Show recorded | id=${appointment.id} | customer=${appointment.name || appointment.customerName} | phone=${appointment.phone} | service=${appointment.service} | date=${appointment.date} ${appointment.time}\n`;
    await fs.appendFile(noShowLogPath, line, "utf-8");
  } catch (error) {
    console.error("[EVENT] Failed to write no-show history log:", error.message);
  }
}

// Central listener: logs every No-Show event to a human-readable history file.
appointmentEvents.on("appointment:no-show", (appointment) => {
  console.log(
    `[NO-SHOW] Appointment ${appointment.id} (${appointment.name || appointment.customerName}) marked as No-Show.`,
  );
  appendNoShowLog(appointment);
});

module.exports = appointmentEvents;
