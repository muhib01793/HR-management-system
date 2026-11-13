const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { pool, createCompanyWithAdmin } = require('../db');
const auth = require('../middleware/auth');
const { EMAIL_RE, passwordProblem } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

// Slows down password guessing: 10 failed attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isTest ? 1000 : 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Stops bots from creating thousands of companies: 10 registrations per hour per IP.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registrations from this address. Please try again later.' }
});

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  company: u.companyName ?? u.company_name ?? ''
});

const signToken = (id, tokenVersion) =>
  jwt.sign({ id, tv: tokenVersion }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Tells the website whether to show the "Register your company" button.
router.get('/config', (req, res) => {
  res.json({ allowRegistration: config.allowRegistration });
});

// A new company signs up: creates the company, its first admin and the default departments.
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    if (!config.allowRegistration) {
      return res.status(403).json({ message: 'Registration is turned off. Ask your administrator for an account.' });
    }

    const { companyName, name, email, password } = req.body || {};
    const errors = {};
    if (!companyName || String(companyName).trim().length < 2) errors.companyName = 'Company name must be at least 2 characters';
    else if (String(companyName).trim().length > 150) errors.companyName = 'Company name is too long';
    if (!name || String(name).trim().length < 2) errors.name = 'Your name must be at least 2 characters';
    else if (String(name).trim().length > 150) errors.name = 'Name is too long';
    if (!email || !EMAIL_RE.test(String(email).trim()) || String(email).length > 255) errors.email = 'A valid email is required';
    const pw = passwordProblem(password);
    if (pw) errors.password = pw;
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const taken = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (taken.rows[0]) {
      return res.status(409).json({ message: 'An account with this email already exists. Please sign in instead.' });
    }

    const hash = await bcrypt.hash(String(password), 12);
    const { user, company } = await createCompanyWithAdmin({
      companyName: String(companyName).trim(),
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash: hash
    });

    const actor = { id: user.id, name: user.name, companyId: company.id };
    await logAudit(actor, 'create', 'user', user.id, `Company "${company.name}" registered`);
    res.status(201).json({
      token: signToken(user.id, user.token_version),
      user: publicUser({ ...user, companyName: company.name })
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'An account with this email already exists. Please sign in instead.' });
    }
    next(error);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.password_hash, u.token_version, u.company_id,
              c.name AS company_name
       FROM users u JOIN companies c ON c.id = u.company_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [String(email).trim()]
    );
    const user = rows[0];

    // Compare even when the user is missing so response time does not reveal valid emails.
    const hash = user ? user.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali';
    const ok = await bcrypt.compare(String(password), hash);
    if (!user || !ok) {
      // A failed attempt on a real account is visible to that company's admins.
      if (user) {
        await logAudit({ companyId: user.company_id }, 'login_failed', 'auth', null, 'Failed sign-in for ' + user.email);
      }
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await logAudit({ id: user.id, name: user.name, companyId: user.company_id }, 'login', 'auth', user.id, 'Signed in');
    res.json({ token: signToken(user.id, user.token_version), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/change-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ message: problem });
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from the current one' });
    }

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(String(currentPassword), rows[0].password_hash))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(String(newPassword), 12);
    // Bump token_version so every other session is signed out; hand this browser a fresh token.
    const updated = await pool.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING token_version',
      [hash, req.user.id]
    );
    await logAudit(req.user, 'password_change', 'user', req.user.id, 'Changed own password');
    res.json({ message: 'Password updated', token: signToken(req.user.id, updated.rows[0].token_version) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
