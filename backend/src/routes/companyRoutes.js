const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const authMiddleware = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

// Create company
router.post("/", authMiddleware, companyController.createCompany);

// Get companies for logged-in user
router.get("/user", authMiddleware, companyController.getUserCompanies);

// Get company settings
router.get(
  "/:companyId/settings",
  authMiddleware,
  requireRole("admin", "staff", "viewer", "auditor"),
  companyController.getCompanySettings
);

// Update company settings
router.put(
  "/:companyId/settings",
  authMiddleware,
  requireRole("admin"),
  companyController.updateCompanySettings
);

// Optional: get single company by id
router.get(
  "/:companyId",
  authMiddleware,
  requireRole("admin", "staff", "viewer", "auditor"),
  companyController.getCompanyById
);

module.exports = router;