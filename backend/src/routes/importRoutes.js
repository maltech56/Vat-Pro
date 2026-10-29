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
  importController.confirmImport
);

module.exports = router;
