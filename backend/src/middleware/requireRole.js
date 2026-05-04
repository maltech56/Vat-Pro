const pool = require("../config/db");

module.exports = (...allowedRoles) => {
  return async (req, res, next) => {
    const userId = req.user.id;
    const companyId = req.params.companyId || req.body.companyId;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      const result = await pool.query(
        `SELECT role
         FROM user_companies
         WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: "Access denied for this company" });
      }

      const userRole = result.rows[0].role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      req.companyRole = userRole;
      next();
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: "Server error" });
    }
  };
};