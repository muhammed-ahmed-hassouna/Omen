import { db } from '../db/database';

export interface CategoryRecord {
  id: number;
  key: string;
  name: string;
  icon: string;
  is_active: number;
  created_at: string;
}

export class CategoryModel {
  /**
   * Get all categories, optionally filtered by active status
   */
  static getAll(options?: { activeOnly?: boolean }): CategoryRecord[] {
    let query = 'SELECT * FROM categories WHERE 1=1';
    if (options?.activeOnly) {
      query += ' AND is_active = 1';
    }
    query += ' ORDER BY id ASC';
    return db.prepare(query).all() as CategoryRecord[];
  }

  /**
   * Get single category by ID
   */
  static getById(id: number): CategoryRecord | undefined {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRecord | undefined;
  }

  /**
   * Get single category by key (e.g. 'cafes', 'zarqaAll')
   */
  static getByKey(key: string): CategoryRecord | undefined {
    return db.prepare('SELECT * FROM categories WHERE LOWER(key) = LOWER(?)').get(key) as CategoryRecord | undefined;
  }

  /**
   * Create a new category
   */
  static create(data: { key: string; name: string; icon?: string; is_active?: boolean }): CategoryRecord {
    const key = data.key.trim().toLowerCase();
    const name = data.name.trim();
    const icon = data.icon?.trim() || '📌';
    const isActive = data.is_active !== false ? 1 : 0;

    const info = db.prepare(`
      INSERT INTO categories (key, name, icon, is_active)
      VALUES (?, ?, ?, ?)
    `).run(key, name, icon, isActive);

    return this.getById(Number(info.lastInsertRowid))!;
  }

  /**
   * Update category
   */
  static update(id: number, data: { key?: string; name?: string; icon?: string; is_active?: boolean | number }): CategoryRecord | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const newKey = data.key !== undefined ? data.key.trim().toLowerCase() : existing.key;
    const newName = data.name !== undefined ? data.name.trim() : existing.name;
    const newIcon = data.icon !== undefined ? data.icon.trim() : existing.icon;
    const newActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;

    db.prepare(`
      UPDATE categories
      SET key = ?, name = ?, icon = ?, is_active = ?
      WHERE id = ?
    `).run(newKey, newName, newIcon, newActive, id);

    return this.getById(id);
  }

  /**
   * Delete category by ID
   */
  static delete(id: number): boolean {
    const info = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return info.changes > 0;
  }

  /**
   * Toggle active state
   */
  static toggleActive(id: number): CategoryRecord | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const newActive = existing.is_active ? 0 : 1;
    db.prepare('UPDATE categories SET is_active = ? WHERE id = ?').run(newActive, id);
    return this.getById(id);
  }
}
