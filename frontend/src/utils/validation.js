export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rule as the server: 8+ characters with letters and numbers.
export const passwordRules = {
  required: 'Password is required',
  minLength: { value: 8, message: 'At least 8 characters' },
  validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Use letters and numbers'
};
