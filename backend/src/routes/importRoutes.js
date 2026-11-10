const requireActiveSubscription = require("../middleware/requireActiveSubscription");
const pool = require("../config/db");

async function checkImportSubscription(req, res, next) {
  const batchId = Number(req.body?.batchId);

  if (!Number.isSafeInteger(batchId) || batchId <= 0) {
    return res.status(400).json({ error: "Invalid batch ID" });
  }

  try {
    const result = await pool.query(
      "SELECT company_id FROM import_batches WHERE id = $1",
      [batchId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Import batch not found" });
    }

    req.companyId = result.rows[0].company_id;
    return requireActiveSubscription(req, res, next);
  } catch (error) {
    console.error("Import subscription check:", error);
    return res.status(500).json({
      error: "Unable to validate import subscription"
    });
  }
}
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const upload = require("../middleware/importUploadMiddleware");
const validatePdfContent = require("../middleware/validatePdfContent");
const validateDocumentContent = require("../middleware/validateDocumentContent");
const uploadImportFile = require("../middleware/importFileUpload");
const importController = require("../controllers/importController");

// PDF OCR preview
router.post(
  "/company/:companyId/pdf-ocr",
  authMiddleware,
  companyAccess("admin", "staff"),
  upload.single("file"),
  validatePdfContent,
  (req, res, next) => {
    req.body.companyId = req.params.companyId;
    next();
  },
  importController.importPdfForReview
);

// CSV / Excel upload preview
router.post(
  "/company/:companyId/upload",
  authMiddleware,
  companyAccess("admin", "staff"),
  uploadImportFile.single("file"),
  validateDocumentContent, (req, res, next) => {
    req.body.companyId = req.params.companyId;
    next();
  },
  importController.uploadAndPreviewImport
);

// Confirm staged import
// The controller verifies access using the batch's actual company_id.
router.post(
  "/confirm",
  authMiddleware,
    checkImportSubscription,
  importController.confirmImport
);

module.exports = router;
