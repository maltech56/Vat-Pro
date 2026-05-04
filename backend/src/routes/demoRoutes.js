const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const demoController = require("../controllers/demoController");

router.post("/seed", authMiddleware, demoController.seedDemoData);

module.exports = router;