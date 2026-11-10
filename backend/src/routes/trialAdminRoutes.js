const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const requireSystemAdmin = require("../middleware/requireSystemAdmin");

router.post(
  "/companies/:companyId/extend-trial",
  authMiddleware,
  requireSystemAdmin,
  async (req, res) => {
    const companyId = Number(req.params.companyId);

    if (!Number.isSafeInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ error: "Invalid company ID" });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT id, subscription_status, trial_end_date,
                trial_extension_count
         FROM companies
         WHERE id = $1
         FOR UPDATE`,
        [companyId]
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Company not found" });
      }

      const company = result.rows[0];

      if (
        String(company.subscription_status).toUpperCase() !== "TRIAL" ||
        !company.trial_end_date
      ) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Company is not eligible for trial extension"
        });
      }

      if (company.trial_extension_count !== 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Trial extension already granted"
        });
      }

      const updated = await client.query(
        `UPDATE companies
         SET trial_end_date =
               GREATEST(trial_end_date, NOW()) + INTERVAL '30 days',
             trial_extension_count = trial_extension_count + 1
         WHERE id = $1
         RETURNING trial_end_date`,
        [companyId]
      );

      await client.query(
        `INSERT INTO trial_extension_audit
         (company_id, approved_by,
          previous_trial_end_date, new_trial_end_date)
         VALUES ($1, $2, $3, $4)`,
        [
          companyId,
          req.user.id,
          company.trial_end_date,
          updated.rows[0].trial_end_date
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        companyId,
        extensionDays: 30,
        trialEnds: updated.rows[0].trial_end_date
      });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Trial extension rollback error:", rollbackError);
        }
      }

      console.error("Trial extension error:", error);

      return res.status(500).json({
        error: "Unable to extend trial"
      });
    } finally {
      if (client) client.release();
    }
  }
);

module.exports = router;
