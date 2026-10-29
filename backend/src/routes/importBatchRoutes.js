const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const importBatchAccess = require("../middleware/importBatchAccess");
const importBatchController = require("../controllers/importBatchController");

// List company import batches
router.get(
  "/company/:companyId",
  authMiddleware,
  companyAccess("admin", "staff", "auditor"),
  importBatchController.getCompanyImportBatches
);

// View an import batch
router.get(
  "/:id",
  authMiddleware,
  importBatchAccess,
  companyAccess("admin", "staff", "auditor"),
  importBatchController.getImportBatchById
);

// Create an import batch
router.post(
  "/",
  authMiddleware,
  companyAccess("admin", "staff"),
  importBatchController.createImportBatch
);

// Undo an imported batch
router.post(
  "/:id/undo",
  authMiddleware,
  importBatchAccess,
  companyAccess("admin", "staff"),
  importBatchController.undoImportBatch
);

module.exports = router;
