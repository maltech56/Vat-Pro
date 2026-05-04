const pool = require("../config/db");
const createDefaultCompanySettings = require("../utils/createDefaultCompanySettings");

// Create company
exports.createCompany = async (req, res) => {
  const userId = req.user.id;
  const { name, tin, vat_number, email, phone, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Company name is required" });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const companyResult = await client.query(
      `
      INSERT INTO companies (name, tin, vat_number, email, phone, address)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        name,
        tin || null,
        vat_number || null,
        email || null,
        phone || null,
        address || null,
      ]
    );

    const company = companyResult.rows[0];

    await client.query(
      `
      INSERT INTO user_companies (user_id, company_id, role)
      VALUES ($1, $2, $3)
      `,
      [userId, company.id, "admin"]
    );

    await createDefaultCompanySettings(company.id, client);

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Company created successfully",
      company,
    });
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("CREATE COMPANY ERROR:", err.message);
    return res.status(500).json({ error: "Server error" });
  } finally {
    if (client) client.release();
  }
};

// Get companies for logged-in user
exports.getUserCompanies = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT c.*, uc.role
      FROM companies c
      INNER JOIN user_companies uc ON c.id = uc.company_id
      WHERE uc.user_id = $1
      ORDER BY c.id DESC
      `,
      [userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET USER COMPANIES ERROR:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

// Optional: get one company by id
exports.getCompanyById = async (req, res) => {
  const { companyId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM companies
      WHERE id = $1
      `,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("GET COMPANY BY ID ERROR:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getCompanySettings = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.tin,
        cs.default_vat_rate
      FROM companies c
      LEFT JOIN company_settings cs
        ON cs.company_id = c.id
      WHERE c.id = $1
      LIMIT 1
      `,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Company not found",
      });
    }

    const row = result.rows[0];

    return res.json({
      companyId: row.id,
      companyName: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      address: row.address || "",
      tin: row.tin || "",
      defaultVatRate: Number(row.default_vat_rate ?? 10),
    });
  } catch (error) {
    console.error("getCompanySettings error:", error);
    return res.status(500).json({
      error: "Failed to fetch company settings",
      details: error.message,
    });
  }
};

// Update company settings
exports.updateCompanySettings = async (req, res) => {
  let client;

  try {
    const { companyId } = req.params;
    const { companyName, email, phone, address, tin, defaultVatRate } = req.body;

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    if (!companyName || !String(companyName).trim()) {
      return res.status(400).json({
        error: "Company name is required",
      });
    }

    const numericVatRate = Number(defaultVatRate);

    if (Number.isNaN(numericVatRate)) {
      return res.status(400).json({
        error: "Default VAT rate must be a valid number",
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const companyResult = await client.query(
      `
      UPDATE companies
      SET
        name = $1,
        email = $2,
        phone = $3,
        address = $4,
        tin = $5
      WHERE id = $6
      RETURNING *
      `,
      [
        String(companyName || "").trim(),
        String(email || "").trim(),
        String(phone || "").trim(),
        String(address || "").trim(),
        String(tin || "").trim(),
        companyId,
      ]
    );

    if (companyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Company not found",
      });
    }

    const existingSettings = await client.query(
      `
      SELECT id
      FROM company_settings
      WHERE company_id = $1
      LIMIT 1
      `,
      [companyId]
    );

    if (existingSettings.rows.length > 0) {
      await client.query(
        `
        UPDATE company_settings
        SET default_vat_rate = $1
        WHERE company_id = $2
        `,
        [numericVatRate, companyId]
      );
    } else {
      await client.query(
        `
        INSERT INTO company_settings (
          company_id,
          default_vat_rate
        )
        VALUES ($1, $2)
        `,
        [companyId, numericVatRate]
      );
    }

    await client.query("COMMIT");

    return res.json({
      message: "Settings updated successfully",
      settings: {
        companyId: Number(companyId),
        companyName: String(companyName || "").trim(),
        email: String(email || "").trim(),
        phone: String(phone || "").trim(),
        address: String(address || "").trim(),
        tin: String(tin || "").trim(),
        defaultVatRate: numericVatRate,
      },
    });
  } catch (error) {
    try {
      if (client) {
        await client.query("ROLLBACK");
      }
    } catch (rollbackError) {
      console.error("ROLLBACK failed:", rollbackError);
    }

    console.error("updateCompanySettings error:", error);

    return res.status(500).json({
      error: "Failed to update company settings",
      details: error.message,
    });
  } finally {
    if (client) client.release();
  }
};