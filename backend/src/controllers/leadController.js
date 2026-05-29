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