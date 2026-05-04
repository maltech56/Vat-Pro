const pool = require("../config/db");

const createDefaultCompanySettings = async (companyId, client = pool) => {
  try {
    await client.query(
      `
      INSERT INTO company_settings (
        company_id,
        default_vat_rate,
        filing_frequency,
        currency,
        tax_year_start,
        date_format,
        rows_per_page,
        default_report_tab
      )
      VALUES ($1, 10, 'Monthly', 'BSD', 'January', 'YYYY-MM-DD', 10, 'Summary')
      ON CONFLICT (company_id) DO NOTHING
      `,
      [companyId]
    );

    console.log("✅ Default settings created for company:", companyId);
  } catch (error) {
    console.error("❌ Error creating default company settings:", error);
    throw error;
  }
};

module.exports = createDefaultCompanySettings;