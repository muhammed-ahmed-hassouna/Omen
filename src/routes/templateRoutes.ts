import { Router } from 'express';
import { TemplateController } from '../controllers/TemplateController';

export const templateRouter = Router();

templateRouter.get('/', TemplateController.getTemplates);
templateRouter.get('/:key', TemplateController.getTemplate);
templateRouter.post('/', TemplateController.saveTemplate);
templateRouter.delete('/:key', TemplateController.deleteTemplate);
templateRouter.post('/render', TemplateController.renderPreview);
