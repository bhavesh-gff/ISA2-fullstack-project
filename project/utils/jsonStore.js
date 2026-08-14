// utils/jsonStore.js
// Central, safe, non-blocking JSON file utility.
// Responsibilities: safe read, safe write (atomic), ensure file exists,
// tolerate missing/empty/corrupt files without crashing the server.
const fs = require("fs").promises;
const path = require("path");
/**
 * Ensure a JSON file exists. If it does not, create it with defaultValue.
 * @param {string} filePath absolute path to the JSON file
 * @param {any} defaultValue value to seed the file with if missing
 */
async function ensureJsonFile(filePath, defaultValue = []) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify(defaultValue, null, 2),
      "utf-8",
    );
  }
}
/**
 * Safely read a JSON file. Handles missing file, empty file and malformed
 * JSON by falling back to defaultValue instead of throwing/crashing.
 * @param {string} filePath
 * @param {any} defaultValue
 */
async function readJson(filePath, defaultValue = []) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    if (!raw || !raw.trim()) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      console.error(
        `[JSON-STORE] Malformed JSON in ${filePath}. Returning default value. ${parseErr.message}`,
      );
      return defaultValue;
    }
  } catch (error) {
    if (error.code === "ENOENT") return defaultValue;
    console.error(`[JSON-STORE] Failed to read ${filePath}:`, error.message);
    return defaultValue;
  }
}

/**
 * Safely write JSON to a file using a temp-file + rename strategy so a
 * write failure/crash mid-write cannot corrupt the real data file.
 * @param {string} filePath
 * @param {any} data
 */
async function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempFilePath = path.join(
    dir,
    `.tmp-${path.basename(filePath)}-${Date.now()}`,
  );
  try {
    await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempFilePath, filePath);
    return true;
  } catch (error) {
    await fs.unlink(tempFilePath).catch(() => {});
    console.error(`[JSON-STORE] Failed to write ${filePath}:`, error.message);
    throw error;
  }
}

module.exports = { readJson, writeJson, ensureJsonFile };
