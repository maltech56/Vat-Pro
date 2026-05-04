const { logAuditEvent } = require("../utils/auditLogger");
const PDFDocument = require("pdfkit");
const pool = require("../config/db");
const { calculateVAT, FIXED_VAT_RATE } = require("../utils/vatCalculator");

const VALID_CLASSIFICATIONS = ["taxable", "zero_rated", "exempt"];

function normalizeClassification(value) {
  return String(value || "").trim().toLowerCase();
}

exports.createTransaction = async (req, res) => {
  console.log("REQ.USER:", req.user);
  console.log("REQ.BODY:", req.body);
  console.log("PDF ROUTE HIT");

  const userId = req.user?.id;
  const {
    companyId,
    type,
    amountExVat,
    classification,
    transactionDate,
    description,
  } = req.body;

  if (
    Object.prototype.hasOwnProperty.call(req.body, "vatRate") ||
    Object.prototype.hasOwnProperty.call(req.body, "vatAmount")
  ) {
    await logAuditEvent({
      companyId,
      userId,
      action: "TRANSACTION_VAT_OVERRIDE_ATTEMPT",
      entityType: "transaction",
      entityId: null,
      oldValue: { fixedVatRate: 10 },
      newValue: {
        requestedVatRate: req.body.vatRate,
        requestedVatAmount: req.body.vatAmount,
      },
      status: "blocked",
      message: "Transaction VAT override attempt blocked. VAT is calculated server-side at fixed 10%.",
    });
  }
  try {
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: missing user" });
    }

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const accessCheck = await pool.query(
      `
      SELECT 1
      FROM user_companies
      WHERE user_id = $1 AND company_id = $2
      `,
      [userId, companyId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ message: "Unauthorized company access" });
    }

    const cleanClassification = normalizeClassification(classification);
    const numericAmount = parseFloat(amountExVat);

    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ message: "Invalid amountExVat" });
    }

    if (!VALID_CLASSIFICATIONS.includes(cleanClassification)) {
      return res.status(400).json({ message: "Invalid classification" });
    }

    const vatData = calculateVAT(numericAmount, cleanClassification);

    const amountFinal = vatData.amountExVat;
    const vatAmount = vatData.vatAmount;
    const vatRate = vatData.vatRate;

    const result = await pool.query(
      `
      INSERT INTO transactions
      (
        company_id,
        type,
        category,
        description,
        amount,
        vat_amount,
        vat_rate,
        transaction_date,
        vat_classification
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        companyId,
        type,
        type,
        description,
        amountFinal,
        vatAmount,
        vatRate,
        transactionDate,
        cleanClassification,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create transaction error:", error);
    return res.status(500).json({
      message: "Server error creating transaction",
      detail: error.message,
    });
  }
};

exports.getRecentTransactions = async (req, res) => {
  try {
    const { companyId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM transactions
      WHERE company_id = $1
      ORDER BY transaction_date DESC, id DESC
      LIMIT 10
      `,
      [companyId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("getRecentTransactions error:", error);
    return res.status(500).json({
      error: "Failed to fetch recent transactions",
    });
  }
};

// Get all transactions for a company
exports.getCompanyTransactions = async (req, res) => {
  const { companyId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        company_id,
        type,
        category,
        description,
        amount,
        vat_amount,
        vat_rate,
        transaction_date,
        vat_classification,
        created_at
      FROM transactions
      WHERE company_id = $1
      ORDER BY transaction_date DESC, id DESC
      `,
      [companyId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("getCompanyTransactions error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

// Get VAT summary for a company and date range
exports.getVatSummary = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate } = req.query;
  const userId = req.user?.id;

  try {
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "startDate and endDate are required",
      });
    }

    const accessCheck = await pool.query(
      `
      SELECT 1
      FROM user_companies
      WHERE user_id = $1 AND company_id = $2
      `,
      [userId, companyId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ message: "Unauthorized company access" });
    }

    const result = await pool.query(
      `
      SELECT
        COALESCE(SUM(
          CASE
            WHEN type = 'sale' AND vat_classification = 'taxable' THEN amount
            ELSE 0
          END
        ), 0) AS taxable_sales,

        COALESCE(SUM(
          CASE
            WHEN type = 'sale' AND vat_classification = 'zero_rated' THEN amount
            ELSE 0
          END
        ), 0) AS zero_rated_sales,

        COALESCE(SUM(
          CASE
            WHEN type = 'sale' AND vat_classification = 'exempt' THEN amount
            ELSE 0
          END
        ), 0) AS exempt_sales,

        COALESCE(SUM(
          CASE
            WHEN type = 'sale' AND vat_classification = 'taxable' THEN vat_amount
            ELSE 0
          END
        ), 0) AS output_vat,

        COALESCE(SUM(
          CASE
            WHEN type IN ('purchase', 'expense') AND vat_classification = 'taxable' THEN vat_amount
            ELSE 0
          END
        ), 0) AS input_vat
      FROM transactions
      WHERE company_id = $1
        AND transaction_date >= $2
        AND transaction_date <= $3
      `,
      [companyId, startDate, endDate]
    );

    const row = result.rows[0];

    const taxableSales = Number(row.taxable_sales || 0);
    const zeroRatedSales = Number(row.zero_rated_sales || 0);
    const exemptSales = Number(row.exempt_sales || 0);
    const outputVAT = Number(row.output_vat || 0);
    const inputVAT = Number(row.input_vat || 0);
    const netVATPayable = outputVAT - inputVAT;

    return res.json({
      companyId: Number(companyId),
      startDate,
      endDate,
      taxableSales,
      zeroRatedSales,
      exemptSales,
      outputVAT,
      inputVAT,
      netVATPayable,
    });
  } catch (error) {
    console.error("Error fetching VAT summary:", error);
    return res.status(500).json({
      error: "Failed to fetch VAT summary",
    });
  }
};

exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const {
    type,
    amountExVat,
    classification,
    transactionDate,
    description,
  } = req.body;

  try {
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: missing user" });
    }

    const txCheck = await pool.query(
      `
      SELECT t.id, t.company_id
      FROM transactions t
      JOIN user_companies uc ON uc.company_id = t.company_id
      WHERE t.id = $1 AND uc.user_id = $2
      `,
      [id, userId]
    );

    if (txCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Transaction not found or access denied" });
    }

    const cleanClassification = normalizeClassification(classification);
    const numericAmount = parseFloat(amountExVat);

    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ message: "Invalid amountExVat" });
    }

    if (!VALID_CLASSIFICATIONS.includes(cleanClassification)) {
      return res.status(400).json({ message: "Invalid classification" });
    }

    const vatData = calculateVAT(numericAmount, cleanClassification);

    const amountFinal = vatData.amountExVat;
    const vatAmount = vatData.vatAmount;
    const vatRate = vatData.vatRate;

    const result = await pool.query(
      `
      UPDATE transactions
      SET
        type = $1,
        category = $2,
        description = $3,
        amount = $4,
        vat_amount = $5,
        vat_rate = $6,
        transaction_date = $7,
        vat_classification = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        type,
        type,
        description,
        amountFinal,
        vatAmount,
        vatRate,
        transactionDate,
        cleanClassification,
        id,
      ]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("updateTransaction error:", error.message);
    return res.status(500).json({ error: "Server error" });
  }
};

// Delete a transaction
exports.deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: missing user" });
    }

    const txCheck = await pool.query(
      `
      SELECT t.id, t.company_id
      FROM transactions t
      JOIN user_companies uc ON uc.company_id = t.company_id
      WHERE t.id = $1 AND uc.user_id = $2
      `,
      [id, userId]
    );

    if (txCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Transaction not found or access denied" });
    }

    await pool.query(`DELETE FROM transactions WHERE id = $1`, [id]);

    return res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("deleteTransaction error:", error.message);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.generateVatReturnPdf = async (req, res) => {
  console.log("PDF QUERY PARAMS:", req.query);

  const { companyId } = req.params;
  const {
    startDate,
    endDate,
    tin,
    filingPeriodLabel,
    authorizedOfficer,
    positionTitle,
  } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: "startDate and endDate are required for VAT PDF",
    });
  }

  const userId = req.user?.id;

  const formatMoney = (value) =>
    new Intl.NumberFormat("en-BS", {
      style: "currency",
      currency: "BSD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toISOString().slice(0, 10);
  };

  const safeText = (value) => String(value ?? "").trim();

  const drawLabelValueRow = (doc, label, value, options = {}) => {
    const {
      x = 60,
      y = doc.y,
      labelWidth = 180,
      valueWidth = 280,
      lineGap = 18,
      boldValue = false,
    } = options;

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(label, x, y, { width: labelWidth });

    doc
      .font(boldValue ? "Helvetica-Bold" : "Helvetica")
      .fontSize(11)
      .text(value, x + labelWidth, y, { width: valueWidth, align: "right" });

    doc.y = y + lineGap;
  };

  const drawSectionTitle = (doc, title) => {
    doc.moveDown(0.8);
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#0f172a")
      .text(title, { underline: false });
    doc.moveDown(0.3);
  };

  const drawDivider = (doc, color = "#cbd5e1") => {
    const y = doc.y;
    doc
      .strokeColor(color)
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(545, y)
      .stroke();
    doc.moveDown(0.5);
  };

  const drawSummaryBox = (doc, values) => {
    const boxX = 50;
    const boxY = doc.y;
    const boxWidth = 495;
    const rowHeight = 24;
    const rows = 6;
    const boxHeight = 24 + rows * rowHeight + 16;

    doc
      .roundedRect(boxX, boxY, boxWidth, boxHeight, 8)
      .fillAndStroke("#f8fafc", "#cbd5e1");

    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("VAT Summary", boxX + 16, boxY + 12);

    let y = boxY + 38;

    drawLabelValueRow(doc, "Taxable Sales", formatMoney(values.taxableSales), {
      x: boxX + 16,
      y,
      labelWidth: 220,
      valueWidth: 220,
    });
    y += rowHeight;

    drawLabelValueRow(doc, "Zero-Rated Sales", formatMoney(values.zeroRatedSales), {
      x: boxX + 16,
      y,
      labelWidth: 220,
      valueWidth: 220,
    });
    y += rowHeight;

    drawLabelValueRow(doc, "Exempt Sales", formatMoney(values.exemptSales), {
      x: boxX + 16,
      y,
      labelWidth: 220,
      valueWidth: 220,
    });
    y += rowHeight;

    doc
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .moveTo(boxX + 16, y - 4)
      .lineTo(boxX + boxWidth - 16, y - 4)
      .stroke();

    drawLabelValueRow(doc, "Output VAT", formatMoney(values.outputVat), {
      x: boxX + 16,
      y,
      labelWidth: 220,
      valueWidth: 220,
    });
    y += rowHeight;

    drawLabelValueRow(doc, "Input VAT", formatMoney(values.inputVat), {
      x: boxX + 16,
      y,
      labelWidth: 220,
      valueWidth: 220,
    });
    y += rowHeight;

    drawLabelValueRow(doc, "Net VAT Payable", formatMoney(values.netVat), {
      x: boxX + 16,
      y,
      labelWidth: 220,
      valueWidth: 220,
      boldValue: true,
    });

    doc.y = boxY + boxHeight + 10;
  };

  const drawTransactionsTableHeader = (doc, startY) => {
    doc
      .roundedRect(50, startY, 495, 24, 4)
      .fillAndStroke("#e2e8f0", "#cbd5e1");

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10);
    doc.text("Date", 58, startY + 7, { width: 70 });
    doc.text("Type", 130, startY + 7, { width: 55 });
    doc.text("Class", 188, startY + 7, { width: 75 });
    doc.text("Amount", 268, startY + 7, { width: 80, align: "right" });
    doc.text("VAT", 352, startY + 7, { width: 70, align: "right" });
    doc.text("Description", 430, startY + 7, { width: 105 });

    doc.y = startY + 30;
  };

  const drawTransactionRow = (doc, row, index) => {
    const rowY = doc.y;
    const rowHeight = 22;

    if (index % 2 === 0) {
      doc
        .roundedRect(50, rowY - 2, 495, rowHeight, 2)
        .fillColor("#f8fafc")
        .fill();
    }

    doc.fillColor("#111827").font("Helvetica").fontSize(9.5);

    doc.text(formatDate(row.transaction_date), 58, rowY + 4, { width: 70 });
    doc.text(safeText(row.type || "-"), 130, rowY + 4, { width: 55 });
    doc.text(safeText(row.vat_classification || "-"), 188, rowY + 4, {
      width: 75,
    });
    doc.text(formatMoney(row.amount), 268, rowY + 4, {
      width: 80,
      align: "right",
    });
    doc.text(formatMoney(row.vat_amount), 352, rowY + 4, {
      width: 70,
      align: "right",
    });
    doc.text(safeText(row.description || "-"), 430, rowY + 4, {
      width: 105,
      ellipsis: true,
    });

    doc.y = rowY + rowHeight;
  };

  const ensureTableSpace = (doc, neededHeight = 40) => {
    if (doc.y + neededHeight > 740) {
      doc.addPage();
      drawTransactionsTableHeader(doc, 50);
    }
  };

  try {
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const companyAccess = await pool.query(
      `
      SELECT c.id, c.name, c.tin
      FROM companies c
      JOIN user_companies uc ON uc.company_id = c.id
      WHERE c.id = $1 AND uc.user_id = $2
      `,
      [companyId, userId]
    );

    if (companyAccess.rows.length === 0) {
      return res.status(403).json({ message: "Unauthorized company access" });
    }

    const company = companyAccess.rows[0];
    const companyName = company.name || `Company ${companyId}`;

    const resolvedTin = tin || company.tin || "Not provided";
    const resolvedFilingPeriodLabel =
      filingPeriodLabel || `${startDate} to ${endDate}`;
    const resolvedAuthorizedOfficer = authorizedOfficer || "________________";
    const resolvedPositionTitle = positionTitle || "________________";

    const params = [companyId];
    let whereClause = `WHERE company_id = $1`;

    params.push(startDate);
    whereClause += ` AND transaction_date >= $${params.length}`;

    params.push(endDate);
    whereClause += ` AND transaction_date <= $${params.length}`;

    console.log("SQL WHERE:", whereClause);
    console.log("SQL PARAMS:", params);

    const summaryResult = await pool.query(
      `
      SELECT
        COALESCE(SUM(CASE
          WHEN type = 'sale' AND vat_classification = 'taxable' THEN amount
          ELSE 0
        END), 0) AS taxable_sales,
        COALESCE(SUM(CASE
          WHEN type = 'sale' AND vat_classification = 'zero_rated' THEN amount
          ELSE 0
        END), 0) AS zero_rated_sales,
        COALESCE(SUM(CASE
          WHEN type = 'sale' AND vat_classification = 'exempt' THEN amount
          ELSE 0
        END), 0) AS exempt_sales,
        COALESCE(SUM(CASE
          WHEN type = 'sale' AND vat_classification = 'taxable' THEN vat_amount
          ELSE 0
        END), 0) AS output_vat,
        COALESCE(SUM(CASE
          WHEN type IN ('purchase', 'expense') AND vat_classification = 'taxable' THEN vat_amount
          ELSE 0
        END), 0) AS input_vat
      FROM transactions
      ${whereClause}
      `,
      params
    );

    console.log("SUMMARY RESULT:", summaryResult.rows);

    const transactionsResult = await pool.query(
      `
      SELECT
        transaction_date,
        type,
        description,
        amount,
        vat_amount,
        vat_classification
      FROM transactions
      ${whereClause}
      ORDER BY transaction_date ASC, id ASC
      `,
      params
    );

    const summary = summaryResult.rows[0] || {
      taxable_sales: 0,
      zero_rated_sales: 0,
      exempt_sales: 0,
      output_vat: 0,
      input_vat: 0,
    };

    const taxableSales = Number(summary.taxable_sales || 0);
    const zeroRatedSales = Number(summary.zero_rated_sales || 0);
    const exemptSales = Number(summary.exempt_sales || 0);
    const outputVat = Number(summary.output_vat || 0);
    const inputVat = Number(summary.input_vat || 0);
    const netVat = outputVat - inputVat;

    console.log("FINAL VALUES:", {
      taxableSales,
      zeroRatedSales,
      exemptSales,
      outputVat,
      inputVat,
      netVat,
      transactionsCount: transactionsResult.rows.length,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vat-return-company-${companyId}.pdf"`
    );

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    });

    doc.pipe(res);

    doc
      .roundedRect(50, 40, 495, 70, 10)
      .fillAndStroke("#eff6ff", "#bfdbfe");

    doc.fillColor("#0f172a");
    doc.font("Helvetica-Bold").fontSize(20).text("MALTECH VAT PRO", 65, 58);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#334155")
      .text("VAT Filing Pack", 65, 84);

    doc.y = 125;

    drawSectionTitle(doc, "Filing Information");

    drawLabelValueRow(doc, "Company", companyName);
    drawLabelValueRow(doc, "TIN", resolvedTin);
    drawLabelValueRow(doc, "Filing Period", resolvedFilingPeriodLabel);
    drawLabelValueRow(doc, "Authorized Officer", resolvedAuthorizedOfficer);
    drawLabelValueRow(doc, "Position Title", resolvedPositionTitle);

    drawDivider(doc);

    drawSummaryBox(doc, {
      taxableSales,
      zeroRatedSales,
      exemptSales,
      outputVat,
      inputVat,
      netVat,
    });

    drawSectionTitle(doc, "Transactions");

    if (transactionsResult.rows.length === 0) {
      doc
        .roundedRect(50, doc.y, 495, 50, 8)
        .fillAndStroke("#f8fafc", "#cbd5e1");

      doc
        .fillColor("#334155")
        .font("Helvetica")
        .fontSize(11)
        .text("No transactions found for the selected period.", 65, doc.y - 38);

      doc.y += 20;
    } else {
      drawTransactionsTableHeader(doc, doc.y);

      transactionsResult.rows.forEach((row, index) => {
        ensureTableSpace(doc, 28);
        drawTransactionRow(doc, row, index);
      });
    }

    doc.moveDown(1);

    ensureTableSpace(doc, 120);

    drawDivider(doc);

    drawSectionTitle(doc, "Certification");

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#111827")
      .text(
        "I declare that the information contained in this VAT filing pack is true and complete to the best of my knowledge.",
        50,
        doc.y,
        { width: 495, align: "left" }
      );

    doc.moveDown(2);

    const sigY = doc.y;

    doc
      .strokeColor("#64748b")
      .lineWidth(1)
      .moveTo(60, sigY + 25)
      .lineTo(240, sigY + 25)
      .stroke();

    doc
      .moveTo(320, sigY + 25)
      .lineTo(500, sigY + 25)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text("Authorized Officer Signature", 60, sigY + 32, { width: 180 })
      .text("Date", 320, sigY + 32, { width: 180 });

    doc.end();
  } catch (error) {
    console.error("🔥 PDF ERROR FULL:", error);

    return res.status(500).json({
      error: "Failed to generate VAT PDF",
      details: error.message,
      stack: error.stack,
    });
  }
};