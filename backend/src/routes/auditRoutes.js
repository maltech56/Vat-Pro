const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const auditController = require("../controllers/auditController");

router.get(
  "/company/:companyId/dashboard",
  authMiddleware,
  companyAccess("admin", "staff", "auditor"),
  auditController.getAuditDashboard
);

module.exports = router;