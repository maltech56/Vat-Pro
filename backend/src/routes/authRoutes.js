const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const authLimiter = require("../middleware/rateLimiter");

router.post("/register", authController.register);

router.post(
  "/login",
  (req, res, next) => {
    console.log("LOGIN ROUTE HIT");
    next();
  },
  authLimiter,
  authController.login
);

router.post(
  "/forgot-password",
  authLimiter,
  authController.forgotPassword
);

router.post(
  "/reset-password",
  authLimiter,
  authController.resetPassword
);

router.put(
  "/change-password",
  authMiddleware,
  authController.changePassword
);

module.exports = router;