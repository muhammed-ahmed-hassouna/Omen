import { Router } from 'express';
import { ScraperController } from '../controllers/ScraperController';

export const scraperRouter = Router();

scraperRouter.post('/', ScraperController.scrapeSingle);
scraperRouter.post('/batch', ScraperController.scrapeBatch);
