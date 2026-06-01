const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

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
  connectQuickBooks
);
router.get("/callback", quickBooksCallback); // NO auth middleware

router.get(
  "/status/:companyId",
  authMiddleware,
  getQuickBooksStatus
);

router.get(
  "/customers/:companyId",
  authMiddleware,
  getQuickBooksCustomers
);

router.get(
  "/vendors/:companyId",
  authMiddleware,
  getQuickBooksVendors
);

router.get(
  "/invoices/:companyId",
  authMiddleware,
  getQuickBooksInvoices
);

router.get(
  "/bills/:companyId",
  authMiddleware,
  getQuickBooksBills
);

router.get(
  "/company-info/:companyId",
  authMiddleware,
  getQuickBooksCompanyInfo
);

router.post(
  "/disconnect",
  authMiddleware,
  disconnectQuickBooks
);

router.post(
  "/import-customers/:companyId",
  authMiddleware,
  importQuickBooksCustomers
);

router.post(
  "/import-vendors/:companyId",
  authMiddleware,
  importQuickBooksVendors
);

router.post(
  "/import-invoices/:companyId",
  authMiddleware,
  importQuickBooksInvoices
);

router.post(
  "/import-bills/:companyId",
  authMiddleware,
  importQuickBooksBills
);

module.exports = router;