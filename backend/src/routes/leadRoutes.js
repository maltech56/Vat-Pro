const express = require("express");
const router = express.Router();

const leadController = require("../controllers/leadController");

router.get("/", leadController.getLeads);

router.put(
  "/:id/status",
  leadController.updateLeadStatus
);

router.put(
  "/:id/notes",
  leadController.updateLeadNotes
);

module.exports = router;