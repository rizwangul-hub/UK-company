import './config/env.js';
import { UK_ENV_PATH } from './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { configureCloudinary, isCloudinaryConfigured } from './config/cloudinary.js';

import authRoutes from './routes/authRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import tenancyRoutes from './routes/tenancyRoutes.js';
import rentRoutes from './routes/rentRoutes.js';
import mortgageRoutes from './routes/mortgageRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import applianceRoutes from './routes/applianceRoutes.js';
import complianceRoutes from './routes/complianceRoutes.js';

// Configure UK Cloudinary if credentials are present in UK .env
configureCloudinary();

const app = express();
const PORT = process.env.PORT || 5001;

// Security & Logging
app.disable('x-powered-by');
app.use(helmet());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// CORS setup
const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (configuredOrigins.includes('*') || configuredOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      // Allow Vercel preview and production app domains
      if (cleanOrigin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-company-id', 'X-Company-Id'],
    maxAge: 86400,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome / status endpoint
app.get('/', async (req, res) => {
  let dbStatus = mongoose.connection.readyState === 1 ? 'CONNECTED' : 'CONNECTING';
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      dbStatus = 'CONNECTED';
    } catch (err) {
      dbStatus = 'DISCONNECTED: ' + err.message;
    }
  }

  res.status(200).json({
    success: true,
    service: 'PIXX Technologies UK Property Finance API',
    status: 'ONLINE',
    version: '1.0.3',
    database: dbStatus,
    databaseName: mongoose.connection.name || 'uk_property_finance',
    currency: 'GBP (£)',
    healthEndpoint: '/api/health',
    timestamp: new Date().toISOString(),
  });
});

// Automatic DB connection check middleware (skips health check)
app.use(async (req, res, next) => {
  if (req.path === '/' || req.path === '/api/health') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed. Please verify MONGO_URI in UK backend environment.',
      error: error.message,
    });
  }
});

// Health Check
app.get('/api/health', async (req, res) => {
  let dbStatus = mongoose.connection.readyState === 1 ? 'CONNECTED' : 'CONNECTING';
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      dbStatus = 'CONNECTED';
    } catch (err) {
      dbStatus = 'DISCONNECTED: ' + err.message;
    }
  }

  res.status(200).json({
    success: true,
    service: 'PIXX Technologies UK Property Finance API',
    status: 'ONLINE',
    version: '1.0.3',
    database: dbStatus,
    databaseName: mongoose.connection.name || 'uk_property_finance',
    currency: 'GBP (£)',
    timestamp: new Date().toISOString(),
  });
});

// Mount UK Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes); // Mount reportRoutes first so it is never intercepted
app.use('/api/properties', propertyRoutes);
app.use('/api/rent', rentRoutes);
app.use('/api/mortgages', mortgageRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/appliances', applianceRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api', tenancyRoutes); // exposes /api/tenants and /api/tenancies

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[UK API Error]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`======================================================`);
    console.log(`  PIXX UK EXPENSE & PROPERTY FINANCE API READY`);
    console.log(`  Server running on http://127.0.0.1:${PORT}`);
    console.log(`  [Environment File]:  ${UK_ENV_PATH}`);
    try {
      const conn = await connectDB();
      console.log(`  [Database Connected]: ${conn.connection.name}`);
      console.log(`  [Database Host]:      ${conn.connection.host}`);
      const { seedDefaultsIfEmpty } = await import('./scripts/seedDefaults.js');
      await seedDefaultsIfEmpty();
      const { checkAndGenerateComplianceReminders } = await import('./services/complianceReminderService.js');
      await checkAndGenerateComplianceReminders().catch((remErr) => {
        console.warn('  [Compliance Reminders Check Notice]:', remErr.message);
      });
      setInterval(() => {
        checkAndGenerateComplianceReminders().catch(() => {});
      }, 12 * 60 * 60 * 1000);
    } catch (dbErr) {
      console.error(`  [Database Connection Failed]: ${dbErr.message}`);
    }
    console.log(`======================================================`);
  });
}

export default app;
