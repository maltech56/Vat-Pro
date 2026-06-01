const express = require("express");
const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const {
  getVatSummary,
} = require("../controllers/vatController");

router.get(
  "/summary/:companyId",
  authMiddleware,
  getVatSummary
);

module.exports = router;