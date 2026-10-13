import express from 'express';
import path from 'path';
import { apiRouter } from './routes';
import { ScraperController } from './controllers/ScraperController';
import { OutreachController } from './controllers/OutreachController';
import { getCampaignStatus } from './outreachService';
import './db/database'; // Ensures SQLite DB is initialized & seeded on startup

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 Omen — Intelligent Lead Discovery & Outreach CRM`);
  console.log(`📦 Database: SQLite (data/crm.db) with WAL mode`);
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log(`========================================================\n`);
});
