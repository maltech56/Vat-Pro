const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const documentAccessById = require("../middleware/documentAccessById");
const upload = require("../middleware/documentUploadMiddleware");
const documentController = require("../controllers/documentController");
const validateDocumentContent = require("../middleware/validateDocumentContent");

router.get(
  "/company/:companyId/audit-readiness",
  authMiddleware,
  companyAccess("admin", "staff", "auditor"),
  documentController.getAuditReadiness
);

router.get(
  "/company/:companyId",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  documentController.getCompanyDocuments
);

router.get(
  "/company/:companyId/unlinked",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  documentController.getUnlinkedDocumentsByCompany
);

router.get(
  "/company/:companyId/unlinked-summary",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  documentController.getUnlinkedDocumentsSummary
);

router.get(
  "/transaction/:transactionId",
  authMiddleware,
  documentController.getDocumentsByTransaction
);


router.post(
  "/company/:companyId/upload",
  authMiddleware,
  companyAccess("admin", "staff"),
  upload.single("file"),
  validateDocumentContent,
  (req, res, next) => {
    req.body.companyId = req.params.companyId;
    next();
  },
  documentController.uploadDocument
);


router.patch(
  "/:id/link-transaction",
  authMiddleware,
  documentAccessById,
  companyAccess("admin", "staff"),
  documentController.linkDocumentToTransaction
);

router.patch(
  "/:id/unlink-transaction",
  authMiddleware,
  documentAccessById,
  companyAccess("admin", "staff"),
  documentController.unlinkDocumentFromTransaction
);

router.patch(
  "/bulk-link",
  authMiddleware,
  documentController.bulkLinkDocuments
);

router.get(
  "/:id/download",
  authMiddleware,
  documentAccessById,
  companyAccess("admin", "staff", "viewer", "auditor"),
  documentController.downloadDocument
);

router.delete(
  "/:id",
  authMiddleware,
  documentAccessById,
  companyAccess("admin"),
  documentController.deleteDocument
);

module.exports = router;