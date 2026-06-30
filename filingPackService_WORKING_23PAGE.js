const pool = require("../config/db");

const toNumber = (value) => Number(value || 0);

const buildAuditLevel = ({
  totalTransactions = 0,
  linkedDocuments = 0,
  missingDocumentCount = 0,
  unlinkedUploadedCount = 0,
}) => {
  if (totalTransactions <= 0) {
    return {
      score: 100,
      level: "excellent",
      label: "Audit Ready",
      message: "No transactions were found for this filing period.",
    };
  }

  const missingSupportRatio =
    totalTransactions > 0 ? missingDocumentCount / totalTransactions : 0;

  let score = 100;

  score -= Math.min(40, missingDocumentCount * 10);
  score -= Math.min(30, unlinkedUploadedCount * 5);
  score -= Math.round(missingSupportRatio * 20);

  if (score < 0) score = 0;

  if (score >= 90) {
    return {
      score,
      level: "excellent",
      label: "Audit Ready",
      message: "The filing pack is substantially complete.",
    };
  }

  if (score >= 70) {
    return {
      score,
      level: "good",
      label: "Minor Review Needed",
      message: "Most support exists, but some items still need review.",
    };
  }

  if (score >= 50) {
    return {
      score,
      level: "warning",
      label: "Review Recommended",
      message: "The filing pack has material gaps that should be resolved.",
    };
  }

  return {
    score,
    level: "critical",
    label: "Audit Risk",
    message: "The filing pack has significant support gaps.",
  };
};

const getFilingPackData = async (filingId) => {
  const filingResult = await pool.query(
    `
    SELECT
      vf.id,
      vf.company_id,
      vf.period_start
      vf.period_end
      vf.status,
      vf.total_sales,
      vf.output_vat,
      vf.input_vat,
      vf.net_vat_payable,
      vf.created_at,
      c.name AS c.name,
      c.name AS fallback_c.name
    FROM vat_filings vf
    LEFT JOIN companies c ON c.id = vf.company_id
    WHERE vf.id = $1
    LIMIT 1
    `,
    [filingId]
  );

  if (!filingResult.rows.length) {
    throw new Error("VAT filing not found");
  }

  const filing = filingResult.rows[0];
  const companyId = filing.company_id;
  const periodStart = filing.period_start;
  const periodEnd = filing.period_end;

  const txResult = await pool.query(
    `
    SELECT
      t.id,
      t.company_id,
      t.type,
      t.amount,
      t.vat_amount,
      t.vat_classification,
      t.transaction_date,
      t.description
    FROM transactions t
    WHERE t.company_id = $1
      AND t.transaction_date >= $2
      AND t.transaction_date <= $3
    ORDER BY t.transaction_date ASC, t.id ASC
    `,
    [companyId, periodStart, periodEnd]
  );

  const transactions = txResult.rows;

  const linkedDocsResult = await pool.query(
    `
    SELECT
      d.id,
      d.company_id,
      d.transaction_id,
      d.file_name,
      d.original_name,
      d.document_type,
      d.created_at
    FROM company_documents d
    WHERE d.company_id = $1
      AND d.transaction_id IS NOT NULL
    ORDER BY d.created_at ASC, d.id ASC
    `,
    [companyId]
  );

  const allLinkedDocs = linkedDocsResult.rows;

  const transactionIds = transactions.map((t) => Number(t.id));
  const linkedDocsForPeriod = allLinkedDocs.filter((doc) =>
    transactionIds.includes(Number(doc.transaction_id))
  );

  const linkedTransactionIds = new Set(
    linkedDocsForPeriod.map((doc) => Number(doc.transaction_id))
  );

  const transactionsMissingSupport = transactions.filter(
    (tx) => !linkedTransactionIds.has(Number(tx.id))
  );

  const unlinkedDocsResult = await pool.query(
    `
    SELECT
      d.id,
      d.company_id,
      d.transaction_id,
      d.file_name,
      d.original_name,
      d.document_type,
      d.created_at
    FROM company_documents d
    WHERE d.company_id = $1
      AND d.transaction_id IS NULL
    ORDER BY d.created_at ASC, d.id ASC
    `,
    [companyId]
  );

  const unlinkedDocuments = unlinkedDocsResult.rows;

  const totals = {
    totalSales: toNumber(filing.total_sales),
    outputVAT: toNumber(filing.output_vat),
    inputVAT: toNumber(filing.input_vat),
    netVATPayable: toNumber(filing.net_vat_payable),
    transactionCount: transactions.length,
    linkedDocumentCount: linkedDocsForPeriod.length,
    unlinkedDocumentCount: unlinkedDocuments.length,
    missingSupportCount: transactionsMissingSupport.length,
  };

  const readiness = buildAuditLevel({
    totalTransactions: totals.transactionCount,
    linkedDocuments: totals.linkedDocumentCount,
    missingDocumentCount: totals.missingSupportCount,
    unlinkedUploadedCount: totals.unlinkedDocumentCount,
  });

  return {
    filing: {
      id: filing.id,
      companyId: filing.company_id,
      companyName:
        filing.c.name || filing.fallback_c.name || "Company",
      periodStart: filing.period_start,
      periodEnd: filing.period_end,
      status: filing.status,
      createdAt: filing.created_at,
      totalSales: totals.totalSales,
      outputVAT: totals.outputVAT,
      inputVAT: totals.inputVAT,
      netVATPayable: totals.netVATPayable,
    },
    totals,
    readiness,
    transactions,
    linkedDocuments: linkedDocsForPeriod,
    transactionsMissingSupport,
    unlinkedDocuments,
  };
};

module.exports = {
  getFilingPackData,
};