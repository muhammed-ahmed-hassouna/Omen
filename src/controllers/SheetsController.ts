import { Request, Response } from 'express';
import {
  getGoogleAppsScriptCode,
  pushLeadsToSheet,
  fetchNewLeadsFromSheet,
} from '../sheetsService';
import { ProcessedLead } from '../leadValidator';
import { SettingModel } from '../models/Setting';
import { formatTabName, resolveSmartTab } from '../queryBuilder';

export class SheetsController {
  /**
   * GET /api/sheets/script-code
   * Return copy-paste Google Apps Script code
   */
  static getScriptCode(_req: Request, res: Response) {
    return res.json({ success: true, script: getGoogleAppsScriptCode() });
  }

  /**
   * POST /api/sheets/push
   * Push extracted leads into Google Sheet tabs with smart category auto-routing
   */
  static async pushLeads(req: Request, res: Response) {
    const { webhookUrl, tab_name, category, leads } = req.body;
    const settings = SettingModel.getAll();
    const targetUrl = webhookUrl || settings.googleSheetWebhookUrl;

    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        error: 'Google Sheet Webhook URL is not configured. Add it in Settings or paste the Apps Script URL.',
      });
    }

    try {
      const rawLeads: ProcessedLead[] = leads || [];
      const resolvedCategory = category || 'General';

      if (rawLeads.length === 0) {
        return res.json({ success: true, added: 0, total: 0 });
      }

      // Option 1: Smart Tab Auto-Routing
      // Route Invalid Phone/No Phone to 'Invalid Numbers' tab; route valid mobiles to smart category tab
      const leadsByTab = new Map<string, ProcessedLead[]>();

      for (const lead of rawLeads) {
        let targetTab: string;
        if (lead.status === 'Invalid Phone' || lead.status === 'No Phone') {
          targetTab = 'Invalid Numbers';
        } else {
          targetTab = lead.tab_name || resolveSmartTab(lead.category, tab_name || formatTabName(resolvedCategory));
        }

        if (!leadsByTab.has(targetTab)) {
          leadsByTab.set(targetTab, []);
        }
        leadsByTab.get(targetTab)!.push({
          ...lead,
          tab_name: targetTab,
        });
      }

      let totalAdded = 0;
      const tabSummary: string[] = [];

      for (const [targetTab, tabLeads] of leadsByTab.entries()) {
        const pushRes = await pushLeadsToSheet(
          targetUrl,
          targetTab,
          tabLeads[0]?.category || resolvedCategory,
          tabLeads
        );
        totalAdded += pushRes.added || 0;
        tabSummary.push(`${targetTab} (${pushRes.added || 0})`);
      }

      return res.json({
        success: true,
        tab_name: tabSummary.join(', '),
        added: totalAdded,
        total: rawLeads.length,
      });
    } catch (err: any) {
      console.error('[server] Direct sheets push failed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sheets/new-leads
   * Pull leads marked as 'New' from a specific sheet tab
   */
  static async getNewLeads(req: Request, res: Response) {
    const { webhookUrl, tab_name } = req.body;
    const settings = SettingModel.getAll();
    const targetUrl = webhookUrl || settings.googleSheetWebhookUrl;

    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        error: 'Google Sheet Webhook URL is not configured.',
      });
    }

    try {
      const leads = await fetchNewLeadsFromSheet(targetUrl, tab_name || 'Cafes');
      return res.json({ success: true, leads });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
