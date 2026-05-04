const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const importBatchController = require("../controllers/importBatchController");

router.get(
  "/company/:companyId",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  importBatchController.getCompanyImportBatches
);

router.get(
  "/:id",
  authMiddleware,
  importBatchController.getImportBatchById
);

router.post(
  "/",
  authMiddleware,
  companyAccess("admin", "staff"),
  importBatchController.createImportBatch
);

router.post(
  "/:id/undo",
  authMiddleware,
  importBatchController.undoImportBatch
);

module.exports = router;