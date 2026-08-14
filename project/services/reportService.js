// services/reportService.js
// Calculates reports from the existing appointments.json data (no
// separate database). Also demonstrates Readable/Writable streams by
// exporting generated reports as human-readable TXT files.
const fs = require("fs");
const path = require("path");
const { readJson } = require("../utils/jsonStore");
const appointmentsFilePath = path.join(__dirname, "../data/appointments.json");
const reportsDir = path.join(__dirname, "../reports");
// Configurable No-Show classification thresholds.
const CLASSIFICATION_THRESHOLDS = {
  repeat: 2, // no-show count >= 2 => Repeat No-Show Customer
  high: 3, // no-show count >= 3 => High No-Show frequency
};
function classify(noShowCount) {
  if (noShowCount >= CLASSIFICATION_THRESHOLDS.high) return "High No-Show frequency";
  if (noShowCount >= CLASSIFICATION_THRESHOLDS.repeat) return "Repeat No-Show";
  return "Normal";
}
async function getAppointments() {
  return readJson(appointmentsFilePath, []);
}
function normalizeDateKey(rawDate) {
  if (!rawDate) return "";
  return rawDate.includes("T") ? rawDate.split("T")[0] : rawDate;
}
/**
 * Daily report: totals for a specific date (defaults to today, Asia/Kolkata
 * date string expected from caller).
 */
async function getDailyReport(dateStr) {
  const appointments = await getAppointments();
  const dayAppointments = appointments.filter(
    (a) => normalizeDateKey(a.date) === dateStr,
  );
  return {
    date: dateStr,
    totalBookings: dayAppointments.length,
    confirmed: dayAppointments.filter((a) => a.status === "Confirmed").length,
    completed: dayAppointments.filter((a) => a.status === "Completed").length,
    cancelled: dayAppointments.filter(
      (a) => a.status === "Cancelled" || a.status === "Rejected",
    ).length,
    noShow: dayAppointments.filter((a) => a.status === "No-Show").length,
  };
}
/**
 * Monthly report: totals for a specific YYYY-MM month.
 */
async function getMonthlyReport(monthStr) {
  const appointments = await getAppointments();
  const monthAppointments = appointments.filter(
    (a) => normalizeDateKey(a.date).slice(0, 7) === monthStr,
  );
  const total = monthAppointments.length;
  const noShowCount = monthAppointments.filter((a) => a.status === "No-Show").length;
  const serviceCounts = {};
  monthAppointments.forEach((a) => {
    if (a.service) serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1;
  });
  let mostBookedService = null;
  let mostBookedCount = 0;
  Object.entries(serviceCounts).forEach(([service, count]) => {
    if (count > mostBookedCount) {
      mostBookedService = service;
      mostBookedCount = count;
    }
  });
  return {
    month: monthStr,
    totalBookings: total,
    completed: monthAppointments.filter((a) => a.status === "Completed").length,
    cancelled: monthAppointments.filter(
      (a) => a.status === "Cancelled" || a.status === "Rejected",
    ).length,
    noShow: noShowCount,
    mostBookedService,
    mostBookedServiceCount: mostBookedCount,
    noShowRate: total > 0 ? Number(((noShowCount / total) * 100).toFixed(2)) : 0,
  };
}
/**
 * Most-booked service across all appointments.
 */
async function getMostBookedService() {
  const appointments = await getAppointments();
  const counts = {};
  appointments.forEach((a) => {
    if (a.service) counts[a.service] = (counts[a.service] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.map(([service, count]) => ({ service, count }));
}
/**
 * No-Show report grouped by customer (phone as the identity key), with
 * classification for repeat/high-frequency offenders.
 */
async function getNoShowReport() {
  const appointments = await getAppointments();
  const grouped = {};
  appointments.forEach((a) => {
    const key = (a.phone || a.name || "").trim().toLowerCase();
    if (!key) return;
    if (!grouped[key]) {
      grouped[key] = {
        customer: a.name || "Unknown",
        phone: a.phone || "N/A",
        totalAppointments: 0,
        noShows: 0,
        completed: 0,
      };
    }
    grouped[key].totalAppointments += 1;
    if (a.status === "No-Show") grouped[key].noShows += 1;
    if (a.status === "Completed") grouped[key].completed += 1;
  });
  return Object.values(grouped)
    .map((c) => ({
      ...c,
      noShowRate:
        c.totalAppointments > 0
          ? Number(((c.noShows / c.totalAppointments) * 100).toFixed(2))
          : 0,
      classification: classify(c.noShows),
    }))
    .sort((a, b) => b.noShows - a.noShows);
}
// ---------------------------------------------------------------------
// TXT export using Node.js Streams (Readable generation -> Writable file)
// ---------------------------------------------------------------------
function formatNoShowReportText(rows) {
  const lines = [];
  lines.push("ELON STUDIO SALON - NO-SHOW REPORT");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("-".repeat(70));
  rows.forEach((r) => {
    lines.push(
      `Customer: ${r.customer} | Phone: ${r.phone} | Total: ${r.totalAppointments} | No-Shows: ${r.noShows} | Completed: ${r.completed} | Rate: ${r.noShowRate}% | Classification: ${r.classification}`,
    );
  });
  return lines.join("\n") + "\n";
}
function formatSimpleReportText(title, data) {
  const lines = [];
  lines.push(title);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("-".repeat(70));
  lines.push(JSON.stringify(data, null, 2));
  return lines.join("\n") + "\n";
}

/**
 * Writes report text to a TXT file using a Writable stream, and returns
 * the file path once the stream has fully flushed to disk.
 */
function writeReportToFile(filename, textContent) {
  return new Promise((resolve, reject) => {
    fs.mkdir(reportsDir, { recursive: true }, (mkdirErr) => {
      if (mkdirErr) return reject(mkdirErr);

      const filePath = path.join(reportsDir, filename);
      const writable = fs.createWriteStream(filePath, { encoding: "utf-8" });

      writable.on("error", reject);
      writable.on("finish", () => resolve(filePath));

      writable.write(textContent);
      writable.end();
    });
  });
}

/**
 * Reads a previously generated TXT report back using a Readable stream
 * (demonstrates the read side of the syllabus's Streams topic).
 */
function readReportFile(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(reportsDir, filename);
    const readable = fs.createReadStream(filePath, { encoding: "utf-8" });
    let content = "";

    readable.on("data", (chunk) => {
      content += chunk;
    });
    readable.on("end", () => resolve(content));
    readable.on("error", reject);
  });
}

async function exportNoShowReportTxt() {
  const rows = await getNoShowReport();
  const text = formatNoShowReportText(rows);
  return writeReportToFile("no-show-report.txt", text);
}

async function exportDailyReportTxt(dateStr) {
  const data = await getDailyReport(dateStr);
  const text = formatSimpleReportText(
    `ELON STUDIO SALON - DAILY REPORT (${dateStr})`,
    data,
  );
  return writeReportToFile("daily-report.txt", text);
}

async function exportMonthlyReportTxt(monthStr) {
  const data = await getMonthlyReport(monthStr);
  const text = formatSimpleReportText(
    `ELON STUDIO SALON - MONTHLY REPORT (${monthStr})`,
    data,
  );
  return writeReportToFile("monthly-report.txt", text);
}

module.exports = {
  getDailyReport,
  getMonthlyReport,
  getMostBookedService,
  getNoShowReport,
  exportNoShowReportTxt,
  exportDailyReportTxt,
  exportMonthlyReportTxt,
  readReportFile,
  CLASSIFICATION_THRESHOLDS,
};
