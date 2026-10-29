
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const batchId = Number(req.params.id);

  if (!Number.isSafeInteger(batchId) || batchId <= 0) {
    return res.status(400).json({
      error: "Invalid import batch ID",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, company_id
      FROM import_batches
      WHERE id = $1
      LIMIT 1
      `,
      [batchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Import batch not found",
      });
    }

    req.companyId = result.rows[0].company_id;
    return next();
  } catch (error) {
    console.error("importBatchAccess error:", error);
    return res.status(500).json({
      error: "Failed to validate import batch",
    });
  }
};
