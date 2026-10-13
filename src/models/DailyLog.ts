import { db } from '../db/database';
import { SettingModel } from './Setting';

export class DailyLogModel {
  /**
   * Get current date string in YYYY-MM-DD format (local date)
   */
  static getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get total messages sent for a given date
   */
  static getSentCount(date: string = DailyLogModel.getTodayString()): number {
    const row = db.prepare('SELECT count FROM daily_sent_log WHERE date = ?').get(date) as { count: number } | undefined;
    return row ? row.count : 0;
  }

  /**
   * Increment sent count for date by 1
   */
  static increment(date: string = DailyLogModel.getTodayString()): number {
    const stmt = db.prepare(`
      INSERT INTO daily_sent_log (date, count)
      VALUES (?, 1)
      ON CONFLICT(date) DO UPDATE SET count = daily_sent_log.count + 1
    `);
    stmt.run(date);
    return DailyLogModel.getSentCount(date);
  }

  /**
   * Reset sent count for date (default today) to 0
   */
  static resetToday(date: string = DailyLogModel.getTodayString()): void {
    db.prepare('DELETE FROM daily_sent_log WHERE date = ?').run(date);
  }

  /**
   * Get complete daily statistics with remaining allowance
   */
  static getDailyStats() {
    const settings = SettingModel.getAll();
    const today = DailyLogModel.getTodayString();
    const sentToday = DailyLogModel.getSentCount(today);
    const cap = settings.dailyMessageCap !== undefined ? settings.dailyMessageCap : 40;
    const remaining = cap > 0 ? Math.max(0, cap - sentToday) : 999999;

    return {
      today,
      sent_today: sentToday,
      daily_cap: cap,
      remaining,
      is_limit_reached: cap > 0 && sentToday >= cap,
    };
  }
}
