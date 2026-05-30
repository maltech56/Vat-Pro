const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  connectQuickBooks,
  quickBooksCallback,
  disconnectQuickBooks,
} = require("../controllers/quickbooksController");

router.get(
  "/connect",
  authMiddleware,
  connectQuickBooks
);
router.get("/callback", quickBooksCallback); // NO auth middleware

router.post(
  "/disconnect",
  authMiddleware,
  disconnectQuickBooks
);

module.exports = router;