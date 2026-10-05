const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const { filingId } = req.params;

  if (!filingId) {
    return res.status(400).json({ error: "Filing ID is required" });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, company_id, status
      FROM vat_filings
      WHERE id = $1
      LIMIT 1
      `,
      [filingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "VAT filing not found" });
    }

    req.filing = result.rows[0];
    req.companyId = result.rows[0].company_id;

    next();
  } catch (error) {
    console.error("filingAccessById error:", error);

    return res.status(500).json({
      error: "Server error loading VAT filing",
    });
  }
};