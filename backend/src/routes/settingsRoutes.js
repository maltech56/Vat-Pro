const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyAccess = require("../middleware/companyAccess");
const settingsController = require("../controllers/settingsController");

router.get(
  "/company/:companyId",
  authMiddleware,
  companyAccess("admin", "staff", "viewer", "auditor"),
  settingsController.getSettings
);

router.put(
  "/company/:companyId",
  authMiddleware,
  companyAccess("admin"),
  settingsController.updateSettings
);

module.exports = router;