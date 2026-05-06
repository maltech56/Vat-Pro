const pool = require("../config/db");

const { logAuditEvent } = require("../utils/auditLogger");
exports.getSettings = async (req, res) => {
  const { companyId } = req.params;
  const userId = req.user?.id || null;
  if (!companyId) {
    return res.status(400).json({ error: "Company ID is required" });
  }

  try {
    const companyResult = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        phone,
        address
      FROM companies
      WHERE id = $1
      `,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const company = companyResult.rows[0];

    const result = await pool.query(`
      SELECT *
        company_id,
        default_vat_rate,
        filing_frequency,
        vat_due_day,
        currency,
        tax_id,
        primary_color,
        logo_url,
        home_screen_title,
        home_screen_subtitle,
        default_home_tab,
        onboarding_complete
      FROM company_settings
      WHERE company_id = $1
    `, [companyId]);

    const settings = result.rows[0] || {};

    return res.json({
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: company.address,
      },
      settings: {
        defaultVatRate: 10,
        filingFrequency: (settings.filing_frequency || "monthly").toLowerCase(),
        vatDueDay: Number(settings.vat_due_day ?? 28),
        currency: settings.currency || "BSD",
        taxId: settings.tax_id || "",
        autoLockSubmittedFilings:
          settings.auto_lock_submitted_filings ?? true,
        requirePeriodConfirmation:
          settings.require_period_confirmation ?? true,
        updatedAt: settings.updated_at || null,

        // 🔥 ADD THESE (THIS IS WHAT YOUR DASHBOARD NEEDS)
        primaryColor: settings.primary_color || "#0F3D91",
        logoUrl: settings.logo_url || "",
        homeScreenTitle: settings.home_screen_title || "",
        homeScreenSubtitle: settings.home_screen_subtitle || "",
        defaultHomeTab: settings.default_home_tab || "dashboard",
        onboardingComplete: settings.onboarding_complete ?? false,
      }
    });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
};

exports.updateSettings = async (req, res) => {
  const { companyId } = req.params;
  const userId = req.user?.id || null;
  const {
    name,
    email,
    phone,
    address,
    filingFrequency,
    vatDueDay,
    currency,
    taxId,
    autoLockSubmittedFilings,
    requirePeriodConfirmation,

    // 🔥 ADD THESE
    logoUrl,
    homeScreenTitle,
    homeScreenSubtitle,
    primaryColor,
    defaultHomeTab,
    onboardingComplete,
  } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: "Company ID is required" });
  }

  const allowedFrequencies = ["monthly", "quarterly"];
  const normalizedFilingFrequency = (filingFrequency || "monthly").toLowerCase();
  const normalizedVatDueDay = Number(vatDueDay ?? 28);
  const normalizedVatRate = 10;


  if (!allowedFrequencies.includes(normalizedFilingFrequency)) {
    return res.status(400).json({
      error: "filingFrequency must be either 'monthly' or 'quarterly'",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyCheck = await client.query(
      `SELECT id FROM companies WHERE id = $1`,
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Company not found" });
    }

    await client.query(
      `
      UPDATE companies
      SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address)
      WHERE id = $5
      `,
      [name, email, phone, address, companyId]
    );

    const previousSettingsResult = await client.query(
      `
      SELECT
        default_vat_rate,
        filing_frequency,
        vat_due_day,
        currency,
        tax_id,
        auto_lock_submitted_filings,
        require_period_confirmation
      FROM company_settings
      WHERE company_id = $1
      `,
      [companyId]
    );

    const previousSettings = previousSettingsResult.rows[0] || null;

    await logAuditEvent({
      companyId,
      userId,
      action: "SETTINGS_UPDATE",
      entityType: "settings",
      entityId: String(companyId),
      oldValue: previousSettings
        ? {
          defaultVatRate: Number(previousSettings.default_vat_rate ?? 10),
          filingFrequency: previousSettings.filing_frequency || "monthly",
          vatDueDay: Number(previousSettings.vat_due_day ?? 28),
          currency: previousSettings.currency || "BSD",
          taxId: previousSettings.tax_id || "",
          autoLockSubmittedFilings:
            previousSettings.auto_lock_submitted_filings ?? true,
          requirePeriodConfirmation:
            previousSettings.require_period_confirmation ?? true,
        }
        : null,
      newValue: {
        defaultVatRate: 10,
        filingFrequency: normalizedFilingFrequency,
        vatDueDay: normalizedVatDueDay,
        currency: currency || "BSD",
        taxId: taxId || "",
        autoLockSubmittedFilings: autoLockSubmittedFilings ?? true,
        requirePeriodConfirmation: requirePeriodConfirmation ?? true,
      },
      status: "success",
      message: "Settings updated with VAT fixed at 10% for compliance.",
    });

    await client.query(
      `
  INSERT INTO company_settings (
    company_id,
    default_vat_rate,
    filing_frequency,
    vat_due_day,
    currency,
    tax_id,
    auto_lock_submitted_filings,
    require_period_confirmation,
    onboarding_complete,
    logo_url,
    home_screen_title,
    home_screen_subtitle,
    primary_color,
    default_home_tab,
    updated_at
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
  ON CONFLICT (company_id)
  DO UPDATE SET
    default_vat_rate = 10,
    filing_frequency = EXCLUDED.filing_frequency,
    vat_due_day = EXCLUDED.vat_due_day,
    currency = EXCLUDED.currency,
    tax_id = EXCLUDED.tax_id,
    auto_lock_submitted_filings = EXCLUDED.auto_lock_submitted_filings,
    require_period_confirmation = EXCLUDED.require_period_confirmation,
    onboarding_complete = EXCLUDED.onboarding_complete,
    logo_url = EXCLUDED.logo_url,
    home_screen_title = EXCLUDED.home_screen_title,
    home_screen_subtitle = EXCLUDED.home_screen_subtitle,
    primary_color = EXCLUDED.primary_color,
    default_home_tab = EXCLUDED.default_home_tab,
    updated_at = NOW()
  `,
      [
        companyId,
        normalizedVatRate,
        normalizedFilingFrequency,
        normalizedVatDueDay,
        currency || "BSD",
        taxId || "",
        autoLockSubmittedFilings ?? true,
        requirePeriodConfirmation ?? true,
        onboardingComplete ?? false,
        logoUrl || "",
        homeScreenTitle || "",
        homeScreenSubtitle || "",
        primaryColor || "#0F3D91",
        defaultHomeTab || "dashboard",
      ]
    );

    await client.query("COMMIT");

    const updatedCompanyResult = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.tin,
        cs.default_vat_rate,
        cs.filing_frequency,
        cs.currency,
        cs.vat_due_day,
        cs.onboarding_complete,
        cs.logo_url,
        cs.home_screen_title,
        cs.home_screen_subtitle,
        cs.primary_color,
        cs.default_home_tab
      FROM companies c
      LEFT JOIN company_settings cs ON cs.company_id = c.id
      WHERE c.id = $1
      `,
      [companyId]
    );

    const updatedSettingsResult = await pool.query(
      `
      SELECT
        company_id,
        default_vat_rate,
        filing_frequency,
        vat_due_day,
        currency,
        tax_id,
        auto_lock_submitted_filings,
        require_period_confirmation,
        onboarding_complete,
        logo_url,
        home_screen_title,
        home_screen_subtitle,
        primary_color,
        default_home_tab,
        updated_at
      FROM company_settings
      WHERE company_id = $1
      `,
          [companyId]
    );

    const company = updatedCompanyResult.rows[0];
    const settings = updatedSettingsResult.rows[0] || {};

    return res.json({
      message: "Settings updated successfully",
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: company.address,
      },
      settings: {
        defaultVatRate: 10,
        filingFrequency: (settings.filing_frequency || "monthly").toLowerCase(),
        vatDueDay: Number(settings.vat_due_day ?? 28),
        currency: settings.currency || "BSD",
        taxId: settings.tax_id || "",
        autoLockSubmittedFilings:
          settings.auto_lock_submitted_filings ?? true,
        requirePeriodConfirmation:
          settings.require_period_confirmation ?? true,
        updatedAt: settings.updated_at || null,

        onboardingComplete: settings.onboarding_complete ?? false,
        logoUrl: settings.logo_url || "",
        homeScreenTitle: settings.home_screen_title || "",
        homeScreenSubtitle: settings.home_screen_subtitle || "",
        primaryColor: settings.primary_color || "#0F3D91",
        defaultHomeTab: settings.default_home_tab || "dashboard",

      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating company settings:", error);
    return res.status(500).json({ error: "Failed to update settings" });
  } finally {
    client.release();
  }
};