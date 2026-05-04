const pool = require("../config/db");

const getPagination = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

exports.getSummaryReport = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
        COALESCE(SUM(CASE WHEN type = 'sale' THEN vat_amount ELSE 0 END), 0) AS output_vat,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN vat_amount ELSE 0 END), 0) AS input_vat,
        COUNT(*) AS transaction_count
      FROM transactions
      WHERE company_id = $1
    `;

    const values = [companyId];
    let index = 2;

    if (startDate) {
      query += ` AND transaction_date >= $${index}`;
      values.push(startDate);
      index++;
    }

    if (endDate) {
      query += ` AND transaction_date <= $${index}`;
      values.push(endDate);
      index++;
    }

    const result = await pool.query(query, values);
    const row = result.rows[0];

    const totalSales = Number(row.total_sales || 0);
    const totalExpenses = Number(row.total_expenses || 0);
    const outputVAT = Number(row.output_vat || 0);
    const inputVAT = Number(row.input_vat || 0);
    const netVATPayable = outputVAT - inputVAT;

    res.json({
      totalSales,
      totalExpenses,
      outputVAT,
      inputVAT,
      netVATPayable,
      transactionCount: Number(row.transaction_count || 0),
    });
  } catch (error) {
    console.error("getSummaryReport error:", error);
    res.status(500).json({ error: "Failed to load summary report" });
  }
};

exports.getSalesReport = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate, vat_classification, search } = req.query;
  const { page, limit, offset } = getPagination(req);

  try {
    let baseQuery = `
      FROM transactions
      WHERE company_id = $1
      AND type = 'sale'
    `;

    const values = [companyId];
    let index = 2;

    if (startDate) {
      baseQuery += ` AND transaction_date >= $${index}`;
      values.push(startDate);
      index++;
    }

    if (endDate) {
      baseQuery += ` AND transaction_date <= $${index}`;
      values.push(endDate);
      index++;
    }

    if (vat_classification && vat_classification !== "all") {
      baseQuery += ` AND vat_classification = $${index}`;
      values.push(vat_classification);
      index++;
    }

    if (search && search.trim()) {
      baseQuery += ` AND description ILIKE $${index}`;
      values.push(`%${search.trim()}%`);
      index++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      values
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const dataQuery = `
    SELECT id, type, amount, vat_amount, vat_classification, transaction_date, description, created_at
    ${baseQuery}
    ORDER BY transaction_date DESC, id DESC
    LIMIT $${index} OFFSET $${index + 1}
    `;
    
    const dataResult = await pool.query(dataQuery, [
      ...values,
      limit,
      offset,
    ]);

    res.json({
      rows: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    console.error("getSalesReport error:", error);
    res.status(500).json({ error: "Failed to load sales report" });
  }
};

exports.getPurchasesReport = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate, vat_classification, search } = req.query;
  const { page, limit, offset } = getPagination(req);

  try {
    let baseQuery = `
      FROM transactions
      WHERE company_id = $1
      AND type = 'expense'
    `;

    const values = [companyId];
    let index = 2;

    if (startDate) {
      baseQuery += ` AND transaction_date >= $${index}`;
      values.push(startDate);
      index++;
    }

    if (endDate) {
      baseQuery += ` AND transaction_date <= $${index}`;
      values.push(endDate);
      index++;
    }

    if (vat_classification && vat_classification !== "all") {
      baseQuery += ` AND vat_classification = $${index}`;
      values.push(vat_classification);
      index++;
    }

    if (search && search.trim()) {
      baseQuery += ` AND description ILIKE $${index}`;
      values.push(`%${search.trim()}%`);
      index++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      values
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const dataQuery = `
      SELECT id, type, amount, vat_amount, vat_classification, transaction_date, description, created_at
      ${baseQuery}
      ORDER BY transaction_date DESC, id DESC
      LIMIT $${index} OFFSET $${index + 1}
    `;

    const dataResult = await pool.query(dataQuery, [
      ...values,
      limit,
      offset,
    ]);

    res.json({
      rows: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    console.error("getPurchasesReport error:", error);
    res.status(500).json({ error: "Failed to load purchases report" });
  }
};

exports.getTransactionsReport = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate, type, vat_classification, search } = req.query;
  const { page, limit, offset } = getPagination(req);

  try {
    let baseQuery = `
      FROM transactions
      WHERE company_id = $1
    `;

    const values = [companyId];
    let index = 2;

    if (startDate) {
      baseQuery += ` AND transaction_date >= $${index}`;
      values.push(startDate);
      index++;
    }

    if (endDate) {
      baseQuery += ` AND transaction_date <= $${index}`;
      values.push(endDate);
      index++;
    }

    if (type && type !== "all") {
      baseQuery += ` AND type = $${index}`;
      values.push(type);
      index++;
    }

    if (vat_classification && vat_classification !== "all") {
      baseQuery += ` AND vat_classification = $${index}`;
      values.push(vat_classification);
      index++;
    }

    if (search && search.trim()) {
      baseQuery += ` AND description ILIKE $${index}`;
      values.push(`%${search.trim()}%`);
      index++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      values
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const dataQuery = `
      SELECT id, type, amount, vat_amount, vat_classification, transaction_date, description, created_at
      ${baseQuery}
      ORDER BY transaction_date DESC, id DESC
      LIMIT $${index} OFFSET $${index + 1}
    `;

    const dataResult = await pool.query(dataQuery, [
      ...values,
      limit,
      offset,
    ]);

    res.json({
      rows: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    console.error("getTransactionsReport error:", error);
    res.status(500).json({ error: "Failed to load transaction report" });
  }
};

exports.exportTransactionsCsv = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate, type, vat_classification, search } = req.query;

  try {
    console.log("CSV export route hit");

    let query = `
      SELECT id, type, amount, vat_amount, vat_classification, transaction_date, description, created_at
      FROM transactions
      WHERE company_id = $1
    `;

    const values = [companyId];
    let index = 2;

    if (startDate) {
      query += ` AND transaction_date >= $${index}`;
      values.push(startDate);
      index++;
    }

    if (endDate) {
      query += ` AND transaction_date <= $${index}`;
      values.push(endDate);
      index++;
    }

    if (type && type !== "all") {
      query += ` AND type = $${index}`;
      values.push(type);
      index++;
    }

    if (vat_classification && vat_classification !== "all") {
      query += ` AND vat_classification = $${index}`;
      values.push(vat_classification);
      index++;
    }

    if (search && search.trim()) {
      query += ` AND description ILIKE $${index}`;
      values.push(`%${search.trim()}%`);
      index++;
    }

    query += ` ORDER BY transaction_date DESC, id DESC`;

    const result = await pool.query(query, values);
    console.log("CSV query rows:", result.rows);

    const headers = [
      "id",
      "type",
      "amount",
      "vat_amount",
      "vat_classification",
      "transaction_date",
      "description",
      "created_at",
    ];

    const rows = result.rows.map((row) => [
      row.id ?? "",
      row.type ?? "",
      row.amount ?? "",
      row.vat_amount ?? "",
      row.vat_classification ?? "",
      row.transaction_date ?? "",
      `"${String(row.description ?? "").replace(/"/g, '""')}"`,
      row.created_at ?? "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-company-${companyId}.csv"`
    );

    res.send(csv);
  } catch (error) {
    console.error("exportTransactionsCsv error:", error.message);
    console.error("exportTransactionsCsv full error:", error);
    res.status(500).json({ error: "Failed to export CSV report" });
  }
};