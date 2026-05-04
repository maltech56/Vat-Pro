// ✅ CORRECT
const db = require("../config/db");

const seedDemoData = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    await client.query("BEGIN");

    // Prevent duplicate demo setup
    const existing = await client.query(
      `
      SELECT c.id
      FROM companies c
      JOIN user_companies uc ON uc.company_id = c.id
      WHERE uc.user_id = $1
      AND c.name = 'Demo Company Ltd.'
      LIMIT 1
      `,
      [userId]
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");

      return res.json({
        message: "Demo data already exists",
        companyId: existing.rows[0].id,
      });
    }

    // Create demo company
    const companyResult = await client.query(
      `
      INSERT INTO companies (name, tin, vat_number, email, phone, address)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name
      `,
      [
        "Demo Company Ltd.",
        "100000001",
        "VAT-100000001",
        "demo@maltechdigital.com",
        "242-000-0000",
        "Nassau, Bahamas",
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

    // Insert sample transactions
    const transactions = [
      ["sale", "taxable", "Retail sales invoice - January", 2500, 250, "2026-04-03"],
      ["sale", "taxable", "Consulting services invoice", 1800, 180, "2026-04-08"],
      ["sale", "zero_rated", "Zero-rated export service", 1200, 0, "2026-04-12"],
      ["purchase", "taxable", "Office supplies receipt", 400, 40, "2026-04-15"],
      ["purchase", "taxable", "Software subscription", 300, 30, "2026-04-18"],
      ["purchase", "exempt", "Bank fees", 75, 0, "2026-04-20"],
    ];

    for (const tx of transactions) {
      await client.query(
        `
        INSERT INTO transactions
        (company_id, type, category, description, amount, vat_amount, vat_rate, transaction_date, vat_classification)
        VALUES ($1, $2, $2, $3, $4, $5, 0.10, $6, $7)
        `,
        [company.id, tx[0], tx[2], tx[3], tx[4], tx[5], tx[1]]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Demo data created",
      company,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("seedDemoData error:", error);

    res.status(500).json({
      error: "Failed to seed demo data",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  seedDemoData,
};