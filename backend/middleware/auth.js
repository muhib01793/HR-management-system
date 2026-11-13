const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db');

// Verifies the JWT and reloads the user from the database on every request,
// so deleted users or changed roles take effect immediately.
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const { rows } = await pool.query(`SELECT u.id, u.name, u.email, u.role, u.token_version, u.company_id AS "companyId", c.name AS "companyName"
       FROM users u JOIN companies c ON c.id = u.company_id WHERE u.id = $1`, [payload.id]);
    if (!rows[0]) return res.status(401).json({ message: 'Account no longer exists' });
    // Tokens issued before a password change/reset are no longer valid.
    if ((payload.tv || 0) !== rows[0].token_version) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
    const { token_version, ...user } = rows[0]; // eslint-disable-line no-unused-vars
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this' });
    }
    next();
  };
}

module.exports = auth;
module.exports.requireRole = requireRole;
