const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Document ID is required" });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM company_documents
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    req.document = result.rows[0];
    req.companyId = result.rows[0].company_id;

    next();
  } catch (error) {
    console.error("documentAccessById error:", error);
    res.status(500).json({ error: "Server error loading document" });
  }
};