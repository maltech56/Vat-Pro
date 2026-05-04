const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const transactionController = require("../controllers/transactionController");
const requireRole = require("../middleware/requireRole");

router.post(
  "/",
  authMiddleware,
  requireRole("admin", "staff"),
  transactionController.createTransaction
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("admin", "staff"),
  transactionController.updateTransaction
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
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