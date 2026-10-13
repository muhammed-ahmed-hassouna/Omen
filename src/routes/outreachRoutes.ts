import { Router } from 'express';
import { OutreachController } from '../controllers/OutreachController';

export const outreachRouter = Router();

outreachRouter.post('/start', OutreachController.startCampaign);
outreachRouter.get('/status', OutreachController.getStatus);
outreachRouter.get('/daily-stats', OutreachController.getDailyStats);
outreachRouter.post('/daily-stats/reset', OutreachController.resetDailyStats);
outreachRouter.post('/stop', OutreachController.stopCampaign);
outreachRouter.get('/wpp-status', OutreachController.getWppStatus);
outreachRouter.post('/wpp-start', OutreachController.startWppSession);
outreachRouter.post('/wpp-logout', OutreachController.logoutWppSession);
