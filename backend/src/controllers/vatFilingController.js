const pool = require("../config/db");
const PDFDocument = require("pdfkit");

const toNumber = (value) => Number(value || 0);

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const mapFilingRow = (row) => {
  const taxableSales = Number(row.taxable_sales || 0);
  const zeroRatedSales = Number(row.zero_rated_sales || 0);
  const exemptSales = Number(row.exempt_sales || 0);
  const outputVat = Number(row.output_vat || 0);
  const inputVat = Number(row.input_vat || 0);
  const netVat = Number(row.net_vat || row.net_vat_payable || 0);

  return {
    id: row.id,
    companyId: row.company_id,
    startDate: row.period_start,
    endDate: row.period_end,
    filingPeriodLabel: row.filing_period_label || "",
    taxableSales,
    zeroRatedSales,
    exemptSales,
    totalSales: Number(
      row.total_sales || taxableSales + zeroRatedSales + exemptSales
    ),
    totalPurchases: Number(row.total_purchases || 0),
    outputVat,
    inputVat,
    netVat,
    status: row.status || "draft",
    tin: row.tin || "",
    authorizedOfficer: row.authorized_officer || "",
    positionTitle: row.position_title || "",
    declarationAccepted: Boolean(row.declaration_accepted),
    createdAt: row.created_at || null,
  };
};

const buildFilingPackData = async (filingId) => {
  const filingResult = await pool.query(
    `
    SELECT *
    FROM vat_filings
    WHERE id = $1
    LIMIT 1
    `,
    [filingId]
  );

  if (filingResult.rows.length === 0) {
    throw new Error("Filing not found");
  }

  const filing = filingResult.rows[0];

  if (!filing.period_start || !filing.period_end) {
    throw new Error("Invalid filing period");
  }

  const transactionResult = await pool.query(
    `
    SELECT
      t.*
    FROM transactions t
    WHERE t.company_id = $1
      AND DATE(t.transaction_date) BETWEEN DATE($2) AND DATE($3)
    ORDER BY t.transaction_date ASC, t.id ASC
    `,
    [filing.company_id, filing.period_start, filing.period_end]
  );

  const transactions = transactionResult.rows;
  const transactionIds = transactions.map((t) => t.id);

  let documents = [];

  if (transactionIds.length > 0) {
    const documentResult = await pool.query(
      `
      SELECT
        d.*
      FROM company_documents d
      WHERE d.transaction_id = ANY($1)
      ORDER BY d.created_at DESC, d.id DESC
      `,
      [transactionIds]
    );

    documents = documentResult.rows;
  }

  const documentsByTransactionId = {};
  for (const doc of documents) {
    if (!documentsByTransactionId[doc.transaction_id]) {
      documentsByTransactionId[doc.transaction_id] = [];
    }
    documentsByTransactionId[doc.transaction_id].push(doc);
  }

  const transactionSummaries = transactions.map((tx) => {
    const linkedDocuments = documentsByTransactionId[tx.id] || [];

    return {
      ...tx,
      linkedDocuments,
      linkedDocumentCount: linkedDocuments.length,
      hasLinkedDocuments: linkedDocuments.length > 0,
    };
  });

  const transactionsMissingDocuments = transactionSummaries.filter(
    (tx) => tx.linkedDocumentCount === 0
  );

  const documentCount = documents.length;
  const transactionCount = transactions.length;
  const linkedTransactionCount = transactionSummaries.filter(
    (tx) => tx.linkedDocumentCount > 0
  ).length;
  const missingDocumentCount = transactionsMissingDocuments.length;

  const auditScore =
    transactionCount === 0
      ? 0
      : Math.round((linkedTransactionCount / transactionCount) * 100);

  const auditReadiness =
    transactionCount === 0
      ? "no_transactions"
      : missingDocumentCount === 0
        ? "complete"
        : linkedTransactionCount > 0
          ? "partial"
          : "missing_documents";

  return {
    filing: mapFilingRow(filing),
    transactions: transactionSummaries,
    documents,
    stats: {
      transactionCount,
      documentCount,
      linkedTransactionCount,
      missingDocumentCount,
    },
    audit: {
      auditReadiness,
      auditScore,
      transactionsMissingDocuments,
    },
  };
};

const buildVat001Lines = (summary = {}) => {
  const zeroRatedSupplies = toNumber(summary.zeroRatedSupplies);
  const exemptSupplies = toNumber(summary.exemptSupplies);
  const bondedSupplies = toNumber(summary.bondedSupplies);
  const taxableSuppliesInclVat = toNumber(summary.taxableSuppliesInclVat);
  const vatCollectedStandard = toNumber(summary.outputVat);
  const reverseChargeImportedServices = toNumber(summary.reverseChargeVat);
  const adjustments = toNumber(summary.adjustments);

  const totalTaxableAndBondedExVat =
    zeroRatedSupplies +
    bondedSupplies +
    (taxableSuppliesInclVat - vatCollectedStandard);

  const totalSuppliesExVat = exemptSupplies + totalTaxableAndBondedExVat;
  const totalOutputTax =
    vatCollectedStandard + reverseChargeImportedServices + adjustments;

  const importsCapitalExVat = toNumber(summary.importsCapitalExVat);
  const importsOperatingExVat = toNumber(summary.importsOperatingExVat);
  const importedServicesExVat = toNumber(summary.importedServicesExVat);
  const domesticCapitalPurchasesExVat = toNumber(
    summary.domesticCapitalPurchasesExVat
  );
  const vatPaidDomesticCapital = toNumber(summary.vatPaidDomesticCapital);
  const domesticOperatingPurchasesExVat = toNumber(
    summary.domesticOperatingPurchasesExVat
  );
  const vatPaidDomesticOperating = toNumber(summary.vatPaidDomesticOperating);

  const totalInputTax = toNumber(summary.inputVat);
  const vatPayableOrCreditBeforeCarry = totalOutputTax - totalInputTax;
  const vatCreditCarriedForward = toNumber(summary.vatCreditCarriedForward);
  const deferredVatPayableDuringPeriod = toNumber(
    summary.deferredVatPayableDuringPeriod
  );

  const totalVatPayable =
    vatPayableOrCreditBeforeCarry + deferredVatPayableDuringPeriod;

  const netVatPayableOrCredit =
    totalVatPayable - vatCreditCarriedForward;

  return [
    { line: 1, label: "Zero-Rated Supplies", value: zeroRatedSupplies },
    { line: 2, label: "Exempt Supplies", value: exemptSupplies },
    { line: 3, label: "Bonded Supplies", value: bondedSupplies },
    {
      line: 4,
      label: "Taxable Supplies at Standard Rate (VAT Inclusive)",
      value: taxableSuppliesInclVat,
    },
    {
      line: 5,
      label: "VAT Collected on Standard Rate Supplies",
      value: vatCollectedStandard,
    },
    {
      line: 6,
      label: "Reverse Charge VAT on Imported Services",
      value: reverseChargeImportedServices,
    },
    { line: 7, label: "Adjustments for the Period", value: adjustments },
    {
      line: 8,
      label: "Supplies Excluding VAT - Taxable & Bonded",
      value: totalTaxableAndBondedExVat,
    },
    {
      line: 9,
      label: "Total Supplies Excluding VAT",
      value: totalSuppliesExVat,
    },
    { line: 10, label: "Total Output Tax", value: totalOutputTax },
    {
      line: 11,
      label: "Bonded Inputs Relating to Imports and Domestic Purchases",
      value: toNumber(summary.bondedInputs),
    },
    {
      line: 12,
      label: "Imports - Value of Capital Goods & Services (Ex VAT)",
      value: importsCapitalExVat,
    },
    {
      line: 13,
      label:
        "Imports - Value of Operating Inputs & Other Non-Capital Supplies (Ex VAT)",
      value: importsOperatingExVat,
    },
    {
      line: 14,
      label: "VAT Paid on Imports",
      value: toNumber(summary.vatPaidOnImports),
    },
    {
      line: 15,
      label: "Imported Services (Ex VAT)",
      value: importedServicesExVat,
    },
    {
      line: 16,
      label: "VAT Payable on Imported Services",
      value: reverseChargeImportedServices,
    },
    {
      line: 17,
      label: "Domestic Purchases - Capital Goods (Ex VAT)",
      value: domesticCapitalPurchasesExVat,
    },
    {
      line: 18,
      label: "Domestic Purchases - Operating Inputs / Non-Capital (Ex VAT)",
      value: domesticOperatingPurchasesExVat,
    },
    {
      line: 19,
      label: "VAT Paid on Domestic Purchases",
      value: vatPaidDomesticCapital + vatPaidDomesticOperating,
    },
    {
      line: 20,
      label: "Total VAT Paid on Domestic Purchases & Imports",
      value: toNumber(summary.totalVatPaidPurchasesAndImports),
    },
    {
      line: 21,
      label: "Adjustment for the Period - Input VAT",
      value: toNumber(summary.inputAdjustments),
    },
    {
      line: 22,
      label: "Input VAT Directly Attributable to Exempt Supplies",
      value: toNumber(summary.inputVatExemptOnly),
    },
    {
      line: 23,
      label: "Input VAT from Mixed Supplies",
      value: toNumber(summary.inputVatMixed),
    },
    {
      line: 24,
      label: "Input VAT Directly Attributable to Taxable Supplies",
      value: toNumber(summary.inputVatTaxableOnly),
    },
    {
      line: 25,
      label: "Allowable Portion of Mixed Input VAT",
      value: toNumber(summary.allowableMixedInputVat),
    },
    { line: 26, label: "Total Input Tax", value: totalInputTax },
    {
      line: 27,
      label: "VAT Payable or VAT Credit",
      value: vatPayableOrCreditBeforeCarry,
    },
    {
      line: 28,
      label: "Deferred VAT Payable During Period",
      value: deferredVatPayableDuringPeriod,
    },
    { line: 29, label: "Total VAT Payable", value: totalVatPayable },
    {
      line: 30,
      label: "VAT Credit Carried Over from Prior Taxable Period",
      value: vatCreditCarriedForward,
    },
    {
      line: 31,
      label: "Net VAT Payable or VAT Credit",
      value: netVatPayableOrCredit,
    },
  ];
};

exports.saveVatFiling = async (req, res) => {
  try {
    const {
      companyId,

      // Support both frontend camelCase and backend snake_case
      startDate,
      endDate,
      period_start,
      period_end,

      filingPeriodLabel = "",
      taxableSales = 0,
      zeroRatedSales = 0,
      exemptSales = 0,
      totalSales = 0,
      totalPurchases = 0,
      outputVat = 0,
      inputVat = 0,
      netVat = 0,
      tin = "",
      authorizedOfficer = "",
      positionTitle = "",
      declarationAccepted = false,
    } = req.body;

    // Normalize incoming dates
    const filingStartDate = startDate ?? period_start;
    const filingEndDate = endDate ?? period_end;

    if (!companyId || !filingStartDate || !filingEndDate) {
      return res.status(400).json({
        error: "companyId, startDate/endDate are required",
      });
    }

    if (new Date(filingStartDate) > new Date(filingEndDate)) {
      return res.status(400).json({
        error: "Start date cannot be after end date",
      });
    }

    const numericOutputVat = Number(outputVat);
    const numericInputVat = Number(inputVat);
    const numericNetVat = Number(netVat);

    if (
      Number.isNaN(numericOutputVat) ||
      Number.isNaN(numericInputVat) ||
      Number.isNaN(numericNetVat)
    ) {
      return res.status(400).json({
        error: "VAT values must be valid numbers",
      });
    }

    const existing = await pool.query(
      `
      SELECT id, status
      FROM vat_filings
      WHERE company_id = $1
      AND period_start = $2
      AND period_end = $3
      LIMIT 1
      `,
      [companyId, filingStartDate, filingEndDate]
    );

    if (existing.rows.length > 0) {
      const existingFiling = existing.rows[0];

      // 🚨 NEW: Prevent editing locked filings
      if (existingFiling.status === "locked") {
        return res.status(400).json({
          error: "This filing is locked and cannot be modified",
        });
      }

      return res.status(409).json({
        error:
          "A VAT filing already exists for this period. Please edit the existing filing instead",
        existingFiling: {
          id: existingFiling.id,
          status: existingFiling.status,
        },
      });
    }

    const insertResult = await pool.query(
      `
  INSERT INTO vat_filings (
    company_id,
    period_start,
    period_end,
    total_sales,
    total_purchases,
    output_vat,
    input_vat,
    net_vat,
    status
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
  )
  RETURNING *
  `,
      [
        companyId,
        filingStartDate,
        filingEndDate,
        Number(
          totalSales ||
          Number(taxableSales || 0) +
          Number(zeroRatedSales || 0) +
          Number(exemptSales || 0)
        ),
        Number(totalPurchases || 0),
        numericOutputVat,
        numericInputVat,
        numericNetVat,
        "draft",
      ]
    );

    return res.status(201).json({
      message: "VAT filing saved successfully",
      filing: mapFilingRow(insertResult.rows[0]),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error:
          "A VAT filing already exists for this company and filing period.",
      });
    }

    console.error("saveVatFiling error:", error);

    return res.status(500).json({
      error: "Failed to save VAT filing",
      details: error.message,
    });
  }
};

exports.getFilingsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM vat_filings
      WHERE company_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [companyId]
    );

    return res.json(result.rows.map(mapFilingRow));
  } catch (error) {
    console.error("getFilingsByCompany error:", error);
    return res.status(500).json({ error: "Failed to fetch VAT filings" });
  }
};

exports.getFilingById = async (req, res) => {
  try {
    const { filingId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM vat_filings
      WHERE id = $1
      LIMIT 1
      `,
      [filingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "VAT filing not found" });
    }

    return res.json(mapFilingRow(result.rows[0]));
  } catch (error) {
    console.error("getFilingById error:", error);
    return res.status(500).json({ error: "Failed to fetch VAT filing" });
  }
};

exports.getFilingPackSummary = async (req, res) => {
  try {
    const { filingId } = req.params;

    if (!filingId) {
      return res.status(400).json({
        error: "Filing ID is required",
      });
    }

    const packData = await buildFilingPackData(filingId);

    return res.status(200).json({
      filing: packData.filing,
      stats: packData.stats,
      audit: packData.audit,
      transactions: packData.transactions,
      documents: packData.documents,
    });
  } catch (error) {
    console.error("getFilingPackSummary error:", error);

    if (error.message === "Filing not found") {
      return res.status(404).json({
        error: "Filing not found",
      });
    }

    return res.status(500).json({
      error: "Failed to generate filing pack summary",
      details: error.message,
    });
  }
};

exports.exportFilingsCsv = async (req, res) => {
  try {
    const { companyId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM vat_filings
      WHERE company_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [companyId]
    );

    const rows = result.rows.map(mapFilingRow);

    const header = [
      "ID",
      "Start Date",
      "End Date",
      "Taxable Sales",
      "Zero Rated Sales",
      "Exempt Sales",
      "Total Sales",
      "Output VAT",
      "Input VAT",
      "Net VAT",
      "Status",
      "Created At",
    ];

    const csvLines = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.startDate,
          row.endDate,
          row.taxableSales,
          row.zeroRatedSales,
          row.exemptSales,
          row.totalSales,
          row.outputVat,
          row.inputVat,
          row.netVat,
          row.status,
          row.createdAt,
        ].join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vat-filings-company-${companyId}.csv"`
    );

    return res.send(csvLines.join("\n"));
  } catch (error) {
    console.error("exportFilingsCsv error:", error);
    return res.status(500).json({ error: "Failed to export VAT filings CSV" });
  }
};

exports.getFilingPdf = async (req, res) => {
  try {
    const { filingId } = req.params;

    const result = await pool.query(
      `
      SELECT
        vf.*,
        c.name AS company_name,
        c.tin AS company_tin
      FROM vat_filings vf
      LEFT JOIN companies c ON c.id = vf.company_id
      WHERE vf.id = $1
      LIMIT 1
      `,
      [filingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "VAT filing not found" });
    }

    const row = result.rows[0];
    const filing = mapFilingRow(row);
    const companyName = row.company_name || `Company #${filing.companyId}`;
    const tin = filing.tin || row.company_tin || "";

    if (!tin) {
      return res.status(400).json({ error: "TIN is required" });
    }

    if (!filing.authorizedOfficer || !filing.positionTitle) {
      return res.status(400).json({
        error: "Authorized Officer and Position Title required",
      });
    }

    if (!filing.declarationAccepted) {
      return res.status(400).json({
        error: "Declaration must be accepted",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vat-filing-${filing.id}.pdf"`
    );

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text("VAT Filing Summary", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Filing ID: ${filing.id}`);
    doc.text(`Company: ${companyName}`);
    doc.text(`TIN: ${tin}`);
    doc.text(
      `Period: ${formatDate(filing.startDate)} to ${formatDate(filing.endDate)}`
    );
    doc.text(`Status: ${filing.status}`);
    doc.moveDown();

    doc.text(`Taxable Sales: ${filing.taxableSales.toFixed(2)}`);
    doc.text(`Zero Rated Sales: ${filing.zeroRatedSales.toFixed(2)}`);
    doc.text(`Exempt Sales: ${filing.exemptSales.toFixed(2)}`);
    doc.text(`Total Sales: ${filing.totalSales.toFixed(2)}`);
    doc.moveDown();

    doc.text(`Output VAT: ${filing.outputVat.toFixed(2)}`);
    doc.text(`Input VAT: ${filing.inputVat.toFixed(2)}`);
    doc.text(`Net VAT: ${filing.netVat.toFixed(2)}`);
    doc.moveDown();

    doc.text(`Authorized Officer: ${filing.authorizedOfficer}`);
    doc.text(`Position Title: ${filing.positionTitle}`);
    doc.text(
      `Declaration Accepted: ${filing.declarationAccepted ? "Yes" : "No"}`
    );

    doc.end();
  } catch (error) {
    console.error("getFilingPdf error:", error);
    return res.status(500).json({
      error: "Failed to generate VAT filing PDF",
      details: error.message,
    });
  }
};
exports.getFilingPackPdf = async (req, res) => {
  try {
    const { filingId } = req.params;

    if (!filingId) {
      return res.status(400).json({ error: "Filing ID is required" });
    }

    const result = await pool.query(
      `
      SELECT
        vf.*,
        c.name AS company_name,
        c.email AS company_email,
        c.phone AS company_phone,
        c.address AS company_address,
        c.tin AS company_tin
      FROM vat_filings vf
      LEFT JOIN companies c ON c.id = vf.company_id
      WHERE vf.id = $1
      LIMIT 1
      `,
      [filingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "VAT filing not found" });
    }

    const row = result.rows[0];
    const filing = mapFilingRow(row);
    const companyName = row.company_name || `Company #${filing.companyId}`;
    const companyBrand = companyName.toUpperCase();
    const tin = filing.tin || row.company_tin || "";

    const safeTin = tin || "Not provided";
    const safeAuthorizedOfficer =
      filing.authorizedOfficer || "Not provided";
    const safePositionTitle =
      filing.positionTitle || "Not provided";
    const safeDeclarationAccepted =
      filing.declarationAccepted ? "YES" : "NO";

    const packData = await buildFilingPackData(filingId);

    const filingSummary = {
      zeroRatedSupplies: filing.zeroRatedSales,
      exemptSupplies: filing.exemptSales,
      bondedSupplies: 0,
      taxableSuppliesInclVat:
        Number(filing.taxableSales || 0) + Number(filing.outputVat || 0),
      outputVat: filing.outputVat,
      reverseChargeVat: 0,
      adjustments: 0,
      importsCapitalExVat: 0,
      importsOperatingExVat: 0,
      importedServicesExVat: 0,
      deferredVatOnImports: 0,
      domesticCapitalPurchasesExVat: 0,
      vatPaidDomesticCapital: 0,
      domesticOperatingPurchasesExVat: filing.totalPurchases,
      vatPaidDomesticOperating: filing.inputVat,
      totalVatPaidPurchasesAndImports: filing.inputVat,
      inputAdjustments: 0,
      inputVatExemptOnly: 0,
      inputVatMixed: 0,
      inputVatTaxableOnly: filing.inputVat,
      allowableMixedInputVat: 0,
      inputVat: filing.inputVat,
      vatCreditCarriedForward: 0,
      deferredVatPayableDuringPeriod: 0,
    };

    const vat001Lines = buildVat001Lines(filingSummary);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vat-filing-pack-${filing.id}.pdf"`
    );

    const doc = new PDFDocument({
      margin: 42,
      size: "A4",
    });
    doc.pipe(res);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const money = (value) =>
      `BSD ${Number(value || 0).toLocaleString("en-BS", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    const getAuditRisk = () => {
      if (packData.audit.auditScore >= 90) {
        return {
          label: "LOW RISK",
          color: "#166534",
          background: "#DCFCE7",
        };
      }

      if (packData.audit.auditScore >= 70) {
        return {
          label: "MEDIUM RISK",
          color: "#92400E",
          background: "#FEF3C7",
        };
      }

      return {
        label: "HIGH RISK",
        color: "#991B1B",
        background: "#FEE2E2",
      };
    };

    const auditRisk = getAuditRisk();

    const ensureSpace = (needed = 100) => {
      const available =
        doc.page.height -
        doc.page.margins.bottom -
        doc.y;

      if (available < needed) {
        doc.addPage();
        doc.y = doc.page.margins.top + 20;
        return true;          // page break occurred
      }

      return false;
    };

    const drawDivider = () => {
      doc
        .strokeColor("#D1D5DB")
        .lineWidth(1)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.6);
    };

    const drawSectionTitle = (title) => {
      ensureSpace(60);
      y = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#0F172A")
        .text(title.toUpperCase(), { align: "left" });
      doc.moveDown(0.35);
      drawDivider();
    };

    const drawInfoBox = (items = []) => {
      const boxX = doc.page.margins.left;
      const boxY = doc.y;
      const boxWidth = pageWidth;
      const rowHeight = 20;
      const boxHeight = items.length * rowHeight + 20;

      ensureSpace(boxHeight + 20);

      doc
        .roundedRect(boxX, boxY, boxWidth, boxHeight, 10)
        .fillAndStroke("#F8FAFC", "#E5E7EB");

      let currentY = boxY + 12;

      items.forEach((item) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#475569")
          .text(item.label, boxX + 14, currentY, { width: 180 });

        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#0F172A")
          .text(String(item.value ?? "-"), boxX + 190, currentY, {
            width: boxWidth - 204,
          });

        currentY += rowHeight;
      });

      doc.y = boxY + boxHeight + 14;
    };

    const drawSimpleTable = ({
      columns,
      rows,
      rowHeight = 18,
      headerFill = "#E8EEF9",
      headerText = "#0F172A",
    }) => {
      const startX = doc.page.margins.left;
      let y = doc.y;
      const cellPadding = 8;

      const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

      ensureSpace(50);

      doc.rect(startX, y, tableWidth, 22).fill(headerFill);

      let x = startX;
      columns.forEach((col) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(headerText)
          .text(col.label, x + 6, y + 6, {
            width: col.width - 12,
            align: col.align || "left",
          });
        x += col.width;
      });

      y += 22;

      rows.forEach((row, rowIndex) => {

        const pageBreak = ensureSpace(rowHeight + 30);

        if (pageBreak) {

          y = doc.y;

          // redraw table header
          doc
            .fillColor(headerFill)
            .rect(startX, y, tableWidth, 22)
            .fill();

          let headerX = startX;

          columns.forEach((col) => {

            doc
              .font("Helvetica-Bold")
              .fontSize(9)
              .fillColor(headerText)
              .text(
                col.label,
                headerX + 6,
                y + 6,
                {
                  width: col.width - 12,
                  align: col.align || "left",
                }
              );

            headerX += col.width;
          });

          y += 22;
          doc.y = y;
        }

        let cellX = startX;

        columns.forEach((col, colIndex) => {

          const value = row[col.key] ?? "";

          doc
            .rect(cellX, y, col.width, rowHeight)
            .stroke("#D1D5DB");

          doc
            .fillColor("#111827")
            .font("Helvetica")
            .fontSize(9)
            .text(
              String(value),
              cellX + cellPadding,
              y + 8,
              {
                width: col.width - cellPadding * 2,
              }
            );

          cellX += col.width;
        });

        y += rowHeight;
        doc.y = y;
      });

      doc.y = y + 10;
    };

    const drawFooter = () => {
      const footerY = doc.page.height - 34;
      const currentPage = doc.page.pageNumber;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6B7280")
        .text("Generated by Maltech VAT Pro", doc.page.margins.left, footerY, {
          width: pageWidth,
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6B7280")
        .text(`Page ${currentPage}`, doc.page.margins.left, footerY, {
          width: pageWidth,
          align: "right",
        });

    };

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#475569")
      .text("VALUE ADDED TAX RETURN SUPPORTING DOCUMENT PACK", {
        align: "center",
      });

    doc.moveDown(0.5);

    doc
      .roundedRect(doc.page.margins.left, doc.y, pageWidth, 82, 12)
      .fillAndStroke("#0F3D91", "#0F3D91");

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#FFFFFF")
      .text(companyBrand, doc.page.margins.left + 18, doc.y + 16, {
        width: pageWidth - 36,
      });

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#DBEAFE")
      .text(
        "Audit-Ready VAT Filing Pack",
        doc.page.margins.left + 18,
        doc.y + 44,
        {
          width: pageWidth - 36,
        }
      );

    doc.y += 98;

    drawInfoBox([
      { label: "Filing ID", value: filing.id },
      { label: "Company", value: companyName },
      { label: "TIN", value: safeTin },
      { label: "Email", value: row.company_email || "-" },
      { label: "Phone", value: row.company_phone || "-" },
      { label: "Address", value: row.company_address || "-" },
      {
        label: "Period",
        value: `${formatDate(filing.startDate)} to ${formatDate(filing.endDate)}`,
      },
      { label: "Status", value: String(filing.status || "draft").toUpperCase() },
      { label: "Generated", value: formatDate(new Date()) },
    ]);

    drawSectionTitle("Filing Summary");
    drawSimpleTable({
      columns: [
        { label: "Metric", key: "metric", width: 300 },
        { label: "Amount", key: "amount", width: 180, align: "right" },
      ],
      rows: [
        { metric: "Taxable Sales", amount: money(filing.taxableSales) },
        { metric: "Zero Rated Sales", amount: money(filing.zeroRatedSales) },
        { metric: "Exempt Sales", amount: money(filing.exemptSales) },
        { metric: "Total Sales", amount: money(filing.totalSales) },
        { metric: "Total Purchases", amount: money(filing.totalPurchases) },
        { metric: "Output VAT", amount: money(filing.outputVat) },
        { metric: "Input VAT", amount: money(filing.inputVat) },
        { metric: "Net VAT", amount: money(filing.netVat) },
      ],
    });

    drawSectionTitle("VAT Return (VAT-001 Format)");
    drawSimpleTable({
      columns: [
        { label: "Line", key: "line", width: 50 },
        { label: "Description", key: "label", width: 330 },
        { label: "Value", key: "value", width: 100, align: "right" },
      ],
      rows: vat001Lines.map((item) => ({
        line: item.line,
        label: item.label,
        value: money(item.value),
      })),
      rowHeight: 20,
      headerFill: "#EFF6FF",
    });

    // ===============================
    // Audit Readiness Section
    // ===============================
    drawSectionTitle("Audit Readiness");

    const auditBoxX = doc.page.margins.left;
    const auditBoxY = doc.y;
    const auditBoxWidth = pageWidth;
    const auditBoxHeight = 76;

    ensureSpace(auditBoxHeight + 30);

    doc
      .roundedRect(auditBoxX, auditBoxY, auditBoxWidth, auditBoxHeight, 10)
      .fillAndStroke(auditRisk.background, auditRisk.background);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(auditRisk.color)
      .text(`${packData.audit.auditScore}%`, auditBoxX + 16, auditBoxY + 14, {
        width: 90,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(auditRisk.color)
      .text(auditRisk.label, auditBoxX + 110, auditBoxY + 14, {
        width: auditBoxWidth - 130,
      });

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(
        `${packData.stats.linkedTransactionCount} of ${packData.stats.transactionCount} transaction(s) have linked documents`,
        auditBoxX + 110,
        auditBoxY + 34,
        { width: auditBoxWidth - 130 }
      );

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(
        `Missing Documents: ${packData.stats.missingDocumentCount}`,
        auditBoxX + 110,
        auditBoxY + 50,
        { width: auditBoxWidth - 130 }
      );

    doc.y = auditBoxY + auditBoxHeight + 14;

    /*drawInfoBox([
      {
        label: "Audit Status",
        value: auditRisk.label,
      },
      {
        label: "Audit Score",
        value: `${packData.audit.auditScore}%`,
      },
      {
        label: "Document Coverage",
        value: `${packData.stats.linkedTransactionCount} of ${packData.stats.transactionCount} transaction(s) have linked documents`,
      },
      {
        label: "Missing Documents",
        value: packData.stats.missingDocumentCount,
      },
    ]);*/

    drawSectionTitle("Supporting Transactions");

    if (!packData.transactions.length) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#374151")
        .text("No transactions found for this filing period.");
    } else {
      drawSimpleTable({
        columns: [
          { label: "Date", key: "date", width: 78 },
          { label: "Type", key: "type", width: 68 },
          { label: "Description", key: "description", width: 190 },
          { label: "Amount", key: "amount", width: 80, align: "right" },
          { label: "VAT", key: "vat", width: 70, align: "right" },
          { label: "Docs", key: "docs", width: 54, align: "right" },
        ],
        rows: packData.transactions.map((tx) => ({
          date: formatDate(tx.transaction_date),
          type: tx.type || "-",
          description: tx.description || "-",
          amount: money(tx.amount),
          vat: money(tx.vat_amount || tx.vatAmount || 0),
          docs: tx.linkedDocumentCount || 0,
        })),
        rowHeight: 20,
        headerFill: "#F8FAFC",
      });
    }

    drawSectionTitle("Linked Documents");

    if (!packData.documents.length) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#374151")
        .text("No linked documents found.");
    } else {
      drawSimpleTable({
        columns: [
          { label: "Doc ID", key: "id", width: 60 },
          { label: "Transaction", key: "transactionId", width: 90 },
          { label: "Name", key: "name", width: 280 },
          { label: "Category", key: "category", width: 100 },
        ],
        rows: packData.documents.map((documentRow) => ({
          id: documentRow.id,
          transactionId: documentRow.transaction_id || "-",
          name:
            documentRow.original_name ||
            documentRow.file_name ||
            documentRow.filename ||
            "-",
          category: documentRow.category || "General",
        })),
        rowHeight: 20,
        headerFill: "#FFF7ED",
      });
    }

    drawSectionTitle("Missing Document Warnings");

    if (!packData.audit.transactionsMissingDocuments.length) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#166534")
        .text("All transactions have linked supporting documents.");
      doc.moveDown();
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#991B1B")
        .text(
          `${packData.audit.transactionsMissingDocuments.length} transaction(s) are missing linked supporting documents.`
        );
      doc.moveDown(0.5);

      drawSimpleTable({
        columns: [
          { label: "Transaction ID", key: "id", width: 90 },
          { label: "Date", key: "date", width: 90 },
          { label: "Type", key: "type", width: 70 },
          { label: "Amount", key: "amount", width: 90, align: "right" },
          { label: "Description", key: "description", width: 220 },
        ],
        rows: packData.audit.transactionsMissingDocuments.map((tx) => ({
          id: tx.id,
          date: formatDate(tx.transaction_date),
          type: tx.type || "-",
          amount: money(tx.amount),
          description: tx.description || "-",
        })),
        rowHeight: 20,
        headerFill: "#FEE2E2",
      });
    }

    drawSectionTitle("Declaration");

    drawInfoBox([
      { label: "Authorized Officer", value: filing.authorizedOfficer },
      { label: "Position Title", value: filing.positionTitle },
      {
        label: "Declaration Accepted",
        value: filing.declarationAccepted ? "YES" : "NO",
      },
    ]);

    doc.end();

  } catch (error) {
    console.error("getFilingPackPdf error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Failed to generate filing pack PDF",
        details: error.message,
      });
    }

    return res.end();
  }
};

exports.lockFiling = async (req, res) => {
  try {
    const { filingId } = req.params;

    const packData = await buildFilingPackData(filingId);

    const auditScore = Number(
      packData.audit?.auditScore || 0
    );

    const missingDocumentCount = Number(
      packData.stats?.missingDocumentCount || 0
    );

    const unlinkedDocumentCount = Number(
      packData.stats?.unlinkedDocumentCount || 0
    );

    const transactionCount = Number(
      packData.stats?.transactionCount || 0
    );

    console.log("===== AUDIT LOCK CHECK =====");
    console.log({
      filingId,
      auditScore,
      missingDocumentCount,
      unlinkedDocumentCount,
      transactionCount,
    });

    if (auditScore < 70) {
      return res.status(400).json({
        error:
          "Filing cannot be locked because audit readiness is below 70%.",
        auditScore,
      });
    }

    if (missingDocumentCount > 0) {
      return res.status(400).json({
        error:
          "Filing cannot be locked because supporting documents are missing.",
        missingDocumentCount,
      });
    }

    if (unlinkedDocumentCount > 0) {
      return res.status(400).json({
        error:
          "Filing cannot be locked because documents remain unlinked.",
        unlinkedDocumentCount,
      });
    }

    const existing = await pool.query(
      `
      SELECT id, status
      FROM vat_filings
      WHERE id = $1
      `,
      [filingId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "Filing not found",
      });
    }

    const currentStatus =
      String(existing.rows[0].status || "").toLowerCase();

    if (currentStatus === "locked") {
      return res.status(400).json({
        error: "Filing is already locked",
      });
    }

    if (currentStatus !== "submitted") {
      return res.status(400).json({
        error: "Only submitted filings may be locked",
      });
    }

    const result = await pool.query(
      `
      UPDATE vat_filings
      SET status = 'locked'
      WHERE id = $1
      RETURNING *
      `,
      [filingId]
    );

    return res.json({
      message: "Filing locked successfully",
      filing: result.rows[0],
    });
  } catch (error) {
    console.error("lockFiling error:", error);

    return res.status(500).json({
      error: "Failed to lock filing",
    });
  }
};

exports.updateFilingStatus = async (req, res) => {
  try {
    const { filingId } = req.params;
    let { status } = req.body;

    // Normalize status so "Draft", "SUBMITTED", etc. do not break the backend
    status = String(status || "").toLowerCase().trim();

    const allowedStatuses = ["draft", "submitted", "locked"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Allowed values: draft, submitted, locked",
      });
    }

    const existing = await pool.query(
      `
  SELECT id, status
  FROM vat_filings
  WHERE id = $1
  LIMIT 1
  `,
      [filingId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "Filing not found",
      });
    }

    const currentStatus = String(existing.rows[0].status || "").toLowerCase();

    if (currentStatus === "locked") {
      return res.status(400).json({
        error: "Locked filings cannot be changed",
      });
    }

    const validTransitions = {
      draft: ["submitted"],
      submitted: ["locked"],
      locked: [],
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${status}`,
      });
    }

    // 🔒 AUDIT SUBMISSION VALIDATION
    if (status === "submitted") {
      const packData = await buildFilingPackData(filingId);

      const auditScore = Number(
        packData.audit?.auditScore || 0
      );

      const missingDocumentCount = Number(
        packData.stats?.missingDocumentCount || 0
      );

      const unlinkedDocumentCount = Number(
        packData.stats?.unlinkedDocumentCount || 0
      );

      const transactionCount = Number(
        packData.stats?.transactionCount || 0
      );

      console.log("===== AUDIT SUBMISSION CHECK =====");
      console.log({
        filingId,
        auditScore,
        missingDocumentCount,
        unlinkedDocumentCount,
        transactionCount,
      });

      if (transactionCount === 0) {
        return res.status(400).json({
          error:
            "Filing cannot be locked because no transactions exist.",
        });
      }

      if (transactionCount === 0) {
        return res.status(400).json({
          error:
            "Cannot submit filing because no transactions exist.",
        });
      }

      if (auditScore < 70) {
        return res.status(400).json({
          error:
            "Audit readiness score must be at least 70%.",
          auditScore,
        });
      }

      if (missingDocumentCount > 0) {
        return res.status(400).json({
          error:
            "Missing supporting documents detected.",
          missingDocumentCount,
        });
      }

      if (unlinkedDocumentCount > 0) {
        return res.status(400).json({
          error:
            "Unlinked documents detected.",
          unlinkedDocumentCount,
        });
      }

      // Keep submitted status.
      status = "submitted";
    }

    const result = await pool.query(
      `
      UPDATE vat_filings
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, filingId]
    );

    return res.json({
      message: "Filing status updated successfully",
      filing: mapFilingRow(result.rows[0]),
    });
  } catch (error) {
    console.error("Error updating filing status:", error);
    return res.status(500).json({
      error: "Failed to update filing status",
    });
  }
};

exports.deleteFiling = async (req, res) => {
  try {
    const { filingId } = req.params;

    const existing = await pool.query(
      `
      SELECT id, status
      FROM vat_filings
      WHERE id = $1
      `,
      [filingId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Filing not found" });
    }

    if (
      existing.rows[0].status === "locked" ||
      existing.rows[0].status === "submitted"
    ) {
      return res.status(400).json({
        error:
          "This filing cannot be deleted because it is locked or submitted",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM vat_filings
      WHERE id = $1
      RETURNING id
      `,
      [filingId]
    );

    return res.json({
      message: "Filing deleted successfully",
      id: result.rows[0].id,
    });
  } catch (error) {
    console.error("Error deleting filing:", error);
    return res.status(500).json({ error: "Failed to delete filing" });
  }
};
