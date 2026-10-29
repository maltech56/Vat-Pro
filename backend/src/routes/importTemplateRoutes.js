
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const importTemplateAccess = require("../middleware/importTemplateAccess");
const importTemplateController = require("../controllers/importTemplateController");

// List templates for an authorized company
router.get(
  "/",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  importTemplateController.getCompanyTemplates
);

// Create template
router.post(
  "/",
  authMiddleware,
  companyAccess("admin", "staff"),
  importTemplateController.createTemplate
);

// Detect matching template
router.post(
  "/detect",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  importTemplateController.detectTemplate
);

// Update template owned by an authorized company
router.put(
  "/:id",
  authMiddleware,
  importTemplateAccess,
  companyAccess("admin", "staff"),
  importTemplateController.updateTemplate
);

// Delete template owned by an authorized company
router.delete(
  "/:id",
  authMiddleware,
  importTemplateAccess,
  companyAccess("admin", "staff"),
  importTemplateController.deleteTemplate
);

module.exports = router;
