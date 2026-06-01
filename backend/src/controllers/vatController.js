const pool = require("../config/db");

exports.getVatSummary = async (req, res) => {
  try {
    const { companyId } = req.params;

    const salesResult = await pool.query(
      `
      SELECT
        COUNT(*) AS sales_transactions,
        COALESCE(SUM(total_amount),0) AS total_sales,
        COALESCE(SUM(vat_amount),0) AS output_vat
      FROM vat_transactions
      WHERE company_id = $1
      AND transaction_type = 'SALE'
      `,
      [companyId]
    );

    const purchaseResult = await pool.query(
      `
      SELECT
        COUNT(*) AS purchase_transactions,
        COALESCE(SUM(total_amount),0) AS total_purchases,
        COALESCE(SUM(vat_amount),0) AS input_vat
      FROM vat_transactions
      WHERE company_id = $1
      AND transaction_type = 'PURCHASE'
      `,
      [companyId]
    );

    const sales = salesResult.rows[0];
    const purchases = purchaseResult.rows[0];

    const outputVat =
      Number(sales.output_vat || 0);

    const inputVat =
      Number(purchases.input_vat || 0);

    const vatPayable =
      outputVat - inputVat;

    res.json({
      salesTransactions:
        Number(sales.sales_transactions),

      purchaseTransactions:
        Number(
          purchases.purchase_transactions
        ),

      totalSales:
        Number(sales.total_sales),

      totalPurchases:
        Number(purchases.total_purchases),

      outputVat,

      inputVat,

      vatPayable,
    });

  } catch (error) {

    console.error(
      "VAT SUMMARY ERROR:",
      error
    );

    res.status(500).json({
      error: "Failed to load VAT summary",
    });
  }
};