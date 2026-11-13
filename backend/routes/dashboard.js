const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// All numbers are calculated in the database, so they stay correct with any number of employees.
router.get('/', async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const [totals, departments, recent, byDepartment] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS "totalEmployees",
          COUNT(*) FILTER (WHERE status = 'active')::int AS "activeEmployees",
          COUNT(*) FILTER (WHERE join_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE)::int AS "newJoiners"
        FROM employees WHERE company_id = $1
      `, [companyId]),
      pool.query('SELECT COUNT(*)::int AS n FROM departments WHERE company_id = $1', [companyId]),
      pool.query(`
        SELECT e.id, e.name, e.designation, d.name AS department, e.join_date AS "joinDate"
        FROM employees e LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.company_id = $1
        ORDER BY e.join_date DESC, e.id DESC LIMIT 5
      `, [companyId]),
      pool.query(`
        SELECT d.name, COUNT(e.id)::int AS count
        FROM departments d LEFT JOIN employees e ON e.department_id = d.id
        WHERE d.company_id = $1
        GROUP BY d.name ORDER BY count DESC, d.name ASC
      `, [companyId])
    ]);

    res.json({
      ...totals.rows[0],
      departments: departments.rows[0].n,
      recent: recent.rows,
      byDepartment: byDepartment.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
