const { pool } = require('../db');

// Records who did what, inside the user's own company. A failure here must never break the real action, so errors are only logged.
async function logAudit(user, action, entity, entityId, summary) {
  try {
    await pool.query(
      `INSERT INTO audit_log (company_id, user_id, user_name, action, entity, entity_id, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user?.companyId ?? null,
        user?.id ?? null,
        user?.name ?? '',
        action,
        entity,
        entityId ?? null,
        String(summary || '').slice(0, 500)
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
