const fs = require("fs/promises");
const path = require("path");
const ExcelJS = require("exceljs");
const { runSpreadsheetWorker } = require("../services/spreadsheetWorkerRunner");

const expectedTypes = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const validateDocumentContent = async (req, res, next) => {
  if (!req.file?.path) {
    return res.status(400).json({
      error: "No document uploaded.",
    });
  }

  const filePath = req.file.path;
  const ext = path.extname(
    req.file.originalname || ""
  ).toLowerCase();

  const reject = async (message) => {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(
        "Rejected upload cleanup failed:",
        error.message
      );

      return next(
        new Error("Failed to remove rejected upload.")
      );
    }

    return res.status(400).json({
      error: message,
    });
  };

  try {
    let detected = null;

  if (ext !== ".csv" && ext !== ".xls") {
    const { fileTypeFromFile } = await import("file-type");
    detected = await fileTypeFromFile(filePath);
  }
    let valid = false;

    if (ext === ".csv") {
      const buffer = await fs.readFile(filePath);

      const decoder = new TextDecoder("utf-8", {
        fatal: true,
      });

      const content = decoder.decode(buffer);

      valid =
        buffer.length > 0 &&
        !detected &&
        !content.includes("\0") &&
        !/[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(content);

    } else if (ext === ".xlsx") {
      const isZip =
        detected?.mime === "application/zip" ||
        detected?.mime ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if (isZip) {
        try {
          valid = await runSpreadsheetWorker("validate", filePath, ext);
        } catch (_) {
          valid = false;
        }
      }

    } else if (ext === ".xls") {
      try {
        valid = await runSpreadsheetWorker("validate", filePath, ext);
      } catch (_) {
        valid = false;
      }

    } else {
      valid = detected?.mime === expectedTypes[ext];
    }

    if (!valid) {
      return reject(
        "Uploaded file content does not match its file type."
      );
    }

    return next();

  } catch (error) {
    console.error(
      "Document validation error:",
      error.message
    );

    return reject(
      "Unable to validate uploaded document."
    );
  }
};

module.exports = validateDocumentContent;
