const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const authLimiter = require("../middleware/rateLimiter");

router.put("/change-password", authMiddleware, authController.changePassword);
router.post("/login", authLimiter, authController.login);


module.exports = router;