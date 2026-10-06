const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireSystemAdmin = require("../middleware/requireSystemAdmin");
const leadController = require("../controllers/leadController");

router.get(
  "/",
  authMiddleware,
  requireSystemAdmin,
  leadController.getLeads
);

router.put(
  "/:id/status",
  authMiddleware,
  requireSystemAdmin,
  leadController.updateLeadStatus
);

router.put(
  "/:id/notes",
  authMiddleware,
  requireSystemAdmin,
  leadController.updateLeadNotes
);

module.exports = router;