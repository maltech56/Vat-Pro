import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Platform } from "react-native";

const VAT_RATE = 0.1;

const HEADER_ALIASES = {
  date: [
    "date",
    "transaction date",
    "invoice date",
    "posting date",
    "doc date",
  ],
  description: [
    "description",
    "details",
    "memo",
    "narration",
    "reference",
    "item description",
  ],
  amount: [
    "amount",
    "gross",
    "gross amount",
    "total",
    "total amount",
    "line total",
    "invoice total",
  ],
  netAmount: ["net", "net amount", "subtotal", "tax exclusive"],
  vatAmount: ["vat", "vat amount", "tax", "tax amount", "vat value"],
  classification: [
    "classification",
    "vat classification",
    "vat class",
    "tax code",
    "vat code",
    "tax status",
  ],
  type: ["type", "transaction type", "entry type", "kind"],
  sourceType: ["source", "module", "origin"],
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function findColumn(row, aliases) {
  const keys = Object.keys(row || {});
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    if (aliases.includes(normalized)) return key;
  }
  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function normalizeClassification(value) {
  const raw = normalizeHeader(value);

  if (
    raw.includes("zero") ||
    raw === "zr" ||
    raw === "zero rated" ||
    raw === "zero rated sale"
  ) {
    return "zero_rated";
  }

  if (
    raw.includes("exempt") ||
    raw === "ex" ||
    raw === "vat exempt" ||
    raw === "non vatable"
  ) {
    return "exempt";
  }

  return "taxable";
}

function inferType(row) {
  const typeKey = findColumn(row, HEADER_ALIASES.type);
  const sourceKey = findColumn(row, HEADER_ALIASES.sourceType);
  const descriptionKey = findColumn(row, HEADER_ALIASES.description);

  const valuesToCheck = [
    typeKey ? row[typeKey] : "",
    sourceKey ? row[sourceKey] : "",
    descriptionKey ? row[descriptionKey] : "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    valuesToCheck.includes("expense") ||
    valuesToCheck.includes("purchase") ||
    valuesToCheck.includes("supplier") ||
    valuesToCheck.includes("vendor") ||
    valuesToCheck.includes("bill")
  ) {
    return "expense";
  }

  return "sale";
}

function inferClassification(row) {
  const classificationKey = findColumn(row, HEADER_ALIASES.classification);
  if (classificationKey) {
    return normalizeClassification(row[classificationKey]);
  }

  const vatAmountKey = findColumn(row, HEADER_ALIASES.vatAmount);
  const vatAmount = vatAmountKey ? parseNumber(row[vatAmountKey]) : 0;
  if (vatAmount <= 0) return "exempt";

  return "taxable";
}

function normalizeDate(value) {
  if (!value) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + value * 86400000);
    return jsDate.toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
}

function buildReviewRow(row, rowIndex) {
  const dateKey = findColumn(row, HEADER_ALIASES.date);
  const descriptionKey = findColumn(row, HEADER_ALIASES.description);
  const amountKey = findColumn(row, HEADER_ALIASES.amount);
  const netAmountKey = findColumn(row, HEADER_ALIASES.netAmount);
  const vatAmountKey = findColumn(row, HEADER_ALIASES.vatAmount);

  const type = inferType(row);
  const classification = inferClassification(row);

  const amount =
    amountKey && parseNumber(row[amountKey]) > 0
      ? parseNumber(row[amountKey])
      : netAmountKey
      ? parseNumber(row[netAmountKey])
      : 0;

  let vatAmount = vatAmountKey ? parseNumber(row[vatAmountKey]) : 0;

  if (!vatAmount) {
    vatAmount = classification === "taxable" ? amount * VAT_RATE : 0;
  }

  const description = descriptionKey
    ? String(row[descriptionKey] || "").trim()
    : `Imported row ${rowIndex + 1}`;

  const transactionDate = dateKey ? normalizeDate(row[dateKey]) : "";

  const errors = [];
  if (!amount || amount <= 0) errors.push("Missing amount");
  if (!transactionDate) errors.push("Missing or invalid date");
  if (!description) errors.push("Missing description");

  return {
    id: `${Date.now()}-${rowIndex}`,
    rowNumber: rowIndex + 1,
    type,
    amount: Number(amount.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    classification,
    transactionDate,
    description,
    status: errors.length ? "Needs Review" : "Ready",
    selected: errors.length === 0,
    errors,
    raw: row,
  };
}

export async function pickImportDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
    ],
  });

  if (result.canceled) return null;

  return result.assets?.[0] || null;
}

async function parseCsvAsset(asset) {
  if (Platform.OS === "web" && asset.file) {
    return new Promise((resolve, reject) => {
      Papa.parse(asset.file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data || []),
        error: reject,
      });
    });
  }

  const text = await FileSystem.readAsStringAsync(asset.uri);
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data || [];
}

async function parseExcelAsset(asset) {
  if (Platform.OS === "web" && asset.file) {
    const buffer = await asset.file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, { type: "base64" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
}

function inferFileKind(asset) {
  const name = String(asset?.name || "").toLowerCase();
  const mime = String(asset?.mimeType || "").toLowerCase();

  if (name.endsWith(".csv") || mime.includes("csv")) return "csv";
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  ) {
    return "excel";
  }
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";

  return "unknown";
}

export async function parseImportedAsset(asset) {
  const kind = inferFileKind(asset);

  if (kind === "csv") {
    const rows = await parseCsvAsset(asset);
    return {
      kind,
      rawRows: rows,
      reviewRows: rows.map(buildReviewRow),
    };
  }

  if (kind === "excel") {
    const rows = await parseExcelAsset(asset);
    return {
      kind,
      rawRows: rows,
      reviewRows: rows.map(buildReviewRow),
    };
  }

  if (kind === "pdf") {
    return {
      kind,
      rawRows: [],
      reviewRows: [],
      message:
        "PDF file selected. Add backend OCR extraction next to convert PDF contents into review rows.",
    };
  }

  throw new Error("Unsupported file type.");
}