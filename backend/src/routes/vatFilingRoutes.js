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
const companyAccess = require("../middleware/companyAccess");
const filingAccessById = require("../middleware/filingAccessById");

router.post(
  "/save",
  authMiddleware,
  companyAccess("admin", "staff"),
  saveVatFiling
);

router.get(
  "/company/:companyId",
  authMiddleware,
  companyAccess("admin", "staff", "auditor"),
  getFilingsByCompany
);

router.get(
  "/company/:companyId/export-csv",
  authMiddleware,
  companyAccess("admin", "staff", "auditor"),
  exportFilingsCsv
);

router.get(
  "/:filingId/filing-pack-summary",
  authMiddleware,
  filingAccessById,
  companyAccess("admin", "staff", "auditor"),
  getFilingPackSummary
);

router.get(
  "/:filingId/filing-pack",
  authMiddleware,
  filingAccessById,
  companyAccess("admin", "staff", "auditor"),
  getFilingPackPdf
);

router.get(
  "/:filingId/pdf",
  authMiddleware,
  filingAccessById,
  companyAccess("admin", "staff", "auditor"),
  getFilingPdf
);

router.get(
  "/:filingId",
  authMiddleware,
  filingAccessById,
  companyAccess("admin", "staff", "auditor"),
  getFilingById
);

router.patch(
  "/:filingId/status",
  authMiddleware,
  filingAccessById,
  companyAccess("admin", "staff"),
  updateFilingStatus
);

router.patch(
  "/:filingId/lock",
  authMiddleware,
  filingAccessById,
  companyAccess("admin"),
  lockFiling
);

router.delete(
  "/:filingId",
  authMiddleware,
  filingAccessById,
  companyAccess("admin"),
  deleteFiling
);

module.exports = router;