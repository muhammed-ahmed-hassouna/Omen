import { Router } from 'express';
import { zoneRouter } from './zoneRoutes';
import { categoryRouter } from './categoryRoutes';
import { templateRouter } from './templateRoutes';
import { scraperRouter } from './scraperRoutes';
import { outreachRouter } from './outreachRoutes';
import { sheetsRouter } from './sheetsRoutes';
import { ConfigController } from '../controllers/ConfigController';

export const apiRouter = Router();

// Modular Sub-routers
apiRouter.use('/zones', zoneRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/templates', templateRouter);
apiRouter.use('/scrape', scraperRouter);
apiRouter.use('/outreach', outreachRouter);
apiRouter.use('/sheets', sheetsRouter);

// Config, Settings, History, and Seen Places
apiRouter.get('/config', ConfigController.getConfig);
apiRouter.get('/settings', ConfigController.getSettings);
apiRouter.post('/settings', ConfigController.saveSettings);
apiRouter.get('/seen', ConfigController.getSeenCount);
apiRouter.delete('/seen', ConfigController.clearSeen);
apiRouter.get('/history', ConfigController.getHistoryList);
apiRouter.get('/history/:date/:filename', ConfigController.getHistoryData);
