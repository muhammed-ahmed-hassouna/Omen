import { db } from '../db/database';
import { AppSettings } from '../types';

export class SettingModel {
  /**
   * Get single setting value by key
   */
  static get(key: string, defaultValue: string = ''): string {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  }

  /**
   * Set single setting value
   */
  static set(key: string, value: string): void {
    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  /**
   * Load all application settings as AppSettings object
   */
  static getAll(): AppSettings {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.key, r.value);
    }

    return {
      googleSheetUrl: map.get('googleSheetUrl') || '',
      googleSheetWebhookUrl: map.get('googleSheetWebhookUrl') || '',
      wppconnectUrl: map.get('wppconnectUrl') || 'http://localhost:21465',
      sendDelaySeconds: map.has('sendDelaySeconds') ? parseInt(map.get('sendDelaySeconds')!, 10) : 45,
      delayRandomJitter: map.has('delayRandomJitter') ? parseInt(map.get('delayRandomJitter')!, 10) : 20,
      maxBatchLimit: map.has('maxBatchLimit') ? parseInt(map.get('maxBatchLimit')!, 10) : 0,
      wppSessionName: map.get('wppSessionName') || 'leads-hunter',
      dailyMessageCap: map.has('dailyMessageCap') ? parseInt(map.get('dailyMessageCap')!, 10) : 40,
      batchCooldownEvery: map.has('batchCooldownEvery') ? parseInt(map.get('batchCooldownEvery')!, 10) : 15,
      batchCooldownMinSeconds: map.has('batchCooldownMinSeconds') ? parseInt(map.get('batchCooldownMinSeconds')!, 10) : 180,
      batchCooldownMaxSeconds: map.has('batchCooldownMaxSeconds') ? parseInt(map.get('batchCooldownMaxSeconds')!, 10) : 420,
      sendWindowStart: map.has('sendWindowStart') ? parseInt(map.get('sendWindowStart')!, 10) : 9,
      sendWindowEnd: map.has('sendWindowEnd') ? parseInt(map.get('sendWindowEnd')!, 10) : 20,
      enableMessageVariation: map.has('enableMessageVariation') ? map.get('enableMessageVariation') !== 'false' : true,
    };
  }

  /**
   * Save settings from AppSettings object
   */
  static saveAll(settings: Partial<AppSettings>): AppSettings {
    const current = this.getAll();
    const updated: AppSettings = {
      googleSheetUrl: settings.googleSheetUrl !== undefined ? settings.googleSheetUrl : current.googleSheetUrl,
      googleSheetWebhookUrl: settings.googleSheetWebhookUrl !== undefined ? settings.googleSheetWebhookUrl : current.googleSheetWebhookUrl,
      wppconnectUrl: settings.wppconnectUrl !== undefined ? settings.wppconnectUrl : current.wppconnectUrl,
      sendDelaySeconds: settings.sendDelaySeconds !== undefined ? Number(settings.sendDelaySeconds) : current.sendDelaySeconds,
      delayRandomJitter: settings.delayRandomJitter !== undefined ? Number(settings.delayRandomJitter) : current.delayRandomJitter,
      maxBatchLimit: settings.maxBatchLimit !== undefined ? Number(settings.maxBatchLimit) : current.maxBatchLimit,
      wppSessionName: settings.wppSessionName !== undefined ? settings.wppSessionName : current.wppSessionName,
      dailyMessageCap: settings.dailyMessageCap !== undefined ? Number(settings.dailyMessageCap) : current.dailyMessageCap,
      batchCooldownEvery: settings.batchCooldownEvery !== undefined ? Number(settings.batchCooldownEvery) : current.batchCooldownEvery,
      batchCooldownMinSeconds: settings.batchCooldownMinSeconds !== undefined ? Number(settings.batchCooldownMinSeconds) : current.batchCooldownMinSeconds,
      batchCooldownMaxSeconds: settings.batchCooldownMaxSeconds !== undefined ? Number(settings.batchCooldownMaxSeconds) : current.batchCooldownMaxSeconds,
      sendWindowStart: settings.sendWindowStart !== undefined ? Number(settings.sendWindowStart) : current.sendWindowStart,
      sendWindowEnd: settings.sendWindowEnd !== undefined ? Number(settings.sendWindowEnd) : current.sendWindowEnd,
      enableMessageVariation: settings.enableMessageVariation !== undefined ? Boolean(settings.enableMessageVariation) : current.enableMessageVariation,
    };

    const stmt = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = db.transaction((s: AppSettings) => {
      stmt.run('googleSheetUrl', s.googleSheetUrl);
      stmt.run('googleSheetWebhookUrl', s.googleSheetWebhookUrl);
      stmt.run('wppconnectUrl', s.wppconnectUrl);
      stmt.run('sendDelaySeconds', String(s.sendDelaySeconds ?? 45));
      stmt.run('delayRandomJitter', String(s.delayRandomJitter ?? 20));
      stmt.run('maxBatchLimit', String(s.maxBatchLimit ?? 0));
      stmt.run('wppSessionName', s.wppSessionName ?? 'leads-hunter');
      stmt.run('dailyMessageCap', String(s.dailyMessageCap ?? 40));
      stmt.run('batchCooldownEvery', String(s.batchCooldownEvery ?? 15));
      stmt.run('batchCooldownMinSeconds', String(s.batchCooldownMinSeconds ?? 180));
      stmt.run('batchCooldownMaxSeconds', String(s.batchCooldownMaxSeconds ?? 420));
      stmt.run('sendWindowStart', String(s.sendWindowStart ?? 9));
      stmt.run('sendWindowEnd', String(s.sendWindowEnd ?? 20));
      stmt.run('enableMessageVariation', String(s.enableMessageVariation ?? true));
    });

    tx(updated);
    return updated;
  }
}
