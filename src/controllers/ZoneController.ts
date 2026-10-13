import { Request, Response } from 'express';
import { z } from 'zod';
import { ZoneModel } from '../models/Zone';

const CreateZoneSchema = z.object({
  name: z.string().min(2, 'Zone name must be at least 2 characters'),
  city: z.string().optional().default('Amman'),
  is_active: z.boolean().optional().default(true),
});

const UpdateZoneSchema = z.object({
  name: z.string().min(2).optional(),
  city: z.string().optional(),
  is_active: z.boolean().optional(),
});

export class ZoneController {
  /**
   * GET /api/zones
   * Returns list of zones, optionally filtered by ?city= or ?active=true
   */
  static getZones(req: Request, res: Response) {
    try {
      const city = req.query.city as string | undefined;
      const activeOnly = req.query.active === 'true';

      const zones = ZoneModel.getAll({ city, activeOnly });
      const cities = ZoneModel.getCities();

      return res.json({
        success: true,
        total: zones.length,
        cities,
        zones,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/zones/cities
   * Returns distinct list of cities
   */
  static getCities(_req: Request, res: Response) {
    try {
      const cities = ZoneModel.getCities();
      return res.json({ success: true, cities });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/zones
   * Create a new zone / street
   */
  static createZone(req: Request, res: Response) {
    const parsed = CreateZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { name, city, is_active } = parsed.data;

    try {
      const newZone = ZoneModel.create(name, city, is_active);
      return res.status(201).json({
        success: true,
        message: `Zone "${newZone.name}" created successfully.`,
        zone: newZone,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          success: false,
          error: `A zone with the name "${name}" already exists.`,
        });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/zones/:id
   * Update zone name, city, or is_active toggle
   */
  static updateZone(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid zone ID' });
    }

    const parsed = UpdateZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    try {
      const updated = ZoneModel.update(id, parsed.data);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Zone not found' });
      }

      return res.json({
        success: true,
        message: `Zone "${updated.name}" updated successfully.`,
        zone: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/zones/:id
   * Delete a zone
   */
  static deleteZone(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid zone ID' });
    }

    try {
      const deleted = ZoneModel.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Zone not found' });
      }

      return res.json({
        success: true,
        message: 'Zone deleted successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/zones/bulk
   * Bulk import multiple zones
   */
  static createZonesBulk(req: Request, res: Response) {
    const { names, city, is_active } = req.body;
    if (!names || !Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ success: false, error: 'Must provide an array of zone names' });
    }

    try {
      const result = ZoneModel.createBulk(names, city || 'zarqaAll', is_active !== false);
      return res.status(201).json({
        success: true,
        message: `Successfully imported ${result.added} zones (${result.skipped} skipped duplicates).`,
        ...result,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/zones/:id/toggle
   * Toggle is_active status of a zone
   */
  static toggleZoneActive(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid zone ID' });
    }

    try {
      const updated = ZoneModel.toggleActive(id);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Zone not found' });
      }

      return res.json({
        success: true,
        zone: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
