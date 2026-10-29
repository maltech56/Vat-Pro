"use strict";
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const TIMEOUT_MS = 15000;
function runSpreadsheetWorker(action, filePath, ext) {
  if (!["parse", "validate"].includes(action) || ![".xls", ".xlsx"].includes(ext)) {
    return Promise.reject(new Error("Invalid spreadsheet worker request"));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "spreadsheetWorker.js"), {
      workerData: { action, filePath, ext },
      resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error("Spreadsheet processing timeout")), TIMEOUT_MS);
    worker.once("message", msg => msg?.ok ? finish(null, msg.result) : finish(new Error(msg?.error || "Spreadsheet processing failed")));
    worker.once("error", error => finish(error));
    worker.once("exit", code => { if (!settled) finish(new Error("Spreadsheet worker exited: " + code)); });
  });
}
module.exports = { runSpreadsheetWorker };
