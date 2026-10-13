import { Request, Response } from 'express';
import {
  startWhatsAppCampaign,
  stopCampaign,
  getCampaignStatus,
  checkWppConnection,
  startWppSession,
  logoutWppSession,
} from '../outreachService';
import { SettingModel } from '../models/Setting';
import { DailyLogModel } from '../models/DailyLog';
import { formatTabName } from '../queryBuilder';

export class OutreachController {
  /**
   * POST /api/outreach/start
   * Start a WhatsApp outreach campaign to leads
   */
  static async startCampaign(req: Request, res: Response) {
    const { leads, category, tab_name, delaySeconds, jitterSeconds, maxBatch, customMessage, message } = req.body;
    const settings = SettingModel.getAll();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads provided to contact.' });
    }

    const effectiveDelay = delaySeconds !== undefined ? Number(delaySeconds) : (settings.sendDelaySeconds ?? 45);
    const effectiveJitter = jitterSeconds !== undefined ? Number(jitterSeconds) : (settings.delayRandomJitter ?? 20);
    const effectiveMaxBatch = maxBatch !== undefined ? Number(maxBatch) : (settings.maxBatchLimit ?? 0);
    const effectiveMessage = (customMessage || message || '').trim();

    const targetLeads = effectiveMaxBatch > 0 ? leads.slice(0, effectiveMaxBatch) : leads;

    const antiBanConfig = {
      dailyCap: req.body.dailyCap !== undefined ? Number(req.body.dailyCap) : (settings.dailyMessageCap ?? 40),
      batchCooldownEvery: req.body.batchCooldownEvery !== undefined ? Number(req.body.batchCooldownEvery) : (settings.batchCooldownEvery ?? 15),
      batchCooldownMinSeconds: req.body.batchCooldownMinSeconds !== undefined ? Number(req.body.batchCooldownMinSeconds) : (settings.batchCooldownMinSeconds ?? 180),
      batchCooldownMaxSeconds: req.body.batchCooldownMaxSeconds !== undefined ? Number(req.body.batchCooldownMaxSeconds) : (settings.batchCooldownMaxSeconds ?? 420),
      sendWindowStart: req.body.sendWindowStart !== undefined ? Number(req.body.sendWindowStart) : (settings.sendWindowStart ?? 9),
      sendWindowEnd: req.body.sendWindowEnd !== undefined ? Number(req.body.sendWindowEnd) : (settings.sendWindowEnd ?? 20),
      enableVariation: req.body.enableVariation !== undefined ? Boolean(req.body.enableVariation) : (settings.enableMessageVariation ?? true),
    };

    const result = await startWhatsAppCampaign(
      targetLeads,
      category || 'Cafes',
      tab_name || formatTabName(category || 'Cafes'),
      settings.wppconnectUrl,
      settings.googleSheetWebhookUrl,
      effectiveDelay,
      effectiveJitter,
      settings.wppSessionName || 'leads-hunter',
      effectiveMessage || undefined,
      antiBanConfig
    );

    return res.json(result);
  }

  /**
   * GET /api/outreach/daily-stats
   * Get current daily sent count and remaining anti-ban cap
   */
  static getDailyStats(_req: Request, res: Response) {
    const stats = DailyLogModel.getDailyStats();
    return res.json({ success: true, stats });
  }

  /**
   * POST /api/outreach/daily-stats/reset
   * Reset today's sent count to 0
   */
  static resetDailyStats(_req: Request, res: Response) {
    DailyLogModel.resetToday();
    const stats = DailyLogModel.getDailyStats();
    return res.json({ success: true, message: "Today's message counter reset to 0.", stats });
  }

  /**
   * GET /api/outreach/status
   * Get current progress of the running campaign
   */
  static getStatus(_req: Request, res: Response) {
    return res.json({ success: true, status: getCampaignStatus() });
  }

  /**
   * POST /api/outreach/stop
   * Abort the active campaign
   */
  static stopCampaign(_req: Request, res: Response) {
    stopCampaign();
    return res.json({ success: true, message: 'Stop signal sent.' });
  }

  /**
   * GET /api/outreach/wpp-status
   * Check WPPConnect connection and authentication
   */
  static async getWppStatus(_req: Request, res: Response) {
    const settings = SettingModel.getAll();
    const status = await checkWppConnection(settings.wppconnectUrl);
    return res.json({ success: true, ...status });
  }

  /**
   * POST /api/outreach/wpp-start
   * Initialize a new WPPConnect session to generate or refresh QR code
   */
  static async startWppSession(_req: Request, res: Response) {
    const settings = SettingModel.getAll();
    const result = await startWppSession(settings.wppconnectUrl);
    return res.json(result);
  }

  /**
   * POST /api/outreach/wpp-logout
   * Disconnect and logout current WhatsApp session
   */
  static async logoutWppSession(_req: Request, res: Response) {
    const settings = SettingModel.getAll();
    const result = await logoutWppSession(
      settings.wppconnectUrl,
      settings.wppSessionName || 'leads-hunter'
    );
    return res.json(result);
  }
}
