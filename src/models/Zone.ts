import { db } from '../db/database';

export interface ZoneRecord {
  id: number;
  name: string;
  city: string;
  is_active: number;
  created_at: string;
}

export class ZoneModel {
  /**
   * Get all zones, optionally filtered by city or active status
   */
  static getAll(options?: { city?: string; activeOnly?: boolean }): ZoneRecord[] {
    let query = 'SELECT * FROM zones WHERE 1=1';
    const params: any[] = [];

    if (options?.city && options.city.toLowerCase() !== 'all') {
      query += ' AND LOWER(city) = LOWER(?)';
      params.push(options.city);
    }

    if (options?.activeOnly) {
      query += ' AND is_active = 1';
    }

    query += ' ORDER BY city ASC, id ASC';
    return db.prepare(query).all(...params) as ZoneRecord[];
  }

  /**
   * Get distinct list of cities
   */
  static getCities(): string[] {
    const rows = db.prepare('SELECT DISTINCT city FROM zones ORDER BY city ASC').all() as { city: string }[];
    return rows.map(r => r.city);
  }

  /**
   * Get single zone by ID
   */
  static getById(id: number): ZoneRecord | undefined {
    return db.prepare('SELECT * FROM zones WHERE id = ?').get(id) as ZoneRecord | undefined;
  }

  /**
   * Create a new zone / street
   */
  static create(name: string, city: string = 'Amman', isActive: boolean = true): ZoneRecord {
    const trimmedName = name.trim();
    const trimmedCity = city.trim() || 'Amman';

    const insert = db.prepare(`
      INSERT INTO zones (name, city, is_active)
      VALUES (?, ?, ?)
    `);
    const info = insert.run(trimmedName, trimmedCity, isActive ? 1 : 0);
    return this.getById(Number(info.lastInsertRowid))!;
  }

  /**
   * Update an existing zone
   */
  static update(id: number, data: { name?: string; city?: string; is_active?: number | boolean }): ZoneRecord | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const newName = data.name !== undefined ? data.name.trim() : existing.name;
    const newCity = data.city !== undefined ? data.city.trim() : existing.city;
    const newActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;

    db.prepare(`
      UPDATE zones
      SET name = ?, city = ?, is_active = ?
      WHERE id = ?
    `).run(newName, newCity, newActive, id);

    return this.getById(id);
  }

  /**
   * Delete a zone by ID
   */
  static delete(id: number): boolean {
    const info = db.prepare('DELETE FROM zones WHERE id = ?').run(id);
    return info.changes > 0;
  }

  /**
   * Bulk insert multiple zones
   */
  static createBulk(names: string[], city: string = 'Amman', isActive: boolean = true): { added: number; skipped: number } {
    const trimmedCity = city.trim() || 'Amman';
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO zones (name, city, is_active)
      VALUES (?, ?, ?)
    `);

    let added = 0;
    let skipped = 0;

    const tx = db.transaction((list: string[]) => {
      for (const rawName of list) {
        const trimmed = rawName.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const res = insertStmt.run(trimmed, trimmedCity, isActive ? 1 : 0);
        if (res.changes > 0) added++;
        else skipped++;
      }
    });

    tx(names);
    return { added, skipped };
  }

  /**
   * Toggle active status of a zone
   */
  static toggleActive(id: number): ZoneRecord | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const newActive = existing.is_active ? 0 : 1;
    db.prepare('UPDATE zones SET is_active = ? WHERE id = ?').run(newActive, id);
    return this.getById(id);
  }

  /**
   * Get zone names array for scraping
   */
  static getNames(city?: string): string[] {
    const zones = this.getAll({ city, activeOnly: true });
    return zones.map(z => z.name);
  }
}
