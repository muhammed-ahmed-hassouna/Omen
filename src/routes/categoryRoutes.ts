import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';

export const categoryRouter = Router();

categoryRouter.get('/', CategoryController.getCategories);
categoryRouter.post('/', CategoryController.createCategory);
categoryRouter.put('/:id', CategoryController.updateCategory);
categoryRouter.post('/:id/toggle', CategoryController.toggleActive);
categoryRouter.delete('/:id', CategoryController.deleteCategory);
categoryRouter.post('/sync-zarqa-seeds', CategoryController.syncZarqaSeeds);
