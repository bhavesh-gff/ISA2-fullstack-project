// scripts/generateReport.js
// CLI usage:
//   node scripts/generateReport.js daily [YYYY-MM-DD]
//   node scripts/generateReport.js monthly [YYYY-MM]
//   node scripts/generateReport.js no-show
//
// Demonstrates Node.js command-line argument handling (process.argv).
require("dotenv").config();
const path = require("path");
const reportService = require(path.join(__dirname, "../services/reportService"));
const { nowInTimezone } = require(path.join(__dirname, "../utils/dateTime"));
function todayStr() {
  const d = nowInTimezone();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
async function main() {
  const [, , type, arg] = process.argv;
  if (!type) {
    console.log("Usage: node scripts/generateReport.js <daily|monthly|no-show> [date|month]");
    process.exit(1);
  }
  try {
    let filePath;
    if (type === "daily") {
      const date = arg || todayStr();
      filePath = await reportService.exportDailyReportTxt(date);
    } else if (type === "monthly") {
      const month = arg || todayStr().slice(0, 7);
      filePath = await reportService.exportMonthlyReportTxt(month);
    } else if (type === "no-show") {
      filePath = await reportService.exportNoShowReportTxt();
    } else {
      console.error(`Unknown report type "${type}". Use daily, monthly, or no-show.`);
      process.exit(1);
    }
    console.log(`Report generated: ${filePath}`);
  } catch (error) {
    console.error("Failed to generate report:", error.message);
    process.exit(1);
  }
}
main();
