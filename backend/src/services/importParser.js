const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const ExcelJS = require("exceljs");
const XLS = require("xlsx");
const { runSpreadsheetWorker } = require("./spreadsheetWorkerRunner");

// ============================
// HELPERS
// ============================

const normalizeHeader = (value = "") =>
  String(value)
    .replace(/\uFEFF/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const detectColumn = (headers = [], candidates = []) => {
  return headers.find((header) => candidates.includes(header)) || null;
};

// Excel serial number/date parser
const parseExcelDate = (value) => {
  if (value === null || value === undefined || value === "") return "";

  // Already a string date
  if (typeof value === "string") return value;

  // Excel serial number → JS date
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + value * 86400000);

    if (Number.isNaN(jsDate.getTime())) return "";
    return jsDate.toISOString().split("T")[0];
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }

  return "";
};

const parseAmount = (value) => {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const numeric = Number(cleaned);

  return Number.isNaN(numeric) ? 0 : numeric;
};

// ============================
// CORE MAPPING
// ============================

const mapRowsToTransactions = (rows = []) => {
  if (!rows.length) {
    return {
      detectedColumns: {},
      rows: [],
    };
  }

  const headers = Object.keys(rows[0]).map(normalizeHeader);

  const dateCol = detectColumn(headers, [
    "date",
    "transaction_date",
    "invoice_date",
    "invoiceDate",
    "transactionDate",
  ].map(normalizeHeader));

  const amountCol = detectColumn(headers, [
    "amount",
    "total",
    "value",
    "gross_amount",
    "gross",
    "net_amount",
  ].map(normalizeHeader));

  const descriptionCol = detectColumn(headers, [
    "description",
    "details",
    "memo",
    "reference",
    "narration",
    "vendor",
    "customer",
  ].map(normalizeHeader));

  const typeCol = detectColumn(headers, [
    "type",
    "transaction_type",
    "category_type",
  ].map(normalizeHeader));

  const classificationCol = detectColumn(headers, [
    "classification",
    "vat_classification",
    "tax_code",
    "vat_type",
  ].map(normalizeHeader));

  const mappedRows = rows.map((row, index) => {
    const normalized = {};

    Object.keys(row || {}).forEach((key) => {
      normalized[normalizeHeader(key)] = row[key];
    });

    const rawType = String(normalized[typeCol] || "").toLowerCase().trim();

    let detectedType = "sale";
    if (
      rawType.includes("expense") ||
      rawType.includes("purchase") ||
      rawType.includes("cost")
    ) {
      detectedType = "expense";
    }

    let detectedClassification = "taxable";
    const rawClassification = String(
      normalized[classificationCol] || ""
    ).toLowerCase().trim();

    if (rawClassification.includes("zero")) {
      detectedClassification = "zero_rated";
    } else if (rawClassification.includes("exempt")) {
      detectedClassification = "exempt";
    }

    return {
      rowNumber: index + 1,
      transactionDate: parseExcelDate(normalized[dateCol]),
      description: String(normalized[descriptionCol] || "").trim(),
      amount: parseAmount(normalized[amountCol]),
      type: detectedType,
      classification: detectedClassification,
      raw: row,
    };
  });

  return {
    detectedColumns: {
      dateCol,
      amountCol,
      descriptionCol,
      typeCol,
      classificationCol,
    },
    rows: mappedRows,
  };
};

// ============================
// FILE PARSERS
// ============================

const parseCsvFile = (filePath) =>
  new Promise((resolve, reject) => {
    const rows = [];
    const source = fs.createReadStream(filePath);
    const parser = csv({
      mapHeaders: ({ header }) =>
        header.replace(/^\uFEFF/, "").replace(/^ï»¿/, "").trim(),
    });

    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      source.unpipe(parser);
      source.destroy();
      parser.destroy();
      reject(error);
    };

    source.on("error", fail);
    parser.on("error", fail);

    parser.on("data", (data) => {
      if (rows.length >= 10000) {
        fail(new Error("CSV import exceeds the 10000-row limit"));
        return;
      }
      rows.push(data);
    });

    parser.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(rows);
    });

    source.pipe(parser);
  });
const parseExcelFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext !== ".xlsx") {
    throw new Error("Legacy .xls files are not supported. Please convert to .xlsx or CSV.");
  }

  // Modern .xlsx files use ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  if (workbook.worksheets.length > 16) throw new Error("Too many worksheets");

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers = [];

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.text || "").trim();
  });

  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber > 10001) throw new Error("XLSX import exceeds the 10000-row limit");

    const record = {};
    let hasData = false;

    headers.forEach((header, index) => {
      if (!header) return;

      const cell = row.getCell(index + 1);
      let value = cell.value;

      if (value === null || value === undefined) {
        value = "";
      } else if (value instanceof Date) {
        value = value.toISOString().split("T")[0];
      } else if (typeof value === "object") {
        if (value.result !== undefined) {
          value = value.result;
        } else if (Array.isArray(value.richText)) {
          value = value.richText.map((part) => part.text).join("");
        } else if (value.text !== undefined) {
          value = value.text;
        } else {
          value = cell.text || "";
        }
      }

      record[header] = value;

      if (value !== "") {
        hasData = true;
      }
    });

    if (hasData) {
      rows.push(record);
    }
  });

  return rows;
};

// ============================
// MAIN ENTRY
// ============================


const parseLegacyXlsFile = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from("d0cf11e0a1b11ae1", "hex");

  if (buffer.length < 512 ||
      !buffer.subarray(0, 8).equals(signature)) {
    throw new Error("Invalid legacy XLS file signature");
  }

  const workbook = XLS.read(buffer, {
    type: "buffer",
    cellDates: true,
    sheetRows: 10002,
    bookVBA: false,
    cellFormula: false
  });

  if (!workbook.SheetNames.length) {
    throw new Error("XLS workbook contains no worksheets");
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLS.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
    blankrows: false
  });

  if (rows.length > 10000) {
    throw new Error("XLS import exceeds the 10000-row limit");
  }

  return rows.map((row) => {
    const record = {};

    for (const [key, value] of Object.entries(row)) {
      record[key] = value instanceof Date
        ? value.toISOString().split("T")[0]
        : value;
    }

    return record;
  });
};

const parseImportFile = async (filePath) => {
  if (!filePath) {
    throw new Error("File path is required");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("Import file not found");
  }

  const ext = path.extname(filePath).toLowerCase();

  let rows = [];

  if (ext === ".csv") {
    rows = await parseCsvFile(filePath);
    } else if (ext === ".xlsx") {
    rows = await runSpreadsheetWorker("parse", filePath, ext);
  } else if (ext === ".xls") {
    rows = await runSpreadsheetWorker("parse", filePath, ext);
  } else {
    throw new Error("Unsupported file format");
  }

  const mapped = mapRowsToTransactions(rows);

  return {
    format: ext.replace(".", ""),
    detectedColumns: mapped.detectedColumns,
    rows: mapped.rows,
  };
};

module.exports = {
  parseImportFile,
  parseExcelFile,
  parseLegacyXlsFile,
};