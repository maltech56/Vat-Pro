
const pool = require("../config/db");
const { toCents, fromCents } = require("../utils/money");

// GET /api/quickbooks/review/:companyId/:batchId
exports.getQuickBooksReviewBatch = async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const batchId = Number(req.params.batchId);

    if (
      !Number.isSafeInteger(companyId) ||
      companyId <= 0 ||
      !Number.isSafeInteger(batchId) ||
      batchId <= 0
    ) {
      return res.status(400).json({
        error: "Invalid company ID or batch ID",
      });
    }

    const batchResult = await pool.query(
      `
      SELECT
        id,
        company_id,
        source_type,
        status,
        total_rows,
        valid_rows,
        error_rows,
        created_at
      FROM import_batches
      WHERE id = $1
        AND company_id = $2
        AND source_type = 'quickbooks'
      `,
      [batchId, companyId]
    );

    if (!batchResult.rows.length) {
      return res.status(404).json({
        error: "QuickBooks review batch not found",
      });
    }

    const rowsResult = await pool.query(
      `
      SELECT
        r.id,
        r.row_number,
        r.status,
        r.parsed_data,
        r.error_message,
        t.entity_type,
        t.quickbooks_id,
        t.status AS tracking_status
      FROM import_rows r
      INNER JOIN quickbooks_transaction_tracking t
        ON t.import_row_id = r.id
      WHERE r.batch_id = $1
        AND t.company_id = $2
      ORDER BY r.row_number ASC
      `,
      [batchId, companyId]
    );

    return res.json({
      success: true,
      batch: batchResult.rows[0],
      rows: rowsResult.rows,
      rowCount: rowsResult.rows.length,
    });
  } catch (error) {
    console.error("QuickBooks review retrieval error:", error);

    return res.status(500).json({
      error: "Failed to retrieve QuickBooks review batch",
    });
  }
};


// PATCH /api/quickbooks/review/:companyId/:batchId/lines/:lineId
exports.reviewQuickBooksLine = async (req, res) => {
  let client;

  try {
    const companyId = Number(req.params.companyId);
    const batchId = Number(req.params.batchId);
    const lineId = Number(req.params.lineId);
    const userId = Number(req.user?.id);

    if (
      ![companyId, batchId, lineId, userId].every(
        (value) => Number.isSafeInteger(value) && value > 0
      )
    ) {
      return res.status(400).json({
        error: "Invalid company, batch, line, or user ID"
      });
    }

    const { classification, amount } = req.body || {};

    if (
      !["taxable", "zero_rated", "exempt"].includes(classification)
    ) {
      return res.status(400).json({
        error: "Invalid Bahamas VAT classification"
      });
    }

    // Require an explicit, finite, nonnegative amount
    // with no more than two decimal places.
    const amountText = String(amount ?? "");

    if (
      !/^\d+(?:\.\d{1,2})?$/.test(amountText) ||
      !Number.isFinite(Number(amountText)) ||
      Number(amountText) > 9999999999.99
    ) {
      return res.status(400).json({
        error: "A valid VAT-exclusive amount is required"
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const accessResult = await client.query(
      `SELECT role
       FROM user_companies
       WHERE user_id = $1 AND company_id = $2
       LIMIT 1`,
      [userId, companyId]
    );

    if (
      !accessResult.rows.length ||
      !["admin", "staff"].includes(accessResult.rows[0].role)
    ) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Insufficient company permissions"
      });
    }

    const result = await client.query(
      `SELECT
          q.id,
          q.line_type,
          q.review_status,
          r.id AS import_row_id,
          r.status AS import_row_status,
          b.status AS batch_status,
          t.status AS tracking_status,
          COALESCE(a.approval_status, 'pending_review') AS document_approval_status
       FROM quickbooks_review_lines q
       JOIN import_rows r ON r.id = q.import_row_id
       JOIN import_batches b ON b.id = r.batch_id
       JOIN quickbooks_transaction_tracking t
         ON t.import_row_id = r.id
       LEFT JOIN quickbooks_document_approvals a
         ON a.import_row_id = r.id
       WHERE q.id = $1
         AND r.batch_id = $2
         AND b.company_id = $3
         AND b.source_type = 'quickbooks'
         AND t.company_id = $3
       FOR UPDATE OF q, r, b, t`,
      [lineId, batchId, companyId]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "QuickBooks review line not found"
      });
    }

    const line = result.rows[0];

    if (
      line.batch_status !== "review_required" ||
      line.import_row_status !== "pending_review" ||
      line.tracking_status !== "staged"
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "This QuickBooks record is not available for review"
      });
    }

    if (line.line_type !== "financial") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Discount and subtotal lines require separate handling"
      });
    }

    if (
      line.review_status === "approved" ||
      line.document_approval_status === "approved"
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Approved lines cannot be modified"
      });
    }

    const updated = await client.query(
      `UPDATE quickbooks_review_lines
       SET reviewed_amount = $1,
           vat_classification = $2,
           review_status = 'reviewed',
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING
         id,
         import_row_id,
         line_index,
         reviewed_amount,
         vat_classification,
         review_status,
         reviewed_by,
         reviewed_at`,
      [amountText, classification, userId, lineId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "QuickBooks VAT line reviewed",
      line: updated.rows[0],
      transactionsPosted: 0
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("VAT review rollback error:", rollbackError);
      }
    }

    console.error("QuickBooks VAT line review error:", error);

    return res.status(500).json({
      error: "Failed to review QuickBooks VAT line"
    });

  } finally {
    if (client) client.release();
  }
};

// GET /api/quickbooks/review/:companyId/:batchId/documents/:importRowId/readiness
exports.getQuickBooksDocumentReadiness = async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const batchId = Number(req.params.batchId);
    const importRowId = Number(req.params.importRowId);

    if (
      ![companyId, batchId, importRowId].every(
        (value) => Number.isSafeInteger(value) && value > 0
      )
    ) {
      return res.status(400).json({
        error: "Invalid company, batch, or document ID"
      });
    }

    const documentResult = await pool.query(
      `SELECT
         r.id,
         r.batch_id,
         r.status AS import_status,
         r.raw_data,
         b.status AS batch_status,
         a.approval_status,
         t.status AS tracking_status
       FROM import_rows r
       JOIN import_batches b ON b.id = r.batch_id
       JOIN quickbooks_transaction_tracking t
         ON t.import_row_id = r.id
       JOIN quickbooks_document_approvals a
         ON a.import_row_id = r.id
       WHERE r.id = $1
         AND r.batch_id = $2
         AND b.company_id = $3
         AND b.source_type = 'quickbooks'
         AND t.company_id = $3`,
      [importRowId, batchId, companyId]
    );

    if (!documentResult.rows.length) {
      return res.status(404).json({
        error: "QuickBooks document not found"
      });
    }

    const document = documentResult.rows[0];

    const linesResult = await pool.query(
      `SELECT
     id,
     line_index,
     line_type,
     original_amount,
     reviewed_amount,
     vat_classification,
     review_status
   FROM quickbooks_review_lines
   WHERE import_row_id = $1
   ORDER BY line_index`,
      [importRowId]
    );

    const lines = linesResult.rows;
    const financialLines = lines.filter(
      (line) => line.line_type === "financial"
    );

    const discountLines = lines.filter(
      (line) => line.line_type === "discount"
    );

    const reviewedFinancialLines = financialLines.filter(
      (line) =>
        line.review_status === "reviewed" &&
        line.reviewed_amount !== null &&
        ["taxable", "zero_rated", "exempt"].includes(
          line.vat_classification
        )
    );

    const blockers = [];

    if (
      document.batch_status !== "review_required" ||
      document.import_status !== "pending_review" ||
      document.tracking_status !== "staged"
    ) {
      blockers.push("Document is not in a reviewable state");
    }

    if (document.approval_status !== "pending_review") {
      blockers.push("Document is not pending approval");
    }

    if (financialLines.length === 0) {
      blockers.push("Document has no underlying financial lines");
    }

    if (reviewedFinancialLines.length !== financialLines.length) {
      blockers.push("Financial-line VAT review is incomplete");
    }

    if (discountLines.length > 0) {
      blockers.push("Discount allocation requires separate review");
    }

    // Source reconciliation uses QuickBooks amounts only.
    // QuickBooks source tax is NOT Bahamas VAT.
    const raw = document.raw_data || {};
    let reconciliationDifference = null;

    try {
      const sourceTotalCents = toCents(raw.TotalAmt);
      const sourceTaxCents = toCents(
        raw.TxnTaxDetail?.TotalTax ?? "0"
      );

      const sumTypeCents = (type) =>
        lines
          .filter(line => line.line_type === type)
          .reduce(
            (sum, line) => sum + toCents(line.original_amount),
            0
          );

      const financialTotalCents = sumTypeCents("financial");
      const subtotalTotalCents = sumTypeCents("subtotal");
      const discountTotalCents = sumTypeCents("discount");

      const baseTotalCents =
        financialLines.length === 0
          ? subtotalTotalCents
          : financialTotalCents;

      const calculatedTotalCents =
        baseTotalCents - discountTotalCents + sourceTaxCents;

      if (
        !Number.isSafeInteger(calculatedTotalCents) ||
        calculatedTotalCents < 0
      ) {
        throw new Error("Invalid calculated QuickBooks total");
      }

      const differenceCents =
        sourceTotalCents - calculatedTotalCents;

      reconciliationDifference = Number(
        (differenceCents / 100).toFixed(2)
      );

      if (differenceCents !== 0) {
        blockers.push("QuickBooks source totals do not reconcile");
      }
    } catch (error) {
      blockers.push("Invalid QuickBooks source amounts");
    }

    return res.json({
      success: true,
      importRowId,
      documentNumber: raw.DocNumber ?? null,
      approvalStatus: document.approval_status,
      financialLines: financialLines.length,
      reviewedFinancialLines: reviewedFinancialLines.length,
      discountLines: discountLines.length,
      reconciliationDifference,
      readyForApproval: blockers.length === 0,
      blockers,
      transactionsPosted: 0
    });

  } catch (error) {
    console.error("QuickBooks readiness check error:", error);

    return res.status(500).json({
      error: "Failed to check QuickBooks document readiness"
    });
  }
};

// POST /api/quickbooks/review/:companyId/:batchId/documents/:importRowId/approve
// Validation-only phase: no approvals or financial posting.
exports.approveQuickBooksDocument = async (req, res) => {
  let client;

  try {
    const companyId = Number(req.params.companyId);
    const batchId = Number(req.params.batchId);
    const importRowId = Number(req.params.importRowId);
    const userId = Number(req.user?.id);

    if (
      ![companyId, batchId, importRowId, userId].every(
        value => Number.isSafeInteger(value) && value > 0
      )
    ) {
      return res.status(400).json({
        error: "Invalid company, batch, document, or user ID"
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT
         r.id,
         r.status AS import_status,
         r.raw_data,
         b.status AS batch_status,
         t.status AS tracking_status,
         a.approval_status
       FROM import_batches b
       JOIN import_rows r ON r.batch_id = b.id
       JOIN quickbooks_transaction_tracking t
         ON t.import_row_id = r.id
       JOIN quickbooks_document_approvals a
         ON a.import_row_id = r.id
       WHERE b.id = $1
         AND b.company_id = $2
         AND b.source_type = 'quickbooks'
         AND r.id = $3
         AND t.company_id = $2
         AND EXISTS (
           SELECT 1
           FROM user_companies uc
           WHERE uc.company_id = b.company_id
             AND uc.user_id = $4
             AND uc.role = 'admin'
         )
       FOR UPDATE OF b, r, t, a`,
      [batchId, companyId, importRowId, userId]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Document not found or administrator access required"
      });
    }

    const document = result.rows[0];

    const linesResult = await client.query(
      `SELECT
         id,
         line_index,
         line_type,
         original_amount,
         reviewed_amount,
         vat_classification,
         review_status
      FROM quickbooks_review_lines
      WHERE import_row_id = $1
      ORDER BY line_index
      FOR UPDATE`,
      [importRowId]
    );

    const lines = linesResult.rows;
    const financialLines = lines.filter(
      line => line.line_type === "financial"
    );
    const discountLines = lines.filter(
      line => line.line_type === "discount"
    );

    const blockers = [];

    if (
      document.batch_status !== "review_required" ||
      document.import_status !== "pending_review" ||
      document.tracking_status !== "staged" ||
      document.approval_status !== "pending_review"
    ) {
      blockers.push("Document is not pending approval");
    }

    if (financialLines.length === 0) {
      blockers.push("Document has no financial lines");
    }

    if (financialLines.some(line =>
      line.review_status !== "reviewed" ||
      line.reviewed_amount === null ||
      !["taxable", "zero_rated", "exempt"].includes(
        line.vat_classification
      )
    )) {
      blockers.push("Financial-line review is incomplete");
    }

    if (discountLines.length > 0) {
      blockers.push("Discount allocation has not been approved");
    }

    // Source reconciliation is deliberately not treated as
    // complete here. Exact monetary and tax reconciliation
    // must be implemented before approvals can be enabled.
    // Exact QuickBooks source reconciliation using integer cents.
    // Source tax is NOT Bahamas VAT.
    try {
      const raw = typeof document.raw_data === "string"
        ? JSON.parse(document.raw_data)
        : document.raw_data;

      const sourceTotalCents = toCents(raw.TotalAmt);
      const sourceTaxCents = toCents(
        raw.TxnTaxDetail?.TotalTax ?? "0"
      );

      let originalSubtotalCents = 0;
      let reviewedSubtotalCents = 0;
      // Verify staged financial lines against original QuickBooks JSON.
      const sourceLines = raw.Line;

      if (!Array.isArray(sourceLines)) {
        throw new Error("Original QuickBooks lines are missing");
      }

      // Detect QuickBooks discount lines missing from staging.
      const stagedDiscountIndexes = new Set(
        discountLines.map(line => line.line_index)
      );

      for (let index = 0; index < sourceLines.length; index++) {
        const sourceLine = sourceLines[index];

        if (
          sourceLine &&
          sourceLine.DetailType === "DiscountLineDetail" &&
          !stagedDiscountIndexes.has(index)
        ) {
          blockers.push(
            `Missing staged QuickBooks discount line at index ${index}`
          );
        }
      }

      // Ensure every original QuickBooks financial line is staged.
      const stagedFinancialIndexes = new Set(
        financialLines.map(line => line.line_index)
      );

      for (let index = 0; index < sourceLines.length; index++) {
        const sourceLine = sourceLines[index];

        if (
          sourceLine &&
          (
            sourceLine.DetailType === "SalesItemLineDetail" ||
            sourceLine.DetailType === "ItemBasedExpenseLineDetail" ||
            sourceLine.DetailType === "AccountBasedExpenseLineDetail"
          ) &&
          !stagedFinancialIndexes.has(index)
        ) {
          blockers.push(
            `Missing staged QuickBooks financial line at index ${index}`
          );
        }
      }
      for (const line of financialLines) {
        if (
          !Number.isSafeInteger(line.line_index) ||
          line.line_index < 0 ||
          line.line_index >= sourceLines.length
        ) {
          throw new Error("Invalid QuickBooks source line index");
        }

        const sourceLine = sourceLines[line.line_index];

        if (
          !sourceLine ||
          toCents(sourceLine.Amount) !== toCents(line.original_amount)
        ) {
          blockers.push(
            `Original QuickBooks amount mismatch on line ${line.id}`
          );
        }
      }

      for (const line of financialLines) {
        originalSubtotalCents += toCents(line.original_amount);

        if (line.reviewed_amount !== null) {
          reviewedSubtotalCents += toCents(line.reviewed_amount);
        }
      }

      const originalAmountsMatch =
        originalSubtotalCents + sourceTaxCents === sourceTotalCents;

      const reviewedAmountsMatch =
        reviewedSubtotalCents === originalSubtotalCents;

      if (!originalAmountsMatch) {
        blockers.push("QuickBooks source amounts do not reconcile");
      }

      if (!reviewedAmountsMatch) {
        blockers.push("Reviewed financial amounts differ from source amounts");
      }

      console.log("QuickBooks reconciliation:", {
        importRowId,
        sourceTotal: fromCents(sourceTotalCents),
        sourceTax: fromCents(sourceTaxCents),
        originalSubtotal: fromCents(originalSubtotalCents),
        reviewedSubtotal: fromCents(reviewedSubtotalCents),
        originalAmountsMatch,
        reviewedAmountsMatch
      });

    } catch (reconciliationError) {
      console.error(
        "QuickBooks monetary reconciliation error:",
        reconciliationError.message
      );

      blockers.push("Monetary reconciliation failed");
    }

    blockers.push("Final monetary reconciliation is not yet enabled");

    await client.query("ROLLBACK");

    return res.status(409).json({
      success: false,
      validationOnly: true,
      importRowId,
      readyForApproval: false,
      blockers,
      approvalStatus: document.approval_status,
      transactionsPosted: 0
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Approval rollback error:", rollbackError);
      }
    }

    console.error("QuickBooks approval validation error:", error);

    return res.status(500).json({
      error: "Failed to validate QuickBooks document approval"
    });
  } finally {
    if (client) client.release();
  }
};
