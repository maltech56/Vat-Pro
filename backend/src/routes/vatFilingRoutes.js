const express = require("express");
const router = express.Router();

const {
  saveVatFiling,
  getFilingsByCompany,
  exportFilingsCsv,
  getFilingById,
  getFilingPdf,
  getFilingPackPdf,
  getFilingPackSummary,
  updateFilingStatus,
  lockFiling,
  deleteFiling,
} = require("../controllers/vatFilingController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/save", authMiddleware, saveVatFiling);
router.get("/company/:companyId", authMiddleware, getFilingsByCompany);
router.get("/company/:companyId/export-csv", authMiddleware, exportFilingsCsv);

router.get("/:filingId/filing-pack-summary", authMiddleware, getFilingPackSummary);
router.get("/:filingId/filing-pack", authMiddleware, getFilingPackPdf);
router.get("/:filingId/pdf", authMiddleware, getFilingPdf);
router.get("/:filingId", authMiddleware, getFilingById);

router.patch("/:filingId/status", authMiddleware, updateFilingStatus);
router.patch(
  "/:filingId/lock",
  authMiddleware,
  lockFiling
);
router.delete("/:filingId", authMiddleware, deleteFiling);

module.exports = router;