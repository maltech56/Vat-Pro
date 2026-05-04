const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/importUploadMiddleware");
const uploadImportFile = require("../middleware/importFileUpload");
const importController = require("../controllers/importController");

// PDF OCR preview
router.post(
  "/pdf-ocr",
  authMiddleware,
  upload.single("file"),
  importController.importPdfForReview
);

// CSV / Excel upload preview
router.post(
  "/upload",
  authMiddleware,
  uploadImportFile.single("file"),
  importController.uploadAndPreviewImport
);

// Confirm staged import
router.post(
  "/confirm",
  authMiddleware,
  importController.confirmImport
);

module.exports = router;