const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { EMAIL_RE, isValidDate, parseId } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

router.use(auth);

const MAX_SALARY = 999999999;

function validateEmployee(b) {
  const errors = {};
  if (!b.name || String(b.name).trim().length < 2) errors.name = 'Name must be at least 2 characters';
  else if (String(b.name).trim().length > 150) errors.name = 'Name is too long';

  if (!b.email || !EMAIL_RE.test(String(b.email).trim())) errors.email = 'A valid email is required';
  if (!b.department) errors.department = 'Department is required';
  if (!b.designation || !String(b.designation).trim()) errors.designation = 'Designation is required';

  if (!b.joinDate || !isValidDate(b.joinDate)) errors.joinDate = 'Join date must be a valid date (YYYY-MM-DD)';
  if (!['active', 'inactive'].includes(b.status)) errors.status = 'Status must be active or inactive';

  if (b.phone && String(b.phone).length > 50) errors.phone = 'Phone number is too long';

  if (b.salary !== undefined && b.salary !== null && b.salary !== '') {
    const s = Number(b.salary);
    if (Number.isNaN(s) || s < 0 || s > MAX_SALARY) errors.salary = 'Salary must be a number between 0 and ' + MAX_SALARY;
  }
  return errors;
}

const employeeSelect = `
  SELECT e.id, e.name, e.email, e.phone, d.name AS department, e.designation,
         e.salary::float AS salary, e.join_date AS "joinDate", e.status
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
`;

// Every lookup is limited to the signed-in user's company.
async function getEmployee(id, companyId) {
  const { rows } = await pool.query(`${employeeSelect} WHERE e.id = $1 AND e.company_id = $2`, [id, companyId]);
  return rows[0];
}

async function findDepartment(name, companyId) {
  const { rows } = await pool.query('SELECT id FROM departments WHERE LOWER(name) = LOWER($1) AND company_id = $2', [
    String(name).trim(),
    companyId
  ]);
  return rows[0];
}

const SORT_FIELDS = {
  id: 'e.id',
  name: 'e.name',
  email: 'e.email',
  phone: 'e.phone',
  department: 'd.name',
  designation: 'e.designation',
  salary: 'e.salary',
  joinDate: 'e.join_date',
  status: 'e.status'
};

// Builds the WHERE clause shared by the list and export endpoints.
function buildFilters(query, companyId) {
  const conditions = ['e.company_id = $1'];
  const values = [companyId];

  if (query.search) {
    // Escape LIKE wildcards typed by the user.
    const term = String(query.search).trim().replace(/[\\%_]/g, '\\$&');
    values.push(`%${term}%`);
    const p = values.length;
    conditions.push(`(e.name ILIKE $${p} OR e.email ILIKE $${p} OR e.designation ILIKE $${p})`);
  }
  if (query.department) {
    values.push(String(query.department));
    conditions.push(`d.name = $${values.length}`);
  }
  if (query.status) {
    values.push(String(query.status));
    conditions.push(`e.status = $${values.length}`);
  }
  return { where: `WHERE ${conditions.join(' AND ')}`, values };
}

function orderBy(query) {
  const column = SORT_FIELDS[query.sort] || 'e.name';
  const order = query.order === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY ${column} ${order}, e.id ASC`;
}

// Spreadsheet apps run formulas that start with = + - @, so neutralise them.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const offset = (page - 1) * limit;
    const { where, values } = buildFilters(req.query, req.user.companyId);

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM employees e LEFT JOIN departments d ON d.id = e.department_id ${where}`,
      values
    );
    const total = count.rows[0].total;

    const list = await pool.query(
      `${employeeSelect} ${where} ${orderBy(req.query)} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    res.json({ data: list.rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    next(error);
  }
});

// CSV download of everything matching the current filters.
router.get('/export', async (req, res, next) => {
  try {
    const { where, values } = buildFilters(req.query, req.user.companyId);
    const { rows } = await pool.query(`${employeeSelect} ${where} ${orderBy(req.query)}`, values);

    const header = ['ID', 'Name', 'Email', 'Phone', 'Department', 'Designation', 'Salary', 'Join date', 'Status'];
    const lines = [header.map(csvCell).join(',')];
    for (const e of rows) {
      lines.push(
        [e.id, e.name, e.email, e.phone, e.department, e.designation, e.salary, e.joinDate, e.status].map(csvCell).join(',')
      );
    }

    await logAudit(req.user, 'export', 'employee', null, `Exported ${rows.length} employee(s) to CSV`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const emp = id ? await getEmployee(id, req.user.companyId) : null;
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    res.json(emp);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const errors = validateEmployee(b);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });

    const department = await findDepartment(b.department, req.user.companyId);
    if (!department) return res.status(400).json({ message: 'Selected department does not exist' });

    const { rows } = await pool.query(
      `INSERT INTO employees (company_id, name, email, phone, department_id, designation, salary, join_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        req.user.companyId,
        String(b.name).trim(),
        String(b.email).trim().toLowerCase(),
        String(b.phone || '').trim(),
        department.id,
        String(b.designation).trim(),
        Number(b.salary) || 0,
        b.joinDate,
        b.status
      ]
    );
    const created = await getEmployee(rows[0].id, req.user.companyId);
    await logAudit(req.user, 'create', 'employee', created.id, `Added employee ${created.name}`);
    res.status(201).json(created);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Email already exists' });
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id || !(await getEmployee(id, req.user.companyId))) return res.status(404).json({ message: 'Employee not found' });

    const b = req.body || {};
    const errors = validateEmployee(b);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });

    const department = await findDepartment(b.department, req.user.companyId);
    if (!department) return res.status(400).json({ message: 'Selected department does not exist' });

    await pool.query(
      `UPDATE employees SET name=$1, email=$2, phone=$3, department_id=$4, designation=$5,
              salary=$6, join_date=$7, status=$8 WHERE id=$9 AND company_id=$10`,
      [
        String(b.name).trim(),
        String(b.email).trim().toLowerCase(),
        String(b.phone || '').trim(),
        department.id,
        String(b.designation).trim(),
        Number(b.salary) || 0,
        b.joinDate,
        b.status,
        id,
        req.user.companyId
      ]
    );
    const updated = await getEmployee(id, req.user.companyId);
    await logAudit(req.user, 'update', 'employee', id, `Updated employee ${updated.name}`);
    res.json(updated);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Email already exists' });
    next(error);
  }
});

// Only admins can delete. HR users can mark an employee "inactive" instead.
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existing = id ? await getEmployee(id, req.user.companyId) : null;
    if (!existing) return res.status(404).json({ message: 'Employee not found' });
    await pool.query('DELETE FROM employees WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
    await logAudit(req.user, 'delete', 'employee', id, `Deleted employee ${existing.name}`);
    res.json({ message: 'Employee deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
