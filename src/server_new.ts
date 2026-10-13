if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile();
  } catch {
    // ignore if .env is missing
  }
}

import express from 'express';
import path from 'path';
import { apiRouter } from './routes';
import { ScraperController } from './controllers/ScraperController';
import { OutreachController } from './controllers/OutreachController';
import { getCampaignStatus } from './outreachService';
import './db/database'; // Ensures SQLite DB is initialized & seeded on startup

import fs from 'fs';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const frontendDist = path.join(process.cwd(), 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
} else {
  app.use(express.static(path.join(process.cwd(), 'public')));
}

// Mount MVC API Routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', (_req, res) => {
  const limiter = ScraperController.getLimiterStatus();
  return res.json({
    status: 'ok',
    database: 'sqlite',
    queued: limiter.queued,
    running: limiter.running,
    campaign: getCampaignStatus(),
  });
});

// SPA Route Fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  const reactIndex = path.join(frontendDist, 'index.html');
  if (fs.existsSync(reactIndex)) {
    return res.sendFile(reactIndex);
  }
  return res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 Omen — Intelligent Lead Discovery & Outreach CRM`);
  console.log(`📦 Database: SQLite (data/crm.db) with WAL mode`);
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log(`========================================================\n`);
});
