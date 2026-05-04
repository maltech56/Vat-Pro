const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const importTemplateController = require("../controllers/importTemplateController");

router.get(
  "/",
  authMiddleware,
  importTemplateController.getCompanyTemplates
);

router.post(
  "/",
  authMiddleware,
  companyAccess("admin", "staff"),
  importTemplateController.createTemplate
);

router.post(
  "/detect",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  importTemplateController.detectTemplate
);

router.put(
  "/:id",
  authMiddleware,
  companyAccess("admin", "staff"),
  importTemplateController.updateTemplate
);

router.delete(
  "/:id",
  authMiddleware,
  companyAccess("admin", "staff"),
  importTemplateController.deleteTemplate
);

module.exports = router;