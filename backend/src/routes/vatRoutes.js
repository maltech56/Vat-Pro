const express = require("express");
const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const companyAccess =
  require("../middleware/companyAccess");

const {
  getVatSummary,
} = require("../controllers/vatController");

router.get(
  "/summary/:companyId",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  getVatSummary
);

module.exports = router;