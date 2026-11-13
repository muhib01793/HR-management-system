require('dotenv').config();
const crypto = require('crypto');

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

const WEAK_SECRETS = [
  '',
  'change-this-secret-in-production',
  'consultancy-outfit-hr-secret-change-this',
  'change-me',
  'secret'
];

let jwtSecret = process.env.JWT_SECRET || '';

if (isProd && (jwtSecret.length < 32 || WEAK_SECRETS.includes(jwtSecret))) {
  throw new Error(
    'JWT_SECRET is missing or weak. Set a random value of 32+ characters in .env.\n' +
      "Generate one: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
}

if (!isProd && (!jwtSecret || WEAK_SECRETS.includes(jwtSecret))) {
  // Development only: a random secret means logins reset on every restart.
  if (!isTest) {
    console.warn('[config] JWT_SECRET not set (or weak) - using a temporary random secret for development.');
  }
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

const list = (v) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = {
  env,
  isProd,
  isTest,
  port: Number(process.env.PORT) || 5000,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: list(process.env.CORS_ORIGIN),
  trustProxy: process.env.TRUST_PROXY || '0',
  frontendDist: process.env.FRONTEND_DIST || require('path').join(__dirname, '..', 'frontend', 'dist'),
  // true = anyone can register a new company from the website. Set false for a single-company install.
  allowRegistration: String(process.env.ALLOW_REGISTRATION || 'true').toLowerCase() !== 'false',
  seedDemoData: String(process.env.SEED_DEMO_DATA).toLowerCase() === 'true',
  admin: {
    company: process.env.COMPANY_NAME || 'My Company',
    name: process.env.ADMIN_NAME || 'Admin',
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || ''
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'hr_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: String(process.env.DB_SSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false
  }
};
