import { db } from '../db/database';
import { CategoryTemplate } from '../types';

export class TemplateModel {
  /**
   * Get all templates as a dictionary keyed by template key (lowercased)
   */
  static getAllDict(): Record<string, CategoryTemplate> {
    const rows = db.prepare('SELECT key, title, template, updated_at FROM templates ORDER BY id ASC').all() as CategoryTemplate[];
    const result: Record<string, CategoryTemplate> = {};
    for (const row of rows) {
      result[row.key.toLowerCase()] = row;
    }
    return result;
  }

  /**
   * Get all templates as an array
   */
  static getAllList(): CategoryTemplate[] {
    return db.prepare('SELECT key, title, template, updated_at FROM templates ORDER BY id ASC').all() as CategoryTemplate[];
  }

  /**
   * Get a single template by category key
   */
  static getByKey(key: string): CategoryTemplate | undefined {
    const normalizedKey = key.trim().toLowerCase();
    return db.prepare('SELECT key, title, template, updated_at FROM templates WHERE LOWER(key) = ?').get(normalizedKey) as CategoryTemplate | undefined;
  }

  /**
   * Upsert (Create or Update) a template
   */
  static upsert(key: string, title: string, template: string): CategoryTemplate {
    const normalizedKey = key.trim().toLowerCase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO templates (key, title, template, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        title = excluded.title,
        template = excluded.template,
        updated_at = excluded.updated_at
    `).run(normalizedKey, title.trim(), template.trim(), now);

    return this.getByKey(normalizedKey)!;
  }

  /**
   * Delete a template by category key
   */
  static delete(key: string): boolean {
    const normalizedKey = key.trim().toLowerCase();
    const info = db.prepare('DELETE FROM templates WHERE LOWER(key) = ?').run(normalizedKey);
    return info.changes > 0;
  }

  /**
   * Render personalized template preview
   */
  static render(templateStr: string, leadData?: Partial<{
    business_name: string;
    category: string;
    zone: string;
    rating: string | number;
    reviews_count: string | number;
    phone_number: string;
  }>): string {
    const sample = {
      business_name: leadData?.business_name || 'Trasimeno Specialty Coffee',
      category: leadData?.category || 'Cafes',
      zone: leadData?.zone || 'Rainbow Street Amman',
      rating: leadData?.rating !== undefined ? String(leadData.rating) : '4.8',
      reviews_count: leadData?.reviews_count !== undefined ? String(leadData.reviews_count) : '52',
      phone_number: leadData?.phone_number || '+962791234567',
    };

    return templateStr
      .replace(/\{business_name\}/g, sample.business_name)
      .replace(/\{category\}/g, sample.category)
      .replace(/\{zone\}/g, sample.zone)
      .replace(/\{rating\}/g, sample.rating)
      .replace(/\{reviews_count\}/g, sample.reviews_count)
      .replace(/\{phone_number\}/g, sample.phone_number);
  }
}
