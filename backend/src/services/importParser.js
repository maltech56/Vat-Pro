const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const XLSX = require("xlsx");

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

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => rows.push(data))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

const parseExcelFile = async (filePath) => {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) return [];

  const sheet = workbook.Sheets[firstSheet];

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
  });
};

// ============================
// MAIN ENTRY
// ============================

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
  } else if (ext === ".xlsx" || ext === ".xls") {
    rows = await parseExcelFile(filePath);
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
};