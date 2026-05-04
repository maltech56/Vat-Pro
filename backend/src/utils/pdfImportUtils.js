const pdfParse = require("pdf-parse");

const OCR_CONFIDENCE_THRESHOLD = 80;

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const numeric = Number(cleaned);

  return Number.isNaN(numeric) ? 0 : numeric;
}

function calculateOcrRowConfidence(row) {
  let score = 100;
  const warnings = [];

  if (!row.transactionDate) {
    score -= 25;
    warnings.push("Missing transaction date");
  }

  if (!row.description || String(row.description).trim().length < 3) {
    score -= 20;
    warnings.push("Missing or weak description");
  }

  if (!row.amount || normalizeAmount(row.amount) <= 0) {
    score -= 30;
    warnings.push("Missing or invalid amount");
  }

  if (!row.type) {
    score -= 10;
    warnings.push("Missing transaction type");
  }

  if (!row.classification) {
    score -= 10;
    warnings.push("Missing VAT classification");
  }

  return {
    confidence: Math.max(score, 0),
    warnings,
    requiresReview: Math.max(score, 0) < OCR_CONFIDENCE_THRESHOLD,
  };
}

function parseRowsFromText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];

  for (const line of lines) {
    const dateMatch = line.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
    const amountMatch = line.match(/(?:BSD|\$)?\s?([0-9,]+\.\d{2})\b/);

    if (!dateMatch || !amountMatch) continue;

    const transactionDate = dateMatch[1];
    const amount = normalizeAmount(amountMatch[1]);

    const description = line
      .replace(dateMatch[0], "")
      .replace(amountMatch[0], "")
      .trim();

    rows.push({
      transactionDate,
      description,
      amount,
      type: "expense",
      classification: "taxable",
    });
  }

  return rows;
}

exports.extractPdfImportRows = async (buffer) => {
  const parsed = await pdfParse(buffer);
  const extractedText = parsed.text || "";

  const reviewRows = parseRowsFromText(extractedText);

  const scoredRows = reviewRows.map((row) => {
    const score = calculateOcrRowConfidence(row);

    return {
      ...row,
      confidence: score.confidence,
      warnings: score.warnings,
      requiresReview: score.requiresReview,
    };
  });

  const lowConfidenceRows = scoredRows.filter((row) => row.requiresReview);

  const warnings = [];

  if (!scoredRows.length) {
    warnings.push("No transaction rows could be confidently extracted from this PDF.");
  }

  if (lowConfidenceRows.length > 0) {
    warnings.push(`${lowConfidenceRows.length} row(s) require manual review.`);
  }

  return {
    method: "pdf-text-extraction",
    extractedText,
    reviewRows: scoredRows,
    totalRows: scoredRows.length,
    lowConfidenceRows: lowConfidenceRows.length,
    requiresManualReview: lowConfidenceRows.length > 0,
    warnings,
  };
};