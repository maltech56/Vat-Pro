const pool = require("../config/db");

const normalizeColumns = (columns = []) => {
  return columns
    .map((col) => String(col || "").trim().toLowerCase())
    .filter(Boolean)
    .sort();
};

exports.getCompanyTemplates = async (req, res) => {
  const { companyId, sourceType } = req.query;

  if (!companyId) {
    return res.status(400).json({ error: "companyId is required" });
  }

  try {
    const query = `
      SELECT
        id,
        company_id,
        source_type,
        template_name,
        mapping,
        column_signature,
        is_default,
        created_by,
        created_at,
        updated_at
      FROM import_templates
      WHERE company_id = $1
        AND ($2::text IS NULL OR source_type = $2)
      ORDER BY is_default DESC, template_name ASC
    `;

    const result = await pool.query(query, [
      companyId,
      sourceType || null,
    ]);

    res.json(result.rows);
  } catch (error) {
    console.error("getCompanyTemplates error:", error);
    res.status(500).json({ error: "Failed to fetch import templates" });
  }
};

exports.createTemplate = async (req, res) => {
  const userId = req.user.id;
  const {
    companyId,
    sourceType,
    templateName,
    mapping,
    columnSignature,
    isDefault = false,
  } = req.body;

  if (!companyId || !sourceType || !templateName || !mapping) {
    return res.status(400).json({
      error: "companyId, sourceType, templateName, and mapping are required",
    });
  }

  try {
    if (isDefault) {
      await pool.query(
        `
        UPDATE import_templates
        SET is_default = false, updated_at = NOW()
        WHERE company_id = $1 AND source_type = $2
        `,
        [companyId, sourceType]
      );
    }

    const result = await pool.query(
      `
      INSERT INTO import_templates (
        company_id,
        source_type,
        template_name,
        mapping,
        column_signature,
        is_default,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
      `,
      [
        companyId,
        sourceType,
        templateName,
        mapping,
        normalizeColumns(columnSignature || []),
        isDefault,
        userId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("createTemplate error:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
};

exports.updateTemplate = async (req, res) => {
  const { id } = req.params;
  const {
    templateName,
    mapping,
    columnSignature,
    isDefault,
  } = req.body;

  try {
    const existing = await pool.query(
      `SELECT * FROM import_templates WHERE id = $1`,
      [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Template not found" });
    }

    const template = existing.rows[0];

    if (isDefault === true) {
      await pool.query(
        `
        UPDATE import_templates
        SET is_default = false, updated_at = NOW()
        WHERE company_id = $1 AND source_type = $2 AND id <> $3
        `,
        [template.company_id, template.source_type, id]
      );
    }

    const result = await pool.query(
      `
      UPDATE import_templates
      SET
        template_name = COALESCE($1, template_name),
        mapping = COALESCE($2, mapping),
        column_signature = COALESCE($3, column_signature),
        is_default = COALESCE($4, is_default),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [
        templateName ?? null,
        mapping ?? null,
        columnSignature ? normalizeColumns(columnSignature) : null,
        typeof isDefault === "boolean" ? isDefault : null,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("updateTemplate error:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
};

exports.deleteTemplate = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM import_templates WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("deleteTemplate error:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
};

exports.detectTemplate = async (req, res) => {
  const { companyId, sourceType, columns } = req.body;

  if (!companyId || !sourceType || !Array.isArray(columns)) {
    return res.status(400).json({
      error: "companyId, sourceType, and columns are required",
    });
  }

  try {
    const normalizedIncoming = normalizeColumns(columns);

    const result = await pool.query(
      `
      SELECT
        id,
        company_id,
        source_type,
        template_name,
        mapping,
        column_signature,
        is_default
      FROM import_templates
      WHERE company_id = $1 AND source_type = $2
      ORDER BY is_default DESC, updated_at DESC
      `,
      [companyId, sourceType]
    );

    let bestMatch = null;

    for (const template of result.rows) {
      const templateCols = Array.isArray(template.column_signature)
        ? template.column_signature
        : [];

      const matched = templateCols.filter((col) =>
        normalizedIncoming.includes(col)
      ).length;

      const score = templateCols.length
        ? matched / templateCols.length
        : 0;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          ...template,
          score,
        };
      }
    }

    if (!bestMatch || bestMatch.score < 0.6) {
      return res.json({
        matched: false,
        template: null,
      });
    }

    res.json({
      matched: true,
      template: bestMatch,
    });
  } catch (error) {
    console.error("detectTemplate error:", error);
    res.status(500).json({ error: "Failed to detect template" });
  }
};