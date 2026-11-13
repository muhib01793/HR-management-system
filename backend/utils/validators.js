const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// At least 8 characters, with a letter and a number.
function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (p.length > 72) return 'Password must be at most 72 characters';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain letters and numbers';
  return null;
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { EMAIL_RE, isValidDate, passwordProblem, parseId };
