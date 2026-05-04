const pool = require("../config/db");

// Dashboard overview
exports.getOverview = async (req, res) => {
  const { companyId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(CASE WHEN type = 'sale' THEN vat_amount ELSE 0 END), 0) AS output_vat,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN vat_amount ELSE 0 END), 0) AS input_vat
      FROM transactions
      WHERE company_id = $1
      `,
      [companyId]
    );

    const row = result.rows[0];

    const totalSales = Number(row.total_sales || 0);
    const totalExpenses = Number(row.total_expenses || 0);
    const transactionCount = Number(row.transaction_count || 0);
    const outputVAT = Number(row.output_vat || 0);
    const inputVAT = Number(row.input_vat || 0);
    const netVATPayable = outputVAT - inputVAT;

    res.json({
      totalSales,
      totalExpenses,
      transactionCount,
      outputVAT,
      inputVAT,
      netVATPayable,
    });
  } catch (error) {
    console.error("Overview error:", error);
    res.status(500).json({ error: "Failed to load overview" });
  }
};


// Monthly VAT summary
exports.getMonthlyVAT = async (req, res) => {
  const { companyId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         TO_CHAR(transaction_date, 'YYYY-MM') AS month,
         COALESCE(SUM(CASE WHEN type = 'sale' AND vat_classification = 'taxable' THEN vat_amount ELSE 0 END), 0) AS output_vat,
         COALESCE(SUM(CASE WHEN type = 'expense' AND vat_classification = 'taxable' THEN vat_amount ELSE 0 END), 0) AS input_vat
       FROM transactions
       WHERE company_id = $1
       GROUP BY TO_CHAR(transaction_date, 'YYYY-MM')
       ORDER BY month`,
      [companyId]
    );

    const data = result.rows.map((row) => ({
      month: row.month,
      outputVAT: Number(row.output_vat),
      inputVAT: Number(row.input_vat),
      netVATPayable: Number(row.output_vat) - Number(row.input_vat)
    }));

    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// VAT classification breakdown
exports.getClassificationBreakdown = async (req, res) => {
  const { companyId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN vat_classification = 'taxable' AND type = 'sale' THEN amount ELSE 0 END), 0) AS taxable_sales,
         COALESCE(SUM(CASE WHEN vat_classification = 'zero_rated' AND type = 'sale' THEN amount ELSE 0 END), 0) AS zero_rated_sales,
         COALESCE(SUM(CASE WHEN vat_classification = 'exempt' AND type = 'sale' THEN amount ELSE 0 END), 0) AS exempt_sales
       FROM transactions
       WHERE company_id = $1`,
      [companyId]
    );

    res.json({
      taxableSales: Number(result.rows[0].taxable_sales),
      zeroRatedSales: Number(result.rows[0].zero_rated_sales),
      exemptSales: Number(result.rows[0].exempt_sales)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};