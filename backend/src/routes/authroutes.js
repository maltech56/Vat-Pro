const express = require("express");
const router = express.Router();
const authController = require("../controllers/authcontroller");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/login", authController.login);
router.put("/change-password", authMiddleware, authController.changePassword);


module.exports = router;