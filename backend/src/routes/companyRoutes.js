const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const authMiddleware = require("../middleware/auth");

// Create company
router.post("/", authMiddleware, companyController.createCompany);

// Get companies for logged-in user
router.get("/user", authMiddleware, companyController.getUserCompanies);

// Get company settings
router.get(
  "/:companyId/settings",
  authMiddleware,
  companyController.getCompanySettings
);

// Update company settings
router.put(
  "/:companyId/settings",
  authMiddleware,
  companyController.updateCompanySettings
);

// Optional: get single company by id
router.get("/:companyId", authMiddleware, companyController.getCompanyById);

module.exports = router;