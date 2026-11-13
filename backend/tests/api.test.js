const request = require('supertest');
const app = require('../server');
const { pool, initDatabase, closeDatabase } = require('../db');

const ADMIN = { email: 'admin@test.local', password: 'Admin12345' };
let adminToken;
let hrToken;
const tag = Date.now();

const as = (token) => ({ Authorization: 'Bearer ' + token });
const login = (creds) => request(app).post('/api/auth/login').send(creds);

beforeAll(async () => {
  await initDatabase();
  adminToken = (await login(ADMIN)).body.token;

  // Make sure an HR (non-admin) user exists for permission tests.
  await request(app)
    .post('/api/users')
    .set(as(adminToken))
    .send({ name: 'HR Tester', email: 'hr@test.local', password: 'HrUser1234', role: 'hr' });
  hrToken = (await login({ email: 'hr@test.local', password: 'HrUser1234' })).body.token;
});

afterAll(async () => {
  await pool.query("DELETE FROM employees WHERE email LIKE '%@e2etest.local'");
  // Companies created by these tests (their users, departments and employees go with them).
  await pool.query("DELETE FROM companies WHERE name LIKE 'Test Co %'");
  await closeDatabase();
});

describe('Health', () => {
  it('reports database status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth', () => {
  it('rejects wrong password', async () => {
    expect((await login({ email: ADMIN.email, password: 'wrong-pass-1' })).statusCode).toBe(401);
  });
  it('rejects missing fields', async () => {
    expect((await login({})).statusCode).toBe(400);
  });
  it('logs in with valid credentials and returns the role', async () => {
    const res = await login(ADMIN);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.password_hash).toBeUndefined();
  });
  it('email login is case-insensitive', async () => {
    expect((await login({ email: 'ADMIN@TEST.LOCAL', password: ADMIN.password })).statusCode).toBe(200);
  });
  it('/me returns the current user', async () => {
    const res = await request(app).get('/api/auth/me').set(as(adminToken));
    expect(res.body.user.email).toBe(ADMIN.email);
  });
  it('rejects a tampered token', async () => {
    const res = await request(app).get('/api/auth/me').set(as(adminToken + 'x'));
    expect(res.statusCode).toBe(401);
  });
  it('changes password and enforces strength rules', async () => {
    const weak = await request(app)
      .post('/api/auth/change-password')
      .set(as(hrToken))
      .send({ currentPassword: 'HrUser1234', newPassword: 'short' });
    expect(weak.statusCode).toBe(400);

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set(as(hrToken))
      .send({ currentPassword: 'nope-nope-1', newPassword: 'NewPass1234' });
    expect(wrong.statusCode).toBe(400);

    const ok = await request(app)
      .post('/api/auth/change-password')
      .set(as(hrToken))
      .send({ currentPassword: 'HrUser1234', newPassword: 'NewPass1234' });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.token).toBeDefined();
    expect((await login({ email: 'hr@test.local', password: 'NewPass1234' })).statusCode).toBe(200);

    // The old token is revoked; the fresh one returned by the API keeps working.
    expect((await request(app).get('/api/auth/me').set(as(hrToken))).statusCode).toBe(401);
    expect((await request(app).get('/api/auth/me').set(as(ok.body.token))).statusCode).toBe(200);

    // restore
    const restored = await request(app)
      .post('/api/auth/change-password')
      .set(as(ok.body.token))
      .send({ currentPassword: 'NewPass1234', newPassword: 'HrUser1234' });
    hrToken = restored.body.token;
  });
});

describe('Employees', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/employees')).statusCode).toBe(401);
  });

  it('lists with pagination', async () => {
    const res = await request(app).get('/api/employees?page=1&limit=5').set(as(adminToken));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('returns join dates as plain YYYY-MM-DD strings', async () => {
    const res = await request(app).get('/api/employees?limit=1').set(as(adminToken));
    expect(res.body.data[0].joinDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not expose avatar URLs', async () => {
    const res = await request(app).get('/api/employees?limit=1').set(as(adminToken));
    expect(res.body.data[0].avatar).toBeUndefined();
  });

  it('filters by department', async () => {
    const res = await request(app).get('/api/employees?department=Technology').set(as(adminToken));
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((e) => e.department === 'Technology')).toBe(true);
  });

  it('searches by name and treats % literally', async () => {
    const found = await request(app).get('/api/employees?search=ahmed').set(as(adminToken));
    expect(found.body.data.length).toBeGreaterThan(0);
    const wildcard = await request(app).get('/api/employees?search=%25').set(as(adminToken));
    expect(wildcard.body.total).toBe(0);
  });

  it('sorts descending by salary', async () => {
    const res = await request(app).get('/api/employees?sort=salary&order=desc&limit=10').set(as(adminToken));
    const s = res.body.data.map((e) => e.salary);
    expect([...s].sort((a, b) => b - a)).toEqual(s);
  });

  it('returns 404 for bad or unknown ids instead of crashing', async () => {
    expect((await request(app).get('/api/employees/abc').set(as(adminToken))).statusCode).toBe(404);
    expect((await request(app).get('/api/employees/999999').set(as(adminToken))).statusCode).toBe(404);
  });

  it('rejects invalid data with field errors', async () => {
    const res = await request(app).post('/api/employees').set(as(adminToken)).send({ name: 'X', joinDate: '2026-13-45' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.name).toBeDefined();
    expect(res.body.errors.joinDate).toBeDefined();
  });

  const payload = (extra = {}) => ({
    name: 'Test Person',
    email: `person.${tag}@e2etest.local`,
    phone: '+92 300 0000000',
    department: 'Consulting',
    designation: 'Tester',
    salary: 100000,
    joinDate: '2026-11-01',
    status: 'active',
    ...extra
  });

  it('HR can create and edit, but only admin can delete; duplicates are rejected', async () => {
    const created = await request(app).post('/api/employees').set(as(hrToken)).send(payload());
    expect(created.statusCode).toBe(201);
    const id = created.body.id;

    expect((await request(app).post('/api/employees').set(as(hrToken)).send(payload())).statusCode).toBe(409);

    const updated = await request(app)
      .put('/api/employees/' + id)
      .set(as(hrToken))
      .send(payload({ designation: 'Senior Tester', status: 'inactive' }));
    expect(updated.statusCode).toBe(200);
    expect(updated.body.designation).toBe('Senior Tester');
    expect(updated.body.status).toBe('inactive');

    expect((await request(app).delete('/api/employees/' + id).set(as(hrToken))).statusCode).toBe(403);
    expect((await request(app).delete('/api/employees/' + id).set(as(adminToken))).statusCode).toBe(200);
    expect((await request(app).get('/api/employees/' + id).set(as(adminToken))).statusCode).toBe(404);
  });

  it('exports CSV and neutralises spreadsheet formulas', async () => {
    const evil = await request(app)
      .post('/api/employees')
      .set(as(adminToken))
      .send(payload({ name: '=HYPERLINK("http://x")', email: `evil.${tag}@e2etest.local` }));
    expect(evil.statusCode).toBe(201);

    const res = await request(app).get('/api/employees/export?search=evil.' + tag).set(as(adminToken));
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('"\'=HYPERLINK');
    expect(res.text).not.toMatch(/,"=HYPERLINK/);
  });
});

describe('Departments', () => {
  it('lists with employee counts and rejects duplicates', async () => {
    const list = await request(app).get('/api/departments').set(as(adminToken));
    expect(list.statusCode).toBe(200);
    expect(typeof list.body[0].employees).toBe('number');
    const dup = await request(app).post('/api/departments').set(as(adminToken)).send({ name: 'Consulting' });
    expect(dup.statusCode).toBe(409);
  });
});

describe('Departments: edit and delete', () => {
  const deptName = `Temp Dept ${tag}`;

  it('admin can add, rename and delete an empty department; HR cannot delete', async () => {
    const created = await request(app).post('/api/departments').set(as(adminToken)).send({ name: deptName });
    expect(created.statusCode).toBe(201);
    const id = created.body.id;

    const renamed = await request(app)
      .put('/api/departments/' + id)
      .set(as(hrToken))
      .send({ name: deptName + ' B', description: 'Updated' });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.body.name).toBe(deptName + ' B');

    const clash = await request(app).put('/api/departments/' + id).set(as(adminToken)).send({ name: 'Consulting' });
    expect(clash.statusCode).toBe(409);

    expect((await request(app).delete('/api/departments/' + id).set(as(hrToken))).statusCode).toBe(403);
    expect((await request(app).delete('/api/departments/' + id).set(as(adminToken))).statusCode).toBe(200);
    expect((await request(app).delete('/api/departments/' + id).set(as(adminToken))).statusCode).toBe(404);
  });

  it('refuses to delete a department that still has employees', async () => {
    const list = await request(app).get('/api/departments').set(as(adminToken));
    const busy = list.body.find((d) => d.employees > 0);
    const res = await request(app).delete('/api/departments/' + busy.id).set(as(adminToken));
    expect(res.statusCode).toBe(409);
  });
});

describe('Audit log (admin only)', () => {
  it('blocks HR users and requires login', async () => {
    expect((await request(app).get('/api/audit')).statusCode).toBe(401);
    expect((await request(app).get('/api/audit').set(as(hrToken))).statusCode).toBe(403);
  });

  it('records actions with who did them', async () => {
    const res = await request(app).get('/api/audit?limit=50').set(as(adminToken));
    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.data.some((e) => e.entity === 'employee' && e.action === 'create')).toBe(true);
    expect(res.body.data[0].userName).toBeDefined();
  });

  it('filters by type and never contains passwords', async () => {
    const res = await request(app).get('/api/audit?entity=user&limit=100').set(as(adminToken));
    expect(res.body.data.every((e) => e.entity === 'user')).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/HrUser1234|Admin12345|NewPass1234/);
  });
});

describe('Companies: registration and isolation', () => {
  const regBody = (extra = {}) => ({
    companyName: `Test Co ${tag}`,
    name: 'Company B Owner',
    email: `owner.${tag}@companyb.test`,
    password: 'OwnerPass123',
    ...extra
  });
  let bToken;
  let aEmployeeId;
  let aUserId;
  let aDeptId;

  beforeAll(async () => {
    const created = await request(app)
      .post('/api/employees')
      .set(as(adminToken))
      .send({
        name: 'Isolation Person',
        email: `shared.${tag}@e2etest.local`,
        department: 'Consulting',
        designation: 'Tester',
        salary: 1,
        joinDate: '2026-11-01',
        status: 'active'
      });
    aEmployeeId = created.body.id;
    aUserId = (await request(app).get('/api/auth/me').set(as(adminToken))).body.user.id;
    aDeptId = (await request(app).get('/api/departments').set(as(adminToken))).body.find((d) => d.name === 'Consulting').id;
  });

  it('reports whether registration is open', async () => {
    const res = await request(app).get('/api/auth/config');
    expect(res.statusCode).toBe(200);
    expect(res.body.allowRegistration).toBe(true);
  });

  it('validates registration fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ companyName: 'X', name: '', email: 'nope', password: '1' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.companyName).toBeDefined();
    expect(res.body.errors.email).toBeDefined();
    expect(res.body.errors.password).toBeDefined();
  });

  it('registers a new company with its own admin and default departments', async () => {
    const res = await request(app).post('/api/auth/register').send(regBody());
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.company).toBe(`Test Co ${tag}`);
    expect(res.body.user.password_hash).toBeUndefined();
    bToken = res.body.token;

    const me = await request(app).get('/api/auth/me').set(as(bToken));
    expect(me.body.user.company).toBe(`Test Co ${tag}`);
    const depts = await request(app).get('/api/departments').set(as(bToken));
    expect(depts.body.length).toBeGreaterThan(0);
    expect((await login({ email: regBody().email, password: 'OwnerPass123' })).statusCode).toBe(200);
  });

  it('rejects an email that is already registered, in any case', async () => {
    expect((await request(app).post('/api/auth/register').send(regBody())).statusCode).toBe(409);
    const other = await request(app)
      .post('/api/auth/register')
      .send(regBody({ companyName: `Test Co dup ${tag}`, email: ADMIN.email.toUpperCase() }));
    expect(other.statusCode).toBe(409);
  });

  it('a new company starts with no employees and cannot see another company\'s data', async () => {
    const list = await request(app).get('/api/employees').set(as(bToken));
    expect(list.body.total).toBe(0);
    expect((await request(app).get('/api/employees/' + aEmployeeId).set(as(bToken))).statusCode).toBe(404);
    expect((await request(app).delete('/api/employees/' + aEmployeeId).set(as(bToken))).statusCode).toBe(404);
    expect(
      (await request(app).put('/api/employees/' + aEmployeeId).set(as(bToken)).send({})).statusCode
    ).toBe(404);

    const csv = await request(app).get('/api/employees/export').set(as(bToken));
    expect(csv.text).not.toContain('Isolation Person');

    const dash = await request(app).get('/api/dashboard').set(as(bToken));
    expect(dash.body.totalEmployees).toBe(0);
  });

  it('cannot reach another company\'s users, departments or activity log', async () => {
    const users = await request(app).get('/api/users').set(as(bToken));
    expect(users.body.every((u) => u.email.endsWith('@companyb.test'))).toBe(true);
    expect((await request(app).put('/api/users/' + aUserId).set(as(bToken)).send({ role: 'hr' })).statusCode).toBe(404);
    expect((await request(app).delete('/api/users/' + aUserId).set(as(bToken))).statusCode).toBe(404);

    expect((await request(app).put('/api/departments/' + aDeptId).set(as(bToken)).send({ name: 'Hacked' })).statusCode).toBe(404);
    expect((await request(app).delete('/api/departments/' + aDeptId).set(as(bToken))).statusCode).toBe(404);

    const audit = await request(app).get('/api/audit?limit=100').set(as(bToken));
    expect(JSON.stringify(audit.body)).not.toContain('Isolation Person');
  });

  it('two companies can use the same department name and employee email', async () => {
    const dept = await request(app).post('/api/departments').set(as(bToken)).send({ name: 'Consulting' });
    // Default departments already include Consulting in every new company.
    expect([201, 409]).toContain(dept.statusCode);

    const emp = await request(app)
      .post('/api/employees')
      .set(as(bToken))
      .send({
        name: 'Same Email Person',
        email: `shared.${tag}@e2etest.local`,
        department: 'Consulting',
        designation: 'Tester',
        salary: 1,
        joinDate: '2026-11-01',
        status: 'active'
      });
    expect(emp.statusCode).toBe(201);
    // ...and company A's own record is untouched.
    const a = await request(app).get('/api/employees/' + aEmployeeId).set(as(adminToken));
    expect(a.body.name).toBe('Isolation Person');
  });

  it('only the owning company\'s admin can rename the company', async () => {
    const res = await request(app).put('/api/company').set(as(bToken)).send({ name: `Test Co renamed ${tag}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe(`Test Co renamed ${tag}`);
    expect((await request(app).put('/api/company').set(as(hrToken)).send({ name: 'Nope' })).statusCode).toBe(403);
    expect((await request(app).put('/api/company').set(as(bToken)).send({ name: 'X' })).statusCode).toBe(400);
  });
});

describe('Dashboard', () => {
  it('returns database-calculated stats', async () => {
    const res = await request(app).get('/api/dashboard').set(as(adminToken));
    expect(res.statusCode).toBe(200);
    expect(res.body.totalEmployees).toBeGreaterThanOrEqual(res.body.activeEmployees);
    expect(res.body.departments).toBeGreaterThan(0);
    expect(res.body.recent.length).toBeLessThanOrEqual(5);
    expect(Array.isArray(res.body.byDepartment)).toBe(true);
  });
});

describe('Users (admin only)', () => {
  it('blocks HR users', async () => {
    expect((await request(app).get('/api/users').set(as(hrToken))).statusCode).toBe(403);
  });

  it('validates new users and prevents duplicates', async () => {
    const bad = await request(app).post('/api/users').set(as(adminToken)).send({ name: 'A', email: 'x', password: '1', role: 'boss' });
    expect(bad.statusCode).toBe(400);
    const dup = await request(app)
      .post('/api/users')
      .set(as(adminToken))
      .send({ name: 'Dup HR', email: 'hr@test.local', password: 'HrUser1234', role: 'hr' });
    expect(dup.statusCode).toBe(409);
  });

  it('never lists password hashes', async () => {
    const res = await request(app).get('/api/users').set(as(adminToken));
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('protects against deleting yourself or the last admin', async () => {
    const me = (await request(app).get('/api/auth/me').set(as(adminToken))).body.user;
    const self = await request(app).delete('/api/users/' + me.id).set(as(adminToken));
    expect(self.statusCode).toBe(400);
    const demote = await request(app).put('/api/users/' + me.id).set(as(adminToken)).send({ role: 'hr' });
    expect(demote.statusCode).toBe(400);
  });

  it('a deleted user is locked out immediately', async () => {
    const created = await request(app)
      .post('/api/users')
      .set(as(adminToken))
      .send({ name: 'Temp HR', email: `temp.${tag}@test.local`, password: 'TempUser123', role: 'hr' });
    const token = (await login({ email: `temp.${tag}@test.local`, password: 'TempUser123' })).body.token;
    expect((await request(app).get('/api/employees').set(as(token))).statusCode).toBe(200);
    await request(app).delete('/api/users/' + created.body.id).set(as(adminToken));
    expect((await request(app).get('/api/employees').set(as(token))).statusCode).toBe(401);
  });

  it('an admin password reset signs the user out of old sessions', async () => {
    const created = await request(app)
      .post('/api/users')
      .set(as(adminToken))
      .send({ name: 'Reset HR', email: `reset.${tag}@test.local`, password: 'ResetUser123', role: 'hr' });
    const token = (await login({ email: `reset.${tag}@test.local`, password: 'ResetUser123' })).body.token;
    expect((await request(app).get('/api/employees').set(as(token))).statusCode).toBe(200);
    await request(app).put('/api/users/' + created.body.id).set(as(adminToken)).send({ password: 'ResetUser456' });
    expect((await request(app).get('/api/employees').set(as(token))).statusCode).toBe(401);
    expect((await login({ email: `reset.${tag}@test.local`, password: 'ResetUser456' })).statusCode).toBe(200);
    await request(app).delete('/api/users/' + created.body.id).set(as(adminToken));
  });
});

describe('Misc', () => {
  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.statusCode).toBe(404);
  });
  it('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.statusCode).toBe(400);
  });
  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});
