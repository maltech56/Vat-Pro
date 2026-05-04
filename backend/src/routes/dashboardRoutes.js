const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

// Overview
router.get(
  "/company/:companyId/overview",
  authMiddleware,
  requireRole("admin", "staff", "viewer", "auditor"),
  dashboardController.getOverview
);

// Monthly VAT
router.get(
  "/company/:companyId/monthly-vat",
  authMiddleware,
  requireRole("admin", "staff", "viewer", "auditor"),
  dashboardController.getMonthlyVAT
);

// Classification breakdown
router.get(
  "/company/:companyId/classification-breakdown",
  authMiddleware,
  requireRole("admin", "staff", "viewer", "auditor"),
  dashboardController.getClassificationBreakdown
);

module.exports = router;