const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  connectQuickBooks,
  quickBooksCallback,
  disconnectQuickBooks,
  getQuickBooksStatus,
  getQuickBooksCompanyInfo,
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

module.exports = router;