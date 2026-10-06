const pool = require("../config/db");

exports.getLeads = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM demo_requests
      ORDER BY created_at DESC
    `);

    res.status(200).json(result.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load leads",
    });

  }
};

exports.updateLeadStatus = async (req, res) => {

  try {

    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      `
      UPDATE demo_requests
      SET status = $1
      WHERE id = $2
      `,
      [status, id]
    );

    await pool.query(
      `
  INSERT INTO lead_activities
  (
    lead_id,
    activity_type,
    description
  )
  VALUES ($1, $2, $3)
  `,
      [
        id,
        "STATUS_CHANGE",
        `Status changed to ${status}`
      ]
    );

    res.json({
      success: true,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update status",
    });

  }

};
exports.updateLeadNotes = async (req, res) => {
  try {
    const { id } = req.params;

    const notes =
      req.body.notes ?? null;

    const next_followup =
      req.body.next_followup ?? null;

    const updateResult = await pool.query(
      `
      UPDATE demo_requests
      SET
        notes = COALESCE($1, notes),
        next_followup = COALESCE($2, next_followup)
      WHERE id = $3
      RETURNING id
      `,
      [
        notes,
        next_followup,
        id,
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    console.log(
      "LOGGING NOTES UPDATE:",
      id
    );

    await pool.query(
      `
      INSERT INTO lead_activities
      (
        lead_id,
        activity_type,
        description
      )
      VALUES ($1, $2, $3)
      `,
      [
        id,
        "NOTES_UPDATE",
        "Lead notes updated",
      ]
    );

    return res.json({
      success: true,
    });

  } catch (error) {
    console.error(
      "UPDATE LEAD NOTES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update notes",
    });
  }
};