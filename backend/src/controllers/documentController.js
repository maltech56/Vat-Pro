const pool = require("../config/db");
const fs = require("fs");
const path = require("path");

exports.getCompanyDocuments = async (req, res) => {
  const { companyId } = req.params;
  const { search = "", category = "" } = req.query;

  try {
    let query = `
      SELECT
        d.id,
        d.company_id,
        d.transaction_id,
        d.original_name,
        d.file_name,
        d.file_path,
        d.file_size,
        d.mime_type,
        d.category,
        d.status,
        d.created_at,
        t.transaction_date,
        t.type,
        t.amount,
        t.vat_amount,
        t.description
      FROM company_documents d
      LEFT JOIN transactions t
        ON d.transaction_id = t.id
      WHERE d.company_id = $1
    `;

    const values = [companyId];
    let index = 2;

    if (search && search.trim()) {
      query += ` AND d.original_name ILIKE $${index}`;
      values.push(`%${search.trim()}%`);
      index++;
    }

    if (category && category.trim() && category !== "All") {
      query += ` AND d.category = $${index}`;
      values.push(category.trim());
      index++;
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(query, values);

    return res.json(result.rows);

  } catch (error) {
    console.error("getCompanyDocuments error:", error);
    res.status(500).json({
      error: "Failed to fetch documents",
      details: error.message,
    });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const { companyId, category, status, transactionId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }


    const filePath = `/uploads/documents/${req.file.filename}`;

    if (!filePath) {
      return res.status(400).json({ error: "File path is missing" });
    }

    const membership = await pool.query(
      `
      SELECT role
      FROM user_companies
      WHERE user_id = $1 AND company_id = $2
      LIMIT 1
      `,
      [req.user.id, companyId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        error: "You do not have access to this company",
      });
    }

    const role = membership.rows[0].role;

    if (!["admin", "staff"].includes(role)) {
      return res.status(403).json({
        error: "You do not have permission to upload documents",
      });
    }
    const result = await pool.query(
      `
      INSERT INTO company_documents (
        company_id,
        transaction_id,
        original_name,
        file_name,
        file_path,
        file_size,
        mime_type,
        category,
        status,
        uploaded_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
      `,
      [
        companyId,
        transactionId || null,
        req.file.originalname,
        req.file.filename,
        filePath,
        req.file.size,
        req.file.mimetype,
        category || "General",
        status || "Active",
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      message: "Document uploaded successfully",
      document: result.rows[0],
    });
  } catch (error) {
    console.error("uploadDocument error:", error);
    res.status(500).json({
      error: "Failed to upload document",
      details: error.message,
    });
  }
};

exports.linkDocumentToTransaction = async (req, res) => {
  try {
    const documentId = req.params.id;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        error: "Transaction ID is required",
      });
    }

    const documentCheck = await pool.query(
      `
      SELECT id, company_id
      FROM company_documents d
      WHERE id = $1
      LIMIT 1
      `,
      [documentId]
    );

    if (documentCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    const document = documentCheck.rows[0];

    const transactionCheck = await pool.query(
      `
      SELECT id, company_id
      FROM transactions
      WHERE id = $1
      LIMIT 1
      `,
      [transactionId]
    );

    if (transactionCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Transaction not found",
      });
    }

    const transaction = transactionCheck.rows[0];

    if (Number(document.company_id) !== Number(transaction.company_id)) {
      return res.status(400).json({
        error: "Document and transaction must belong to the same company",
      });
    }

    const result = await pool.query(
      `
      UPDATE company_documents
      SET transaction_id = $1
      WHERE id = $2
      RETURNING *
      `,
      [transactionId, documentId]
    );

    return res.json({
      message: "Document linked successfully",
      document: result.rows[0],
    });
  } catch (error) {
    console.error("linkDocumentToTransaction error:", error);
    return res.status(500).json({
      error: "Failed to link document to transaction",
    });
  }
};

exports.unlinkDocumentFromTransaction = async (req, res) => {
  try {
    const documentId = req.params.id;

    if (!req.document) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    if (!req.document.transaction_id) {
      return res.status(400).json({
        error: "Document is not linked to any transaction",
      });
    }

    const result = await pool.query(
      `
      UPDATE company_documents
      SET transaction_id = NULL
      WHERE id = $1
      RETURNING *
      `,
      [documentId]
    );

    return res.json({
      message: "Document unlinked successfully",
      document: result.rows[0],
    });
  } catch (error) {
    console.error("unlinkDocumentFromTransaction error:", error);
    return res.status(500).json({
      error: "Failed to unlink document",
    });
  }
};

exports.getUnlinkedDocumentsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM company_documents d
      WHERE company_id = $1
        AND transaction_id IS NULL
      ORDER BY created_at DESC
      `,
      [companyId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("getUnlinkedDocumentsByCompany error:", error);
    return res.status(500).json({
      error: "Failed to fetch unlinked documents",
    });
  }
};

exports.getDocumentsByTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transactionCheck = await pool.query(
      `
      SELECT id, company_id
      FROM transactions
      WHERE id = $1
      LIMIT 1
      `,
      [transactionId]
    );

    if (transactionCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Transaction not found",
      });
    }

    const transaction = transactionCheck.rows[0];

    // 🔐 Verify user belongs to this company
    const membership = await pool.query(
      `
      SELECT role
      FROM user_companies
      WHERE user_id = $1 AND company_id = $2
      LIMIT 1
      `,
      [req.user.id, transaction.company_id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM company_documents d
      WHERE transaction_id = $1
      ORDER BY created_at DESC
      `,
      [transactionId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("getDocumentsByTransaction error:", error);
    return res.status(500).json({
      error: "Failed to fetch documents for transaction",
    });
  }
};

exports.bulkLinkDocuments = async (req, res) => {
  try {
    const { documentIds, transactionId } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        error: "documentIds must be a non-empty array",
      });
    }

    if (!transactionId) {
      return res.status(400).json({
        error: "transactionId is required",
      });
    }

    const cleanedDocumentIds = [
      ...new Set(
        documentIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    ];

    if (cleanedDocumentIds.length === 0) {
      return res.status(400).json({
        error: "documentIds must contain valid numeric document IDs",
      });
    }

    const numericTransactionId = Number(transactionId);

    if (!Number.isInteger(numericTransactionId) || numericTransactionId <= 0) {
      return res.status(400).json({
        error: "transactionId must be a valid numeric ID",
      });
    }

    const transactionCheck = await pool.query(
      `
      SELECT id, company_id
      FROM transactions
      WHERE id = $1
      LIMIT 1
      `,
      [numericTransactionId]
    );

    if (transactionCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Transaction not found",
      });
    }

    const transaction = transactionCheck.rows[0];
    const companyId = Number(transaction.company_id);

    const membershipCheck = await pool.query(
      `
      SELECT role
      FROM user_companies
      WHERE user_id = $1 AND company_id = $2
      LIMIT 1
      `,
      [req.user.id, companyId]
    );

    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({
        error: "You do not have access to this company",
      });
    }

    const userRole = membershipCheck.rows[0].role;

    if (!["admin", "staff"].includes(userRole)) {
      return res.status(403).json({
        error: "You do not have permission to bulk link documents",
      });
    }

    const documentsCheck = await pool.query(
      `
      SELECT id, company_id
      FROM company_documents d
      WHERE id = ANY($1::int[])
      `,
      [cleanedDocumentIds]
    );

    if (documentsCheck.rows.length !== cleanedDocumentIds.length) {
      return res.status(404).json({
        error: "One or more documents were not found",
      });
    }

    const invalidCompanyDoc = documentsCheck.rows.find(
      (doc) => Number(doc.company_id) !== companyId
    );

    if (invalidCompanyDoc) {
      return res.status(400).json({
        error:
          "All selected documents must belong to the same company as the transaction",
      });
    }

    const result = await pool.query(
      `
      UPDATE company_documents
      SET transaction_id = $1
      WHERE id = ANY($2::int[])
      RETURNING *
      `,
      [numericTransactionId, cleanedDocumentIds]
    );

    return res.json({
      message: "Documents linked successfully",
      documents: result.rows,
    });
  } catch (error) {
    console.error("bulkLinkDocuments error:", error);
    return res.status(500).json({
      error: "Failed to bulk link documents",
    });
  }
};

exports.getUnlinkedDocumentsSummary = async (req, res) => {
  const { companyId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_documents,
        COUNT(*) FILTER (WHERE transaction_id IS NULL)::int AS unlinked_count,
        COUNT(*) FILTER (WHERE transaction_id IS NOT NULL)::int AS linked_count
      FROM company_documents d
      WHERE company_id = $1
      `,
      [companyId]
    );

    const row = result.rows[0] || {};

    return res.json({
      companyId: Number(companyId),
      totalDocuments: row.total_documents || 0,
      unlinkedCount: row.unlinked_count || 0,
      linkedCount: row.linked_count || 0,
    });
  } catch (error) {
    console.error("getUnlinkedDocumentsSummary error:", error);
    return res.status(500).json({
      error: "Failed to fetch document summary",
    });
  }
};

exports.deleteDocument = async (req, res) => {
  const document = req.document;

  try {
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.file_path) {
      const relativePath = document.file_path.replace(/^\/+/, "");
      const absolutePath = path.join(__dirname, "../../", relativePath);

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    await pool.query(`DELETE FROM company_documents WHERE id = $1`, [
      document.id,
    ]);

    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("deleteDocument error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
};
// ===============================
// AUDIT READINESS SCORING
// ===============================
// ===============================
// AUDIT READINESS SCORING
// ===============================
exports.getAuditReadiness = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        COUNT(DISTINCT t.id)::int AS total_transactions,
        COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN t.id END)::int AS linked_transactions,
        COUNT(DISTINCT CASE WHEN d.id IS NULL THEN t.id END)::int AS unlinked_transactions
      FROM transactions t
      LEFT JOIN company_documents d
        ON d.transaction_id = t.id
      WHERE t.company_id = $1
      `,
      [companyId]
    );

    const row = result.rows[0] || {};

    const totalTransactions = Number(row.total_transactions || 0);
    const linkedTransactions = Number(row.linked_transactions || 0);
    const unlinkedTransactions = Number(row.unlinked_transactions || 0);

    const auditScore =
      totalTransactions === 0
        ? 100
        : Math.round((linkedTransactions / totalTransactions) * 100);

    let auditStatus = "No Activity";
    let auditColor = "gray";

    if (totalTransactions > 0 && auditScore >= 90) {
      auditStatus = "Audit Ready";
      auditColor = "green";
    } else if (totalTransactions > 0 && auditScore >= 70) {
      auditStatus = "Needs Review";
      auditColor = "amber";
    } else if (totalTransactions > 0) {
      auditStatus = "High Risk";
      auditColor = "red";
    }

    return res.json({
      companyId: Number(companyId),
      totalTransactions,
      linkedTransactions,
      unlinkedTransactions,
      missingDocuments: unlinkedTransactions,
      auditScore,
      score: auditScore,
      auditStatus,
      auditColor,
    });
  } catch (error) {
    console.error("getAuditReadiness error:", error);
    return res.status(500).json({
      error: "Failed to calculate audit readiness",
    });
  }
};