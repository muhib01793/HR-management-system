const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { EMAIL_RE, passwordProblem, parseId } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

const ROLES = ['admin', 'hr'];

router.use(auth, requireRole('admin'));

async function adminCount(companyId) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND company_id = $1", [
    companyId
  ]);
  return rows[0].n;
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at AS "createdAt" FROM users WHERE company_id = $1 ORDER BY name ASC',
      [req.user.companyId]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    const errors = {};
    if (!name || String(name).trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (!email || !EMAIL_RE.test(String(email))) errors.email = 'A valid email is required';
    if (!ROLES.includes(role)) errors.role = 'Role must be admin or hr';
    const pw = passwordProblem(password);
    if (pw) errors.password = pw;
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const hash = await bcrypt.hash(String(password), 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, company_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at AS "createdAt"`,
      [String(name).trim(), String(email).trim().toLowerCase(), hash, role, req.user.companyId]
    );
    await logAudit(req.user, 'create', 'user', rows[0].id, `Created ${role} account for ${rows[0].email}`);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A user with this email already exists' });
    next(error);
  }
});

// Change role and/or reset password.
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ message: 'User not found' });

    const { role, password } = req.body || {};
    const existing = await pool.query('SELECT id, email, role FROM users WHERE id = $1 AND company_id = $2', [
      id,
      req.user.companyId
    ]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'User not found' });
    const target = existing.rows[0];

    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ message: 'Role must be admin or hr' });
      if (existing.rows[0].role === 'admin' && role !== 'admin' && (await adminCount(req.user.companyId)) <= 1) {
        return res.status(400).json({ message: 'At least one admin is required' });
      }
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
      if (role !== target.role) {
        await logAudit(req.user, 'role_change', 'user', id, `Changed ${target.email} from ${target.role} to ${role}`);
      }
    }

    if (password !== undefined && password !== '') {
      const problem = passwordProblem(password);
      if (problem) return res.status(400).json({ message: problem });
      // token_version + 1 signs the person out of every device, so the old password stops working at once.
      await pool.query(
        'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
        [await bcrypt.hash(String(password), 12), id]
      );
      await logAudit(req.user, 'password_reset', 'user', id, `Reset password for ${target.email}`);
    }

    const { rows } = await pool.query('SELECT id, name, email, role, created_at AS "createdAt" FROM users WHERE id = $1', [id]);
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ message: 'User not found' });
    if (id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });

    const existing = await pool.query('SELECT email, role FROM users WHERE id = $1 AND company_id = $2', [
      id,
      req.user.companyId
    ]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'User not found' });
    if (existing.rows[0].role === 'admin' && (await adminCount(req.user.companyId)) <= 1) {
      return res.status(400).json({ message: 'At least one admin is required' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await logAudit(req.user, 'delete', 'user', id, `Deleted account ${existing.rows[0].email}`);
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
