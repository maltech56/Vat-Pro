const fs = require("fs");
const pool = require("../config/db");
const { parseImportFile } = require("../services/importParser");
const { extractPdfImportRows } = require("../utils/pdfImportUtils");
const {
  calculateVAT,
  FIXED_VAT_RATE,
} = require("../utils/vatCalculator");

const VALID_CLASSIFICATIONS = ["taxable", "zero_rated", "exempt"];
const VALID_TYPES = ["sale", "expense"];

function normalizeClassification(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (VALID_CLASSIFICATIONS.includes(normalized)) {
    return normalized;
  }

  return "taxable";
}

function normalizeType(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (VALID_TYPES.includes(normalized)) {
    return normalized;
  }

  return "expense";
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const numeric = Number(cleaned);

  return Number.isNaN(numeric) ? 0 : numeric;
}

function getParsedRows(parsed) {
  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;

  if (Array.isArray(parsed.rows)) return parsed.rows;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.preview)) return parsed.preview;

  // 🔥 fallback: try first array value
  for (const key in parsed) {
    if (Array.isArray(parsed[key])) {
      return parsed[key];
    }
  }

  return [];
}

function buildParsedRow(row) {
  const amount = normalizeAmount(
    row.amount ??
    row.Amount ??
    row.total ??
    row.Total ??
    row.value ??
    row.Value
  );

  const classification = normalizeClassification(
    row.classification ??
    row.Classification ??
    row.vatClassification ??
    row.vat_classification ??
    row.VATClassification ??
    row.VAT_Class ??
    row.vat_type
  );

  const type = normalizeType(
    row.type ?? row.Type ?? row.transactionType ?? row.transaction_type
  );

  const transactionDate = normalizeDate(
    row.transactionDate ??
    row.transaction_date ??
    row.date ??
    row.Date ??
    row.invoiceDate ??
    row.invoice_date
  );

  const description = String(
    row.description ??
    row.Description ??
    row.vendor ??
    row.Vendor ??
    row.memo ??
    row.Memo ??
    ""
  ).trim();

  const vatCalculation = calculateVAT(amount, classification);

  const vatAmount =
    typeof vatCalculation === "object"
      ? vatCalculation.vatAmount
      : vatCalculation;

  return {
    amount,
    vatAmount,
    vatRate: classification === "taxable" ? FIXED_VAT_RATE : 0,
    transactionDate,
    description,
    type,
    classification,
  };
}

function validateParsedRow(parsedRow) {
  const errors = [];

  if (!parsedRow.amount || parsedRow.amount <= 0) {
    errors.push("Amount must be greater than 0");
  }

  if (!VALID_TYPES.includes(parsedRow.type)) {
    errors.push("Type must be sale or expense");
  }

  if (!VALID_CLASSIFICATIONS.includes(parsedRow.classification)) {
    errors.push("Classification must be taxable, zero_rated, or exempt");
  }

  if (!parsedRow.transactionDate) {
    errors.push("Transaction date is required");
  }

  return {
    isValid: errors.length === 0,
    errorMessage: errors.join("; "),
  };
}

// ============================
// PDF IMPORT (EXISTING)
// ============================

exports.importPdfForReview = async (req, res) => {
  const client = await pool.connect();
  let batchId;

  try {
    const userId = req.user?.id;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        message: "Company ID is required.",
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        message: "No PDF file uploaded.",
      });
    }

    await client.query("BEGIN");

    const fileName = req.file.originalname || "ocr-import.pdf";

    const batchResult = await client.query(
      `
      INSERT INTO import_batches (
        company_id,
        uploaded_by,
        file_name,
        file_type,
        source_type,
        status,
        total_rows,
        valid_rows,
        error_rows,
        notes
      )
      VALUES ($1, $2, $3, 'pdf', 'ocr', 'processing', 0, 0, 0, NULL)
      RETURNING *
      `,
      [Number(companyId), userId || null, fileName]
    );

    const batch = batchResult.rows[0];
    batchId = batch.id;

    const result = await extractPdfImportRows(req.file.buffer);
    const reviewRows = Array.isArray(result.reviewRows) ? result.reviewRows : [];

    let totalRows = 0;
    let validRows = 0;
    let errorRows = 0;

    const stagedRows = [];

    for (let i = 0; i < reviewRows.length; i++) {
      const row = reviewRows[i];

      const parsedRow = buildParsedRow({
        amount: row.amount,
        description: row.description,
        transactionDate: row.transactionDate,
        type: row.type || "expense",
        classification: row.classification || "taxable",
      });

      const rowWarnings = Array.isArray(row.warnings) ? row.warnings : [];
      const validation = validateParsedRow(parsedRow);

      const requiresReview = !!row.requiresReview;
      const hasErrors = !validation.isValid || requiresReview;

      totalRows += 1;

      const rowStatus = hasErrors ? "error" : "valid";
      const errorMessage = [
        validation.errorMessage,
        ...rowWarnings,
        requiresReview ? "Low OCR confidence - manual review required" : null,
      ]
        .filter(Boolean)
        .join("; ");

      if (rowStatus === "valid") {
        validRows += 1;
      } else {
        errorRows += 1;
      }

      await client.query(
        `
        INSERT INTO import_rows (
          batch_id,
          row_number,
          raw_data,
          parsed_data,
          status,
          error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          batchId,
          i + 1,
          JSON.stringify(row),
          JSON.stringify(parsedRow),
          rowStatus,
          errorMessage || null,
        ]
      );

      stagedRows.push({
        rowNumber: i + 1,
        raw: row,
        parsed: parsedRow,
        status: rowStatus,
        errorMessage: errorMessage || null,
        confidence: row.confidence ?? null,
        requiresReview,
        warnings: rowWarnings,
      });
    }

    await client.query(
      `
      UPDATE import_batches
      SET
        total_rows = $1,
        valid_rows = $2,
        error_rows = $3,
        status = 'preview_ready',
        notes = $4
      WHERE id = $5
      `,
      [
        totalRows,
        validRows,
        errorRows,
        (result.warnings || []).join(" | ") || null,
        batchId,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "PDF processed successfully.",
      batchId,
      method: result.method,
      extractedTextPreview: (result.extractedText || "").slice(0, 1000),

      // Frontend compatibility:
      // reviewRows = OCR-specific name
      // preview = shared name used by CSV/Excel imports
      reviewRows: stagedRows,
      preview: stagedRows,

      totalRows,
      validRows,
      errorRows,
      lowConfidenceRows: result.lowConfidenceRows || 0,
      requiresManualReview: result.requiresManualReview || false,
      warnings: result.warnings || [],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("PDF OCR rollback failed:", rollbackError);
    }

    if (batchId) {
      try {
        await client.query(
          `
            UPDATE import_batches
            SET status = 'failed',
                notes = $2
            WHERE id = $1
            `,
          [batchId, error.message]
        );
      } catch (statusUpdateError) {
        console.error("Failed to mark PDF OCR batch failed:", statusUpdateError);
      }
    }

    console.error("PDF import error:", error);

    return res.status(500).json({
      message: "Failed to process PDF import.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// ============================
// CSV / EXCEL IMPORT (UPGRADED)
// ============================

exports.uploadAndPreviewImport = async (req, res) => {
  const client = await pool.connect();
  let batchId;

  try {
    const userId = req.user?.id;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = req.file.originalname || "import-file";
    const filePath = req.file.path;

    let fileType = "csv";
    const extension = (fileName.split(".").pop() || "").toLowerCase();

    if (["xlsx", "xls"].includes(extension)) {
      fileType = "excel";
    } else if (extension === "csv") {
      fileType = "csv";
    }

    await client.query("BEGIN");

    // 1. Create import batch
    const batchResult = await client.query(
      `
      INSERT INTO import_batches (
        company_id,
        uploaded_by,
        file_name,
        file_type,
        source_type,
        status,
        total_rows,
        valid_rows,
        error_rows,
        notes
      )
      VALUES ($1, $2, $3, $4, 'upload', 'processing', 0, 0, 0, NULL)
      RETURNING *
      `,
      [Number(companyId), userId || null, fileName, fileType]
    );

    const batch = batchResult.rows[0];

    batchId = batch.id;


    // 2. Parse file
    const parsed = await parseImportFile(filePath);
    const rawRows = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed || {}).find(Array.isArray) || [];

    if (!rawRows.length) {
      await client.query(
        `
    UPDATE import_batches
    SET 
      status = 'failed',
      error_rows = 0,
      valid_rows = 0,
      total_rows = 0,
      notes = 'No rows could be parsed from file'
    WHERE id = $1
    `,
        [batchId]
      );

      await client.query("COMMIT");

      return res.status(400).json({
        error: "No rows could be parsed from the uploaded file",
        batchId,
      });
    }

    let totalRows = 0;
    let validRows = 0;
    let errorRows = 0;

    const previewRows = [];

    // 3. Stage rows into import_rows
    for (let i = 0; i < rawRows.length; i++) {
      const rawRow = rawRows[i];
      const parsedRow = buildParsedRow(rawRow);
      const validation = validateParsedRow(parsedRow);

      totalRows += 1;

      const rowStatus = validation.isValid ? "valid" : "error";
      const errorMessage = validation.isValid ? null : validation.errorMessage;

      if (validation.isValid) {
        validRows += 1;
      } else {
        errorRows += 1;
      }

      await client.query(
        `
        INSERT INTO import_rows (
          batch_id,
          row_number,
          raw_data,
          parsed_data,
          status,
          error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          batchId,
          i + 1,
          JSON.stringify(rawRow),
          JSON.stringify(parsedRow),
          rowStatus,
          errorMessage,
        ]
      );

      previewRows.push({
        rowNumber: i + 1,
        raw: rawRow,
        parsed: parsedRow,
        status: rowStatus,
        errorMessage,
      });
    }

    // 4. Update batch stats
    await client.query(
      `
      UPDATE import_batches
      SET
        total_rows = $1,
        valid_rows = $2,
        error_rows = $3,
        status = 'preview_ready'
      WHERE id = $4
      `,
      [totalRows, validRows, errorRows, batchId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Import preview generated successfully",
      batchId,
      fileName,
      filePath,
      companyId: Number(companyId),
      totalRows,
      validRows,
      errorRows,
      preview: previewRows,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    if (batchId) {
      try {
        await client.query(
          `
        UPDATE import_batches
        SET status = 'failed',
            notes = $2
        WHERE id = $1
        `,
          [batchId, error.message]
        );
      } catch (statusUpdateError) {
        console.error("Failed to mark import batch as failed:", statusUpdateError);
      }
    }

    console.error("uploadAndPreviewImport error:", error);

    return res.status(500).json({
      error: "Failed to process import preview",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
};

exports.confirmImport = async (req, res) => {
  const client = await pool.connect();

  try {
    const { batchId } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: "Batch ID is required" });
    }

    await client.query("BEGIN");

    // 1. Load batch
    const batchResult = await client.query(
      `
      SELECT *
      FROM import_batches
      WHERE id = $1
      LIMIT 1
      `,
      [batchId]
    );

    if (batchResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Import batch not found" });
    }

    const batch = batchResult.rows[0];

    if (batch.status === "imported") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "This batch has already been imported.",
      });
    }

    if (batch.status !== "preview_ready") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Batch is not ready for import. Current status: ${batch.status}`,
      });
    }

    // 2. Load staged rows
    const rowsResult = await client.query(
      `
      SELECT *
      FROM import_rows
      WHERE batch_id = $1
      AND status = 'valid'
      ORDER BY row_number ASC
      `,
      [batchId]
    );

    if (rowsResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "No valid rows to import. Please fix errors before confirming.",
      });
    }

    const inserted = [];

    // 3. Insert transactions + mark rows imported
    for (const row of rowsResult.rows) {
     
      const parsed =
        typeof row.parsed_data === "string"
          ? JSON.parse(row.parsed_data)
          : row.parsed_data;

      const amount = normalizeAmount(parsed?.amount);
      const classification = normalizeClassification(parsed?.classification);
      const type = normalizeType(parsed?.type);
      const transactionDate = normalizeDate(parsed?.transactionDate);
      const description = String(parsed?.description || "").trim();

      const vatCalculation = calculateVAT(amount, classification);
      const vatAmount =
        typeof vatCalculation === "object"
          ? Number(vatCalculation.vatAmount || 0)
          : Number(vatCalculation || 0);

      // Duplicate warning check only.
      // This does not block the import yet.
      const duplicateCheck = await client.query(
        `
        SELECT id
        FROM transactions
        WHERE company_id = $1
          AND amount = $2
          AND transaction_date = $3
          AND type = $4
          AND description = $5
        LIMIT 1
        `,
        [
          batch.company_id,
          amount,
          transactionDate,
          type,
          description,
        ]
      );

      if (duplicateCheck.rows.length > 0) {
        console.warn("DUPLICATE DETECTED DURING IMPORT:", {
          batchId,
          rowId: row.id,
          description,
          amount,
          transactionDate,
          existingTransactionId: duplicateCheck.rows[0].id,
        });
      }

      try {
        const transactionResult = await client.query(
          `
          INSERT INTO transactions (
            company_id,
            type,
            amount,
            vat_amount,
            vat_classification,
            transaction_date,
            description,
            import_batch_id,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING *
          `,
          [
            batch.company_id,
            type,
            amount,
            vatAmount,
            classification,
            transactionDate,
            description,
            batchId
          ]
        );

        const insertedTransaction = transactionResult.rows[0];
        inserted.push(insertedTransaction);

        await client.query(
          `
          UPDATE import_rows
          SET
            status = 'imported',
            transaction_id = $1,
            error_message = NULL
          WHERE id = $2
          `,
          [insertedTransaction.id, row.id]
        );
      } catch (err) {
        console.error("ROW INSERT FAILED:", err.message);
        throw err;
      }
    }

    // 4. Mark batch imported
    await client.query(
      `
      UPDATE import_batches
      SET status = 'imported'
      WHERE id = $1
      `,
      [batchId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Import completed successfully",
      batchId: Number(batchId),
      insertedCount: inserted.length,
      transactions: inserted,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    console.error("confirmImport FULL ERROR:", error);

    return res.status(500).json({
      error: "Failed to confirm import",
      details: error.message,
    });
  } finally {
    client.release();
  }
};