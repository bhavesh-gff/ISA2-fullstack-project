// utils/dateTime.js
// Timezone-safe date/time helpers. All appointment date/time calculations
// go through here so reminders/no-show logic never depend on blind
// server-local time and never trigger on the wrong day.
const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";
/**
 * Get the current date/time "as seen" in the configured timezone,
 * returned as a plain JS Date whose UTC fields equal the wall-clock
 * fields in that timezone. Safe to compare/subtract like a normal Date.
 */
function nowInTimezone() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const iso = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  return new Date(iso);
}
/**
 * Combine an appointment's stored "date" (YYYY-MM-DD) and "time" (HH:mm)
 * into a Date object comparable with nowInTimezone(). Returns null if
 * the date/time is missing or invalid, so callers can safely skip it.
 */
function combineDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const combined = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(combined.getTime())) return null;
  return combined;
}
/**
 * Returns the difference in minutes between the appointment time and now
 * (appointmentTime - now). Positive = appointment is in the future.
 */
function minutesUntil(dateStr, timeStr) {
  const apptTime = combineDateTime(dateStr, timeStr);
  if (!apptTime) return null;
  const now = nowInTimezone();
  return Math.round((apptTime.getTime() - now.getTime()) / 60000);
}
/**
 * Is a given date string (YYYY-MM-DD) strictly before today (Asia/Kolkata)?
 */
function isPastDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return true;
  const today = nowInTimezone();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateStr < todayStr;
}
/**
 * Basic HH:mm 24-hour format validator.
 */
function isValidTime(timeStr) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr || "");
}
/**
 * Basic YYYY-MM-DD validator that also rejects impossible calendar dates
 * (e.g. 2026-02-30).
 */
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

module.exports = {
  TIMEZONE,
  nowInTimezone,
  combineDateTime,
  minutesUntil,
  isPastDate,
  isValidTime,
  isValidDate,
};
