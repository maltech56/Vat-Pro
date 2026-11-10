const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const transactionController = require("../controllers/transactionController");
const requireRole = require("../middleware/requireRole");
const pool = require("../config/db");
const requireActiveSubscription = require("../middleware/requireActiveSubscription");

async function resolveTransactionCompany(req, res, next) {
  try {
    if (req.method === "POST") {
      req.companyId = req.body?.companyId;
    } else {
      const result = await pool.query(
        "SELECT company_id FROM transactions WHERE id = $1",
        [req.params.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      req.companyId = result.rows[0].company_id;
    }

    return requireActiveSubscription(req, res, next);
  } catch (error) {
    console.error("Transaction subscription check:", error);
    return res.status(500).json({
      error: "Unable to validate transaction subscription"
    });
  }
}

router.post(
  "/",
  authMiddleware,
  requireRole("admin", "staff"),
  resolveTransactionCompany,
  transactionController.createTransaction
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("admin", "staff"),
  resolveTransactionCompany,
  transactionController.updateTransaction
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  resolveTransactionCompany,
  transactionController.deleteTransaction
);

router.get(
  "/company/:companyId/recent",
  authMiddleware,
  requireRole("admin", "staff", "auditor"),
  transactionController.getRecentTransactions
);
router.get(
  "/company/:companyId/vat-summary",
  authMiddleware,
  requireRole("admin", "staff", "auditor"),
  transactionController.getVatSummary
);
router.get(
  "/company/:companyId/vat-return-pdf",
  authMiddleware,
  requireRole("admin", "staff", "auditor"),
  transactionController.generateVatReturnPdf
);
router.get(
  "/company/:companyId",
  authMiddleware,
  requireRole("admin", "staff", "auditor"),
  transactionController.getCompanyTransactions
);

module.exports = router;