"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs/promises");
const { parseExcelFile, parseLegacyXlsFile } = require("./importParser");
(async () => {
  const { action, filePath, ext } = workerData;
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size === 0 || stat.size > 10 * 1024 * 1024) {
    throw new Error("Spreadsheet file size is invalid");
  }
  if (![".xls", ".xlsx"].includes(ext)) throw new Error("Unsupported spreadsheet extension");
  const rows = ext === ".xls" ? await parseLegacyXlsFile(filePath) : await parseExcelFile(filePath);
  if (rows.length > 10000) throw new Error("Spreadsheet row limit exceeded");
  parentPort.postMessage({ ok: true, result: action === "validate" ? true : rows });
})().catch(error => {
  parentPort.postMessage({ ok: false, error: String(error.message || error).slice(0, 300) });
});
