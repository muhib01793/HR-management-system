const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { pool, initDatabase, closeDatabase } = require('./db');

const app = express();

app.disable('x-powered-by');
if (config.trustProxy !== '0') {
  app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Do not force https on plain-http office servers.
        upgradeInsecureRequests: null
      }
    }
  })
);

if (config.corsOrigins.length) {
  app.use(cors({ origin: config.corsOrigins }));
}
app.use(express.json({ limit: '100kb' }));
if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: config.isTest ? 100000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' }
  })
);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'database unavailable' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/company', require('./routes/company'));

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Serve the built React app from this same server (single deployment, no CORS needed).
if (fs.existsSync(path.join(config.frontendDist, 'index.html'))) {
  app.use(express.static(config.frontendDist, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(config.frontendDist, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large' });
  console.error('Backend error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

async function startServer() {
  try {
    await initDatabase();
    const server = app.listen(config.port, () => {
      console.log(`HR system running on http://localhost:${config.port} (${config.env})`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down...`);
      server.close(async () => {
        await closeDatabase().catch(() => {});
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    startServer().catch((error) => {
  console.error('Failed to start HR backend:');
  console.error(error);
  console.error(error?.stack);
  process.exit(1);
});
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
