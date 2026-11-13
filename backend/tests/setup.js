// Runs before every test file. Tests ALWAYS use a separate database so real data is never touched.
require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'hr_management_test';
process.env.ADMIN_NAME = 'Test Admin';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Admin12345';
process.env.SEED_DEMO_DATA = 'true';
