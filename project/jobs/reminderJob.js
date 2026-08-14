const cron = require("node-cron");
const { processReminders } = require("../services/reminderService");

let isRunning = false;
function startReminderJob() {
  console.log("[CRON] Reminder job started (runs every minute).");
  cron.schedule("* * * * *", async () => {
    if (isRunning) {
      console.warn(
        "[CRON] Previous reminder run still in progress. Skipping this tick.",
      );
      return;
    }
    isRunning = true;
    try {
      const { processed, sent } = await processReminders();
      if (sent > 0) {
        console.log(
          `[CRON] Reminder tick complete. Checked ${processed} appointment(s), sent ${sent} reminder(s).`,
        );
      }
    } catch (error) {
      console.error(
        "[CRON] Unexpected error during reminder job:",
        error.message,
      );
    } finally {
      isRunning = false;
    }
  });
}
module.exports = { startReminderJob };
