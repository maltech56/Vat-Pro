const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const documentAccessById = require("../middleware/documentAccessById");
const upload = require("../middleware/documentUploadMiddleware");
const documentController = require("../controllers/documentController");

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
  "/upload",
  authMiddleware,
  upload.single("file"),
  companyAccess("admin", "staff"),
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

router.delete(
  "/:id",
  authMiddleware,
  documentAccessById,
  companyAccess("admin"),
  documentController.deleteDocument
);

module.exports = router;