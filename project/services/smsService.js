// services/smsService.js
// SMS Gateway abstraction.
//
//   Appointment -> Cron Scheduler -> Reminder Service -> notificationService
//                                                             -> smsService (this file)
//                                                                 -> SMS Gateway
//
// IMPORTANT:
// - No real API keys are hardcoded here.
// - The app must never crash if SMS credentials are unavailable.
// - MOCK_SMS=true (the default for this college project) logs the message
//   to the terminal and to logs/reminders.log instead of calling a real
//   provider, and only reports success after that "mock delivery" succeeds.
// - A real provider (e.g. Twilio, MSG91, etc.) can be plugged into
//   sendViaRealProvider() later without touching any calling code.
const fs = require("fs").promises;
const path = require("path");
const isMockMode = () =>
  (process.env.MOCK_SMS || "true").toLowerCase() !== "false";
const reminderLogPath = path.join(__dirname, "../logs/reminders.log");
async function logToFile(line) {
  try {
    await fs.mkdir(path.dirname(reminderLogPath), { recursive: true });
    await fs.appendFile(reminderLogPath, line + "\n", "utf-8");
  } catch (error) {
    console.error("[SMS] Failed to write reminders.log:", error.message);
  }
}
/**
 * Mock SMS "delivery". Logs to terminal + logs/reminders.log.
 * Always resolves (never throws) so the cron job can safely mark the
 * reminder as sent only after this genuinely completes.
 */
async function sendMockSms(phone, message) {
  const logLine = `[SMS MOCK]\nTo: ${phone}\nMessage: ${message}`;
  console.log(logLine);
  await logToFile(
    `[${new Date().toISOString()}] MOCK SMS -> ${phone} :: ${message}`,
  );
  return { success: true, provider: "mock", sentAt: new Date().toISOString() };
}
/**
 * Placeholder for a real SMS gateway integration (e.g. Twilio, MSG91,
 * Fast2SMS...). Intentionally unimplemented: no credentials are invented
 * or hardcoded. If real credentials are ever added via environment
 * variables, this is the only function that needs to change.
 */
async function sendViaRealProvider(phone, message) {
  const provider = process.env.SMS_PROVIDER || "";
  if (!provider) {
    console.warn(
      "[SMS] Real SMS provider not configured (SMS_PROVIDER env not set). Falling back to mock delivery.",
    );
    return sendMockSms(phone, message);
  }

  // NOTE: No real provider is wired up in this college project.
  // Example of how a real integration would look (left unimplemented):
  //
  //   if (provider === "twilio") {
  //     const client = require("twilio")(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  //     await client.messages.create({ to: phone, from: process.env.TWILIO_FROM, body: message });
  //     return { success: true, provider: "twilio" };
  //   }
  console.warn(
    `[SMS] SMS_PROVIDER "${provider}" is not implemented. Falling back to mock delivery so the app keeps working.`,
  );
  return sendMockSms(phone, message);
}
/**
 * Public entry point used by notificationService. Never throws — a
 * failed/unavailable SMS gateway must never crash the reminder cron job.
 */
async function sendSms(phone, message) {
  try {
    if (isMockMode()) {
      return await sendMockSms(phone, message);
    }
    return await sendViaRealProvider(phone, message);
  } catch (error) {
    console.error("[SMS] Failed to send SMS:", error.message);
    return { success: false, error: error.message };
  }
}
module.exports = { sendSms, isMockMode };
