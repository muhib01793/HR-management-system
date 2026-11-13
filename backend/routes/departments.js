const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { parseId } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.id, d.name, d.description, COUNT(e.id)::int AS employees
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      WHERE d.company_id = $1
      GROUP BY d.id, d.name, d.description
      ORDER BY d.name ASC
    `, [req.user.companyId]);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: 'Department name is required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO departments (company_id, name, description) VALUES ($1, $2, $3) RETURNING id, name, description',
      [req.user.companyId, String(name).trim(), String(description || '').trim()]
    );
    await logAudit(req.user, 'create', 'department', rows[0].id, `Added department ${rows[0].name}`);
    res.status(201).json({ ...rows[0], employees: 0 });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Department already exists' });
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { name, description } = req.body || {};
    if (!name || String(name).trim().length < 2 || String(name).trim().length > 150) {
      return res.status(400).json({ message: 'Department name must be 2 to 150 characters' });
    }
    const { rows } = id
      ? await pool.query(
          `UPDATE departments SET name = $1, description = $2 WHERE id = $3 AND company_id = $4
           RETURNING id, name, description`,
          [String(name).trim(), String(description || '').trim(), id, req.user.companyId]
        )
      : { rows: [] };
    if (!rows[0]) return res.status(404).json({ message: 'Department not found' });
    await logAudit(req.user, 'update', 'department', id, `Updated department ${rows[0].name}`);
    res.json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Department already exists' });
    next(error);
  }
});

// Only admins, and only when nobody belongs to the department any more.
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const found = id
      ? await pool.query('SELECT name FROM departments WHERE id = $1 AND company_id = $2', [id, req.user.companyId]) : { rows: [] };
    if (!found.rows[0]) return res.status(404).json({ message: 'Department not found' });

    const used = await pool.query('SELECT COUNT(*)::int AS n FROM employees WHERE department_id = $1', [id]);
    if (used.rows[0].n > 0) {
      return res.status(409).json({
        message: `This department still has ${used.rows[0].n} employee(s). Move them to another department first.`
      });
    }
    await pool.query('DELETE FROM departments WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    await logAudit(req.user, 'delete', 'department', id, `Deleted department ${found.rows[0].name}`);
    res.json({ message: 'Department deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
