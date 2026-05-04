const pool = require("../config/db");

module.exports = (...allowedRoles) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const companyId =
      req.companyId ||
      req.params.companyId ||
      req.body.companyId ||
      req.query.companyId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    try {
      const result = await pool.query(
        `
        SELECT role
        FROM user_companies
        WHERE user_id = $1 AND company_id = $2
        LIMIT 1
        `,
        [userId, companyId]
      );

      if (result.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied for this company" });
      }

      const userRole = result.rows[0].role;

      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(userRole)
      ) {
        return res.status(403).json({
          error: "You do not have permission to perform this action",
        });
      }

      req.userCompanyRole = userRole;
      next();
    } catch (error) {
      console.error("companyAccess error:", error);
      res.status(500).json({ error: "Server error validating company access" });
    }
  };
};