const express = require("express");
const router = express.Router();
const pool = require("../config/db");

console.log("✅ ACTIVITY ROUTES LOADED");

router.get("/test", (req, res) => {
  res.json({
    success: true,
    route: "activityRoutes working"
  });
});

router.get("/:leadId", async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT *
      FROM lead_activities
      WHERE lead_id = $1
      ORDER BY created_at DESC
      `,
      [req.params.leadId]
    );

    res.json(result.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
    });

  }

});

module.exports = router;