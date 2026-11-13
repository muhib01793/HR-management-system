const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, created_at AS "createdAt" FROM companies WHERE id = $1', [
      req.user.companyId
    ]);
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// Admins can fix the company name (for example a typo made at registration).
router.put('/', requireRole('admin'), async (req, res, next) => {
  try {
    const name = String((req.body || {}).name || '').trim();
    if (name.length < 2 || name.length > 150) {
      return res.status(400).json({ message: 'Company name must be 2 to 150 characters' });
    }
    const { rows } = await pool.query('UPDATE companies SET name = $1 WHERE id = $2 RETURNING id, name', [
      name,
      req.user.companyId
    ]);
    await logAudit(req.user, 'update', 'user', null, `Company name changed to "${name}"`);
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
