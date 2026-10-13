import { Request, Response } from 'express';
import { SettingModel } from '../models/Setting';
import { SeenPlaceModel } from '../models/SeenPlace';
import { ZoneModel } from '../models/Zone';
import { CategoryModel } from '../models/Category';
import { getCategories } from '../queryBuilder';
import { AppSettings } from '../types';
import { getHistoryList, getHistoryData } from '../store';

export class ConfigController {
  /**
   * GET /api/config
   * Initial bootstrap configuration for frontend
   */
  static getConfig(_req: Request, res: Response) {
    try {
      const zones = ZoneModel.getAll({ activeOnly: true });
      const cities = ZoneModel.getCities();
      const dbCategories = CategoryModel.getAll({ activeOnly: true });
      const categories = dbCategories.length > 0
        ? dbCategories.map(c => ({ key: c.key, label: `${c.icon} ${c.name}` }))
        : getCategories();
      const seenCount = SeenPlaceModel.getCount();
      const settings = SettingModel.getAll();

      return res.json({
        success: true,
        zones: zones.map(z => z.name),
        all_zones: zones,
        cities,
        categories,
        seen_count: seenCount,
        settings,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/settings
   */
  static getSettings(_req: Request, res: Response) {
    return res.json({ success: true, settings: SettingModel.getAll() });
  }

  /**
   * POST /api/settings
   */
  static saveSettings(req: Request, res: Response) {
    const {
      googleSheetUrl,
      googleSheetWebhookUrl,
      wppconnectUrl,
      sendDelaySeconds,
      delayRandomJitter,
      maxBatchLimit,
      wppSessionName,
    } = req.body;

    const updated: AppSettings = {
      googleSheetUrl: googleSheetUrl || '',
      googleSheetWebhookUrl: googleSheetWebhookUrl || '',
      wppconnectUrl: wppconnectUrl || 'http://localhost:21465',
      sendDelaySeconds: sendDelaySeconds !== undefined ? Number(sendDelaySeconds) : 30,
      delayRandomJitter: delayRandomJitter !== undefined ? Number(delayRandomJitter) : 10,
      maxBatchLimit: maxBatchLimit !== undefined ? Number(maxBatchLimit) : 0,
      wppSessionName: wppSessionName || 'leads-hunter',
    };
    SettingModel.saveAll(updated);
    return res.json({ success: true, settings: updated });
  }

  /**
   * GET /api/seen
   */
  static getSeenCount(_req: Request, res: Response) {
    return res.json({ success: true, total_seen: SeenPlaceModel.getCount() });
  }

  /**
   * DELETE /api/seen
   */
  static clearSeen(_req: Request, res: Response) {
    SeenPlaceModel.clearAll();
    console.log('[server] Seen places cleared in SQLite');
    return res.json({
      success: true,
      message: 'Seen places store cleared in SQLite. Next scrape will treat all results as new.',
    });
  }

  /**
   * GET /api/history
   */
  static getHistoryList(_req: Request, res: Response) {
    return res.json({ success: true, history: getHistoryList() });
  }

  /**
   * GET /api/history/:date/:filename
   */
  static getHistoryData(req: Request, res: Response) {
    const { date, filename } = req.params;
    const data = getHistoryData(date, filename);
    if (!data) {
      return res.status(404).json({ success: false, error: 'History file not found' });
    }
    return res.json({ success: true, date, filename, data });
  }
}
