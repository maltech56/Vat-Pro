const pool = require("../config/db");
const createDefaultCompanySettings = require("../utils/createDefaultCompanySettings");

// Create company
exports.createCompany = async (req, res) => {
  const userId = req.user.id;
  const { name, tin, bin, vat_number, email, phone, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Company name is required" });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const companyResult = await client.query(
      `
      INSERT INTO companies (
  name,
  tin,
  bin,
  vat_number,
  email,
  phone,
  address
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
      `,
      [
        name,
        tin || null,
        bin || null,
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
      c.bin,
      c.vat_number,

      cs.tax_id,
      cs.vat_registration_number,

      cs.default_vat_rate,
      cs.filing_frequency,
      cs.currency,
      cs.tax_year_start,
      cs.fiscal_year_start,
      cs.vat_due_day,

      cs.date_format,
      cs.rows_per_page,
      cs.default_report_tab,

      cs.logo_url,
      cs.default_home_tab,
      cs.brand_primary_color,
      cs.brand_secondary_color,
      cs.primary_color,

      cs.home_screen_title,
      cs.home_screen_subtitle,

      cs.auto_lock_submitted_filings,
      cs.require_period_confirmation,
      cs.onboarding_complete

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
      company: {
        id: row.id,
        name: row.name || "",
        email: row.email || "",
        phone: row.phone || "",
        address: row.address || "",
        tin: row.tin || "",
        bin: row.bin || "",
        vatNumber: row.vat_number || "",
      },

      settings: {
        taxId: row.tax_id || "",
        vatNumber: row.vat_registration_number || "",

        defaultVatRate: Number(row.default_vat_rate ?? 10),

        filingFrequency: row.filing_frequency || "Monthly",

        currency: row.currency || "BSD",

        taxYearStart: row.tax_year_start || "January",

        vatDueDay: row.vat_due_day ?? 28,

        dateFormat: row.date_format || "YYYY-MM-DD",

        rowsPerPage: row.rows_per_page ?? 10,

        defaultReportTab: row.default_report_tab || "Summary",

        logoUrl: row.logo_url || "",

        homeScreenTitle: row.home_screen_title || "",

        homeScreenSubtitle: row.home_screen_subtitle || "",

        primaryColor: row.primary_color || "#0F3D91",

        defaultHomeTab: row.default_home_tab || "dashboard",

        autoLockSubmittedFilings:
          row.auto_lock_submitted_filings ?? false,

        requirePeriodConfirmation:
          row.require_period_confirmation ?? false,

        onboardingComplete:
          row.onboarding_complete ?? false,
      },
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
    const {
      companyName,
      email,
      phone,
      address,
      tin,
      bin,
      defaultVatRate,
    } = req.body;

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
        tin = $5,
        bin = $6
      WHERE id = $7
      RETURNING *
      `,
      [
        String(companyName || "").trim(),
        String(email || "").trim(),
        String(phone || "").trim(),
        String(address || "").trim(),
        String(tin || "").trim(),
        String(bin || "").trim(),
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
        bin: String(bin || "").trim(),
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