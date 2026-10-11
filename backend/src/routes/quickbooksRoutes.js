const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");

const {
  connectQuickBooks,
  quickBooksCallback,
  disconnectQuickBooks,
  getQuickBooksStatus,
  getQuickBooksCompanyInfo,
  getQuickBooksCustomers,
  getQuickBooksVendors,
  getQuickBooksInvoices,
  getQuickBooksBills,

  importQuickBooksCustomers,
  importQuickBooksVendors,
  importQuickBooksInvoices,
  importQuickBooksBills,

} = require("../controllers/quickbooksController");

router.get(
  "/connect",
  authMiddleware,
  companyAccess("admin", "staff"),
  connectQuickBooks
);

// Intuit redirects here after authorization.
// This callback cannot use the normal JWT middleware.
// OAuth state validation is handled separately in the callback.
router.get("/callback", quickBooksCallback);

router.get(
  "/status/:companyId",
  authMiddleware,
  companyAccess(),
  getQuickBooksStatus
);

router.get(
  "/customers/:companyId",
  authMiddleware,
  companyAccess(),
  getQuickBooksCustomers
);

router.get(
  "/vendors/:companyId",
  authMiddleware,
  companyAccess(),
  getQuickBooksVendors
);

router.get(
  "/invoices/:companyId",
  authMiddleware,
  companyAccess(),
  getQuickBooksInvoices
);

router.get(
  "/bills/:companyId",
  authMiddleware,
  companyAccess(),
  getQuickBooksBills
);

router.get(
  "/company-info/:companyId",
  authMiddleware,
  companyAccess(),
  getQuickBooksCompanyInfo
);

router.post(
  "/disconnect",
  authMiddleware,
  companyAccess("admin", "staff"),
  disconnectQuickBooks
);

router.post(
  "/import-customers/:companyId",
  authMiddleware,
  companyAccess("admin", "staff"),
  importQuickBooksCustomers
);

router.post(
  "/import-vendors/:companyId",
  authMiddleware,
  companyAccess("admin", "staff"),
  importQuickBooksVendors
);

router.post(
  "/import-invoices/:companyId",
  authMiddleware,
  companyAccess("admin", "staff"),
  importQuickBooksInvoices
);

router.post(
  "/import-bills/:companyId",
  authMiddleware,
  companyAccess("admin", "staff"),
  importQuickBooksBills
);

module.exports = router;