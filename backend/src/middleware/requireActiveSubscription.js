const pool = require("../config/db");

module.exports = async function requireActiveSubscription(req, res, next) {
  const companyId = req.companyId || req.params?.companyId;

  if (!req.user?.id || !companyId) {
    return res.status(403).json({
      code: "COMPANY_ACCESS_REQUIRED",
      error: "Verified company access is required"
    });
  }

  try {
    const result = await pool.query(
      `SELECT c.subscription_status, c.trial_end_date
       FROM companies c
       JOIN user_companies uc ON uc.company_id = c.id
       WHERE c.id = $1 AND uc.user_id = $2`,
      [companyId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(403).json({
        code: "COMPANY_ACCESS_DENIED",
        error: "Company access denied"
      });
    }

    const company = result.rows[0];
    const status = String(company.subscription_status || "").toUpperCase();

    if (
      status === "TRIAL" &&
      (!company.trial_end_date ||
        !Number.isFinite(new Date(company.trial_end_date).getTime()) || new Date(company.trial_end_date).getTime() <= Date.now())
    ) {
      return res.status(403).json({
        code: "TRIAL_EXPIRED",
        error: "Your trial has expired. Read-only access remains available."
      });
    }

    if (status !== "TRIAL" && !["ACTIVE", "PAID"].includes(status)) {
      return res.status(403).json({
        code: "SUBSCRIPTION_INACTIVE",
        error: "An active subscription is required to modify records."
      });
    }

    next();
  } catch (error) {
    console.error("Subscription validation error:", error);
    return res.status(500).json({
      error: "Unable to validate subscription"
    });
  }
};
