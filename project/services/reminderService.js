// services/reminderService.js
// Core business logic for the appointment reminder system.
// Called every minute by jobs/reminderJob.js.
//
// For each active (Confirmed/Assigned/In Progress/Pending) appointment:
//   - Ignore Cancelled / Completed / No-Show / Rejected appointments
//   - Work out how many minutes remain until the appointment
//   - Send a 60-minute reminder once, and a 30-minute reminder once
//   - Never send duplicates (oneHourSent / thirtyMinSent flags)
//   - One bad/malformed appointment must never stop the rest from
//     being processed.

const path = require("path");
const { readJson, writeJson } = require("../utils/jsonStore");
const { minutesUntil } = require("../utils/dateTime");
const notificationService = require("../services/notificationService");

const appointmentsFilePath = path.join(__dirname, "../data/appointments.json");

const IGNORED_STATUSES = new Set(["Cancelled", "Completed", "No-Show", "Rejected"]);

const ONE_HOUR_WINDOW = Number(process.env.REMINDER_MINUTES || 60);
const THIRTY_MIN_WINDOW = Number(process.env.REMINDER_MINUTES_SECOND || 30);

/**
 * Ensure an appointment object has a well-formed `reminder` field without
 * mutating/breaking any existing appointment shape. Used both when reading
 * (in-memory default) and lazily persisted the first time it's needed.
 */
function withReminderDefaults(appointment) {
  if (!appointment.reminder || typeof appointment.reminder !== "object") {
    appointment.reminder = { oneHourSent: false, thirtyMinSent: false };
  } else {
    if (typeof appointment.reminder.oneHourSent !== "boolean") {
      appointment.reminder.oneHourSent = false;
    }
    if (typeof appointment.reminder.thirtyMinSent !== "boolean") {
      appointment.reminder.thirtyMinSent = false;
    }
  }
  return appointment;
}

/**
 * Decide whether a single appointment needs a reminder sent right now.
 * Returns "oneHour" | "thirtyMin" | null.
 * A reminder window is considered "due" once minutesRemaining drops to or
 * below the threshold (and is still positive, i.e. appointment hasn't
 * started yet), so a once-a-minute cron tick will always catch it exactly
 * once thanks to the sent flags.
 */
function decideReminderType(appointment, minutesRemaining) {
  if (minutesRemaining === null) return null;
  if (minutesRemaining < 0) return null; // appointment already started/passed

  const { oneHourSent, thirtyMinSent } = appointment.reminder;

  if (!oneHourSent && minutesRemaining <= ONE_HOUR_WINDOW) {
    return "oneHour";
  }
  if (!thirtyMinSent && minutesRemaining <= THIRTY_MIN_WINDOW) {
    return "thirtyMin";
  }
  return null;
}

/**
 * Main entry point: scans all appointments and sends any due reminders.
 * Safe to call repeatedly (idempotent thanks to the sent flags).
 */
async function processReminders() {
  let appointments;
  try {
    appointments = await readJson(appointmentsFilePath, []);
  } catch (error) {
    console.error("[REMINDER] Failed to read appointments.json:", error.message);
    return { processed: 0, sent: 0 };
  }

  if (!Array.isArray(appointments) || appointments.length === 0) {
    return { processed: 0, sent: 0 };
  }

  let sentCount = 0;
  let changed = false;

  for (let i = 0; i < appointments.length; i++) {
    try {
      const appointment = withReminderDefaults(appointments[i]);

      const status = appointment.status || "Pending";
      if (IGNORED_STATUSES.has(status)) continue;

      const minutesRemaining = minutesUntil(appointment.date, appointment.time);
      if (minutesRemaining === null) {
        console.error(
          `[REMINDER] Appointment ${appointment.id} has invalid/missing date or time. Skipping.`,
        );
        continue;
      }

      const reminderType = decideReminderType(appointment, minutesRemaining);
      if (!reminderType) continue;

      console.log(
        `[REMINDER] Appointment ${appointment.id} is ${minutesRemaining} minute(s) away. Sending ${reminderType === "oneHour" ? "60-minute" : "30-minute"} reminder.`,
      );

      const result = await notificationService.sendAppointmentReminder(appointment);

      if (result && result.success) {
        if (reminderType === "oneHour") {
          appointment.reminder.oneHourSent = true;
        } else {
          appointment.reminder.thirtyMinSent = true;
        }
        sentCount += 1;
        changed = true;
      } else {
        console.error(
          `[REMINDER] Failed to send reminder for appointment ${appointment.id}: ${result && result.error}`,
        );
      }

      changed = true; // reminder defaults may have been added even without a send
    } catch (perAppointmentError) {
      // One bad appointment must not stop the scheduler from processing others.
      console.error(
        `[REMINDER] Error processing appointment at index ${i}:`,
        perAppointmentError.message,
      );
    }
  }

  if (changed) {
    try {
      await writeJson(appointmentsFilePath, appointments);
    } catch (error) {
      console.error("[REMINDER] Failed to persist reminder flags:", error.message);
    }
  }

  return { processed: appointments.length, sent: sentCount };
}

module.exports = { processReminders, withReminderDefaults };
