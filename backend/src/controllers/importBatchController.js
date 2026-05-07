const pool = require("../config/db");

exports.getCompanyImportBatches = async (req, res) => {
  const { companyId } = req.params;

  try {
    console.log("getCompanyImportBatches HIT", { companyId, user: req.user });

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.company_id,
        b.uploaded_by,
        b.file_name,
        b.file_type,
        b.source_type,
        b.status,
        b.total_rows,
        b.valid_rows,
        b.error_rows,
        b.notes,
        b.created_at,
        b.updated_at
      FROM import_batches b
      WHERE b.company_id = $1
        AND b.status IN ('preview_ready', 'imported', 'failed', 'undone')
      ORDER BY b.created_at DESC
      LIMIT 25
      `,
      [companyId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("getCompanyImportBatches error message:", error.message);
    console.error("getCompanyImportBatches error stack:", error.stack);
    console.error("getCompanyImportBatches full error:", error);

    return res.status(500).json({
      error: "Failed to fetch import batches",
      details: error.message,
    });
  }
};

exports.getImportBatchById = async (req, res) => {
  const { id } = req.params;

  try {
    const batchResult = await pool.query(
      `
      SELECT
        b.id,
        b.company_id,
        b.uploaded_by,
        b.file_name,
        b.file_type,
        b.source_type,
        b.status,
        b.total_rows,
        b.valid_rows,
        b.error_rows,
        b.notes,
        b.created_at,
        b.updated_at
      FROM import_batches b
      WHERE b.id = $1
      `,
      [id]
    );

    if (!batchResult.rows.length) {
      return res.status(404).json({ error: "Import batch not found" });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        id,
        batch_id,
        transaction_id,
        row_number,
        raw_data,
        parsed_data,
        status,
        error_message,
        created_at
      FROM import_rows
      WHERE batch_id = $1
      ORDER BY row_number ASC, id ASC
      `,
      [id]
    );

    return res.json({
      batch: batchResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error("getImportBatchById error:", error);
    return res.status(500).json({ error: "Failed to fetch import batch details" });
  }
};

exports.createImportBatch = async (req, res) => {
  console.log("REQ.BODY ROWS:", req.body.rows);
  const userId = req.user.id;

  const {
    companyId,
    sourceType,
    templateId = null,
    fileName = null,
    totalRows = 0,
    successRows = 0,
    failedRows = 0,
    status = "completed",
    rows = [], // 👈 NEW
  } = req.body;

  if (!companyId || !sourceType) {
    return res.status(400).json({
      error: "companyId and sourceType are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create batch
    const batchResult = await client.query(
      `
      INSERT INTO import_batches (
        company_id,
        source_type,
        template_id,
        file_name,
        total_rows,
        valid_rows,
        error_rows,
        status,
        uploaded_by,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      RETURNING *
      `,
      [
        companyId,
        sourceType,
        templateId,
        fileName,
        totalRows,
        successRows,
        failedRows,
        status,
        userId,
      ]
    );

    const batch = batchResult.rows[0];
    const batchId = batch.id;

    // 2. Insert batch items (🔥 THIS IS THE FIX)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      await client.query(
        `
        INSERT INTO import_rows (
          batch_id,
          row_number,
          raw_data,
          parsed_data,
          status,
          error_message,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,NOW())
        `,
        [
          batchId,
          i + 1,
          row,
          row,
          row.status || "pending",
          row.error || null,
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json(batch);

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("createImportBatch error:", error);

    return res.status(500).json({
      error: "Failed to create import batch",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

exports.undoImportBatch = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchResult = await client.query(
      `
      SELECT *
      FROM import_batches
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (!batchResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Import batch not found" });
    }

    const batch = batchResult.rows[0];

    if (batch.status !== "imported") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Only imported batches can be undone",
        currentStatus: batch.status,
      });
    }

    const transactionsResult = await client.query(
      `
      SELECT id
      FROM transactions
      WHERE import_batch_id = $1
        AND company_id = $2
      `,
      [id, batch.company_id]
    );

    const transactionIds = transactionsResult.rows.map((row) => row.id);

    await client.query(
      `
      DELETE FROM transactions
      WHERE import_batch_id = $1
        AND company_id = $2
      `,
      [id, batch.company_id]
    );

    await client.query(
      `
      UPDATE import_rows
      SET
        status = 'undone',
        transaction_id = NULL
      WHERE batch_id = $1
      `,
      [id]
    );

    await client.query(
      `
      UPDATE import_batches
      SET
        status = 'undone',
        notes = COALESCE(notes, '') || ' | Import undone successfully',
        updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Import batch undone successfully",
      batchId: Number(id),
      deletedTransactions: transactionIds.length,
      transactionIds,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("undoImportBatch error:", error);

    return res.status(500).json({
      error: "Failed to undo import batch",
      details: error.message,
    });
  } finally {
    client.release();
  }
};