import { Request, Response } from 'express';
import { z } from 'zod';
import { CategoryModel } from '../models/Category';
import { seedZarqaAllZones } from '../db/database';

const CreateCategorySchema = z.object({
  key: z.string().min(2, 'Key must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  icon: z.string().optional().default('📌'),
  is_active: z.boolean().optional().default(true),
});

const UpdateCategorySchema = z.object({
  key: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  icon: z.string().optional(),
  is_active: z.boolean().optional(),
});

export class CategoryController {
  /**
   * GET /api/categories
   * Returns list of business categories
   */
  static getCategories(req: Request, res: Response) {
    try {
      const activeOnly = req.query.active === 'true';
      const categories = CategoryModel.getAll({ activeOnly });
      return res.json({
        success: true,
        total: categories.length,
        categories,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/categories
   * Create a new category
   */
  static createCategory(req: Request, res: Response) {
    const parsed = CreateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    try {
      const newCat = CategoryModel.create(parsed.data);
      return res.status(201).json({
        success: true,
        message: `Category "${newCat.name}" created successfully.`,
        category: newCat,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          success: false,
          error: `Category key "${parsed.data.key}" already exists.`,
        });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/categories/:id
   * Update category
   */
  static updateCategory(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid category ID' });

    const parsed = UpdateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    try {
      const updated = CategoryModel.update(id, parsed.data);
      if (!updated) return res.status(404).json({ success: false, error: 'Category not found' });
      return res.json({
        success: true,
        message: `Category "${updated.name}" updated successfully.`,
        category: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Delete category
   */
  static deleteCategory(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid category ID' });

    try {
      const deleted = CategoryModel.delete(id);
      if (!deleted) return res.status(404).json({ success: false, error: 'Category not found' });
      return res.json({
        success: true,
        message: 'Category deleted successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/categories/:id/toggle
   * Toggle active state
   */
  static toggleActive(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid category ID' });

    try {
      const updated = CategoryModel.toggleActive(id);
      if (!updated) return res.status(404).json({ success: false, error: 'Category not found' });
      return res.json({
        success: true,
        category: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/categories/sync-zarqa-seeds
   * Trigger reload from seed/zarqa_search_seeds.txt
   */
  static syncZarqaSeeds(_req: Request, res: Response) {
    try {
      const result = seedZarqaAllZones();
      return res.json({
        success: true,
        message: `Synchronized ${result.totalImported} Zarqa seeds into database.`,
        ...result,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
