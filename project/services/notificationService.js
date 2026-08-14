// services/notificationService.js
// Sits between the reminder service and the SMS gateway abstraction.
// Responsible for composing the customer-facing message text.

const smsService = require("./smsService");

const SALON_NAME = "Elon Studio Salon";

function formatDisplayTime(time24) {
  // "17:00" -> "5:00 PM"
  const [hStr, mStr] = (time24 || "").split(":");
  let h = Number(hStr);
  const m = mStr || "00";
  if (Number.isNaN(h)) return time24 || "";
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

function buildReminderMessage(appointment) {
  const customerName = appointment.name || appointment.customerName || "Guest";
  const service = appointment.service || "your appointment";
  const displayTime = formatDisplayTime(appointment.time);

  return (
    `Reminder: Hi ${customerName}, your ${service} appointment at ${SALON_NAME} is today at ${displayTime}. ` +
    `Please arrive on time. Repeated no-shows may be recorded in the salon's appointment history.`
  );
}

/**
 * Sends a reminder notification for the given appointment. Returns the
 * result from the SMS layer so the caller (reminder service) can decide
 * whether it's safe to mark the reminder as "sent".
 */
async function sendAppointmentReminder(appointment) {
  const message = buildReminderMessage(appointment);
  const phone = appointment.phone;

  if (!phone) {
    console.warn(
      `[NOTIFY] Appointment ${appointment.id} has no phone number. Skipping reminder.`,
    );
    return { success: false, error: "Missing phone number" };
  }

  return smsService.sendSms(phone, message);
}

module.exports = { sendAppointmentReminder, buildReminderMessage };
