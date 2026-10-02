const pool = require("../config/db");

module.exports = (...allowedRoles) => {
  return async (req, res, next) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: missing user" });
    }

    try {
      let companyId = req.params?.companyId || req.body?.companyId;

      // Transaction routes such as DELETE /transactions/:id
      // contain a transaction ID rather than a company ID.
      if (!companyId && req.params?.id) {
        const transactionResult = await pool.query(
          `
          SELECT company_id
          FROM transactions
          WHERE id = $1
          `,
          [req.params.id]
        );

        if (transactionResult.rows.length === 0) {
          return res.status(404).json({ error: "Transaction not found" });
        }

        companyId = transactionResult.rows[0].company_id;
      }

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const result = await pool.query(
        `
        SELECT role
        FROM user_companies
        WHERE user_id = $1
          AND company_id = $2
        `,
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
      req.companyId = companyId;

      next();
    } catch (err) {
      console.error("requireRole error:", err.message);
      return res.status(500).json({ error: "Server error" });
    }
  };
};