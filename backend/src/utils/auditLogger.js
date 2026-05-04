const pool = require("../config/db");

const logAuditEvent = async ({
  companyId = null,
  userId = null,
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
  status = "success",
  message = null,
}) => {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        company_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value,
        status,
        message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        companyId,
        userId,
        action,
        entityType,
        entityId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        status,
        message,
      ]
    );
  } catch (error) {
    console.error("logAuditEvent error:", error);
  }
};

module.exports = { logAuditEvent };