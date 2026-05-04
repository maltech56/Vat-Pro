const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const reportController = require("../controllers/reportController");

router.get(
  "/company/:companyId/summary",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  reportController.getSummaryReport
);

router.get(
  "/company/:companyId/sales",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  reportController.getSalesReport
);

router.get(
  "/company/:companyId/purchases",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  reportController.getPurchasesReport
);

router.get(
  "/company/:companyId/transactions",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  reportController.getTransactionsReport
  
);

router.get(
  "/company/:companyId/export/csv",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  reportController.exportTransactionsCsv
);

module.exports = router;