import { Request, Response } from 'express';
import { z } from 'zod';
import { TemplateModel } from '../models/Template';

const TemplateSchema = z.object({
  key: z.string().min(1, 'Category key is required'),
  title: z.string().min(1, 'Template title is required'),
  template: z.string().min(5, 'Template message must be at least 5 characters'),
});

export class TemplateController {
  /**
   * GET /api/templates
   * Returns all templates as dictionary and list
   */
  static getTemplates(_req: Request, res: Response) {
    try {
      const templatesDict = TemplateModel.getAllDict();
      const templatesList = TemplateModel.getAllList();
      return res.json({
        success: true,
        templates: templatesDict,
        list: templatesList,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/templates/:key
   * Returns a single template by category key
   */
  static getTemplate(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const tpl = TemplateModel.getByKey(key);
      if (!tpl) {
        return res.status(404).json({ success: false, error: `Template for "${key}" not found` });
      }
      return res.json({ success: true, template: tpl });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/templates
   * Create or update a template
   */
  static saveTemplate(req: Request, res: Response) {
    const parsed = TemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { key, title, template } = parsed.data;

    try {
      const saved = TemplateModel.upsert(key, title, template);
      const all = TemplateModel.getAllDict();
      return res.json({
        success: true,
        message: `Template "${saved.title}" saved successfully.`,
        template: saved,
        templates: all,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/templates/:key
   * Delete a template by category key
   */
  static deleteTemplate(req: Request, res: Response) {
    const { key } = req.params;

    try {
      const deleted = TemplateModel.delete(key);
      if (!deleted) {
        return res.status(404).json({ success: false, error: `Template "${key}" not found` });
      }

      return res.json({
        success: true,
        message: `Template "${key}" deleted successfully.`,
        templates: TemplateModel.getAllDict(),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/templates/render
   * Live preview renderer with sample or lead data
   */
  static renderPreview(req: Request, res: Response) {
    const { template, lead } = req.body;
    if (!template) {
      return res.status(400).json({ success: false, error: 'Template string is required' });
    }

    try {
      const rendered = TemplateModel.render(template, lead);
      return res.json({ success: true, rendered });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
