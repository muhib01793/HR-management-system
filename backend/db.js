const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');
const config = require('./config');
const demo = require('./seed/demo-data.json');

// DATE columns come back as plain "YYYY-MM-DD" strings (no timezone shifting).
types.setTypeParser(1082, (value) => value);

const pool = new Pool({ ...config.db, max: 10, idleTimeoutMillis: 30000 });

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err.message);
});

const DEFAULT_DEPARTMENTS = demo.departments.map(({ name, description }) => ({ name, description }));

async function createSchema() {
  await pool.query(`
    -- v2.2: every company has its own isolated data.
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    -- Added in v2: roles. Existing users become admins so nobody gets locked out.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    -- Added in v2.1: bumping this number signs a user out everywhere (password change / reset).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT DEFAULT ''
    );
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) DEFAULT '',
      department_id INTEGER REFERENCES departments(id),
      designation VARCHAR(150) NOT NULL,
      salary NUMERIC(12, 2) DEFAULT 0,
      join_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive')),
      avatar TEXT DEFAULT ''
    );
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

    -- Added in v2.1: who did what, and when.
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_name VARCHAR(150) NOT NULL DEFAULT '',
      action VARCHAR(50) NOT NULL,
      entity VARCHAR(30) NOT NULL,
      entity_id INTEGER,
      summary TEXT NOT NULL DEFAULT ''
    );
    ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

    -- Before v2.2 department names and employee emails were unique for the whole database.
    -- Now they are unique inside one company, so two companies can use the same names.
    ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
    ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key;
  `);
}

// Databases from v2.1 and older have no company yet: put everything into one default company.
async function migrateToCompanies() {
  const { rows } = await pool.query(`
    SELECT (SELECT COUNT(*) FROM users WHERE company_id IS NULL)
         + (SELECT COUNT(*) FROM departments WHERE company_id IS NULL)
         + (SELECT COUNT(*) FROM employees WHERE company_id IS NULL) AS n
  `);
  if (Number(rows[0].n) > 0) {
    const company = await pool.query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [config.admin.company]);
    const id = company.rows[0].id;
    for (const table of ['users', 'departments', 'employees']) {
      await pool.query(`UPDATE ${table} SET company_id = $1 WHERE company_id IS NULL`, [id]);
    }
    console.log(`Existing data moved into the company "${config.admin.company}".`);
  }

  await pool.query(`
    ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE departments ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE employees ALTER COLUMN company_id SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_company_name ON departments (company_id, LOWER(name));
    CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_company_email ON employees (company_id, LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_users_company ON users (company_id);
    CREATE INDEX IF NOT EXISTS idx_departments_company ON departments (company_id);
    CREATE INDEX IF NOT EXISTS idx_employees_company ON employees (company_id);
    CREATE INDEX IF NOT EXISTS idx_employees_department ON employees (department_id);
    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (status);
    CREATE INDEX IF NOT EXISTS idx_employees_join_date ON employees (join_date);
    CREATE INDEX IF NOT EXISTS idx_audit_company_created ON audit_log (company_id, created_at DESC);
  `);
}

// Creates a company, its first admin and the default departments in one transaction.
// Used by website registration and by the first-start admin from .env.
async function createCompanyWithAdmin({ companyName, name, email, passwordHash }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const company = await client.query('INSERT INTO companies (name) VALUES ($1) RETURNING id, name', [companyName]);
    const companyId = company.rows[0].id;
    const user = await client.query(
      `INSERT INTO users (name, email, password_hash, role, company_id)
       VALUES ($1, $2, $3, 'admin', $4)
       RETURNING id, name, email, role, token_version, company_id`,
      [name, email, passwordHash, companyId]
    );
    for (const d of DEFAULT_DEPARTMENTS) {
      await client.query('INSERT INTO departments (company_id, name, description) VALUES ($1, $2, $3)', [
        companyId,
        d.name,
        d.description
      ]);
    }
    await client.query('COMMIT');
    return { user: user.rows[0], company: company.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function seedAdmin() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) return;

  const { company, name, email, password } = config.admin;
  if (email && password.length >= 8) {
    const hash = await bcrypt.hash(password, 12);
    await createCompanyWithAdmin({
      companyName: company,
      name,
      email: email.trim().toLowerCase(),
      passwordHash: hash
    });
    console.log(`First company "${company}" created with admin ${email}`);
    return;
  }

  if (!config.allowRegistration) {
    throw new Error(
      'No users exist yet and website registration is turned off.\n' +
        'Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 characters) in .env to create the first admin.\n' +
        'Tip: if the password contains the # character, wrap it in double quotes, e.g. ADMIN_PASSWORD="My#Pass123"'
    );
  }
  console.log('No companies yet. Open the website and choose "Register your company".');
}

// Fictional sample employees, loaded into the first company only, and only when it has none.
async function seedDemoEmployees() {
  if (!config.seedDemoData) return;
  const first = await pool.query('SELECT id FROM companies ORDER BY id LIMIT 1');
  if (!first.rows[0]) return;
  const companyId = first.rows[0].id;

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM employees WHERE company_id = $1', [companyId]);
  if (rows[0].count > 0) return;

  const deps = await pool.query('SELECT id, name FROM departments WHERE company_id = $1', [companyId]);
  const map = new Map(deps.rows.map((d) => [d.name, d.id]));
  for (const e of demo.employees) {
    const departmentId = map.get(e.department);
    if (!departmentId) continue;
    await pool.query(
      `INSERT INTO employees (company_id, name, email, phone, department_id, designation, salary, join_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [companyId, e.name, e.email, e.phone, departmentId, e.designation, e.salary, e.joinDate, e.status]
    );
  }
  console.log('Demo employees loaded.');
}

async function initDatabase() {
  await createSchema();
  await migrateToCompanies();
  await seedAdmin();
  await seedDemoEmployees();
  console.log('PostgreSQL connected and database initialized.');
}

async function closeDatabase() {
  await pool.end();
}

module.exports = { pool, initDatabase, closeDatabase, createCompanyWithAdmin };
