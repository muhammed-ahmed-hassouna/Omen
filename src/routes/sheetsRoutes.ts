import { Router } from 'express';
import { SheetsController } from '../controllers/SheetsController';

export const sheetsRouter = Router();

sheetsRouter.get('/script-code', SheetsController.getScriptCode);
sheetsRouter.post('/push', SheetsController.pushLeads);
sheetsRouter.post('/new-leads', SheetsController.getNewLeads);
