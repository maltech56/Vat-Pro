const pool = require("../config/db");

exports.getAuditDashboard = async (req, res) => {

  console.log("===== AUDIT CONTROLLER ENTERED =====");
  console.log("USER:", req.user?.id);
  console.log("COMPANY:", req.params.companyId);
  console.log("STEP 1");
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    // 🔹 1. Total documents
    const totalDocsResult = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM company_documents
      WHERE company_id = $1
      `,
      [companyId]
    );

    console.log(
      "STEP 2: totalDocsResult =",
      totalDocsResult.rows
    );

    const totalDocuments = Number(totalDocsResult.rows[0].count || 0);

    // 🔹 2. Unlinked documents
    const unlinkedDocsResult = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM company_documents
      WHERE company_id = $1
        AND transaction_id IS NULL
      `,
      [companyId]
    );

    const unlinkedDocuments = Number(
      unlinkedDocsResult.rows[0].count || 0
    );

    // 🔹 3. Transactions count
    const transactionsResult = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM transactions
      WHERE company_id = $1
      `,
      [companyId]
    );

    const totalTransactions = Number(
      transactionsResult.rows[0].count || 0
    );

    const validTransactions = totalTransactions;

    let transactionCoverage = 0;

    if (totalTransactions > 0) {
      transactionCoverage = Math.round(
        (validTransactions / totalTransactions) * 100
      );
    }

    console.log(
      "STEP 3: totalTransactions =",
      totalTransactions
    );

    // 🔹 4. Transactions WITH documents
    const linkedTransactionsResult = await pool.query(
      `
    SELECT COUNT(DISTINCT t.id) AS count
    FROM transactions t
    JOIN company_documents d
    ON d.transaction_id = t.id
    WHERE t.company_id = $1
    `,
      [companyId]
    );

    const linkedTransactions = Number(
      linkedTransactionsResult.rows[0].count || 0
    );

    console.log(
      "STEP 5: linkedTransactions =",
      linkedTransactions
    );

    // 🔹 5. Missing document count
    const missingDocuments =
      totalTransactions - linkedTransactions;

    // 🔹 6. Audit score calculation
    let auditScore = 0;

    if (totalTransactions > 0) {
      auditScore = Math.round(
        (linkedTransactions / totalTransactions) * 100
      );
    }

    // 🔹 7. Risk level
    let riskLevel = "LOW";

    if (auditScore < 70) riskLevel = "HIGH";
    else if (auditScore < 85) riskLevel = "MEDIUM";

    // 🔹 8. Recent filings (last 5)
    const filingsResult = await pool.query(
      `
      SELECT *
      FROM vat_filings
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT 5
      `,
      [companyId]
    );

    console.log(
      "STEP 6: filings count =",
      filingsResult.rows.length
    );

    console.log("STEP 7: RETURNING RESPONSE");

    console.log({
      totalTransactions,
      validTransactions,
      linkedTransactions,
      totalDocuments,
      missingDocuments,
      unlinkedDocuments,
      auditScore,
      riskLevel,
    });

    // 🔹 9. Response
    return res.json({
      auditScore,
      riskLevel,
      transactionCoverage,
      validTransactions,
      stats: {
        totalTransactions,
        linkedTransactions,
        missingDocuments,
        totalDocuments,
        unlinkedDocuments,
      },
      filings: filingsResult.rows,
    });
  } catch (error) {

    console.log("===== AUDIT ERROR =====");
    console.log(error);
    console.log(error.message);
    console.log(error.stack);

    return res.status(500).json({
      error: "Failed to load audit dashboard",
      details: error.message,
    });
  }
};