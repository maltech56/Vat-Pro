
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const templateId = Number(req.params.id);

  if (!Number.isSafeInteger(templateId) || templateId <= 0) {
    return res.status(400).json({
      error: "Invalid import template ID",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, company_id
      FROM import_templates
      WHERE id = $1
      LIMIT 1
      `,
      [templateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Import template not found",
      });
    }

    req.companyId = result.rows[0].company_id;
    return next();
  } catch (error) {
    console.error("importTemplateAccess error:", error);
    return res.status(500).json({
      error: "Failed to validate import template access",
    });
  }
};
