const pool = require("../config/db");

module.exports = async function requireSystemAdmin(req, res, next) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: "Unauthorized: missing user",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT is_system_admin
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Unauthorized user",
      });
    }

    if (result.rows[0].is_system_admin !== true) {
      return res.status(403).json({
        error: "System administrator access required",
      });
    }

    next();
  } catch (error) {
    console.error("requireSystemAdmin error:", error.message);

    return res.status(500).json({
      error: "Server error",
    });
  }
};