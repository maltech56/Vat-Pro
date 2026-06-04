const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const authLimiter = require("../middleware/rateLimiter");

router.post("/register", authController.register);

router.post(
  "/login",
  authLimiter,
  authController.login
);

router.put(
  "/change-password",
  authMiddleware,
  authController.changePassword
);

module.exports = router;