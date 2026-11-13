const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

router.use(auth, requireRole('admin'));

const ENTITIES = ['auth', 'employee', 'department', 'user'];

// Activity history, newest first. Admin only.
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const values = [req.user.companyId];
    let where = 'WHERE company_id = $1';
    if (ENTITIES.includes(req.query.entity)) {
      values.push(req.query.entity);
      where += ' AND entity = $2';
    }

    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_log ${where}`, values);
    const total = count.rows[0].total;
    const list = await pool.query(
      `SELECT id, created_at AS "createdAt", user_name AS "userName", action, entity, entity_id AS "entityId", summary
       FROM audit_log ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit]
    );
    res.json({ data: list.rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
