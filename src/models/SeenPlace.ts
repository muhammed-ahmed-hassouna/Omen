import { db } from '../db/database';
import { BusinessData } from '../types';
import { cleanJordanianPhone } from '../leadValidator';
import { normalizeArabicDigits } from '../parser';

export class SeenPlaceModel {
  /**
   * Check if a single place_id or phone has already been seen in SQLite
   */
  static isSeen(placeId?: string | null, rawPhone?: string | null): boolean {
    if (placeId) {
      const row = db.prepare('SELECT 1 FROM seen_places WHERE place_id = ?').get(placeId);
      if (row) return true;
    }

    if (rawPhone) {
      const phoneInfo = cleanJordanianPhone(rawPhone);
      const canonicalPhone = phoneInfo.formattedPhone || phoneInfo.raw;
      if (canonicalPhone) {
        const row = db.prepare('SELECT 1 FROM seen_places WHERE phone = ?').get(canonicalPhone);
        if (row) return true;
      }
    }

    return false;
  }

  /**
   * Filter an array of business leads to return only unseen leads.
   * Performs:
   * 1. Intra-batch deduplication (removes duplicate place_ids and phones in the same scrape).
   * 2. Fast indexed SQLite lookup across both `place_id` and normalized `phone`.
   */
  static filterUnseen(leads: BusinessData[]): { newLeads: BusinessData[]; seenCount: number } {
    if (!leads || leads.length === 0) {
      return { newLeads: [], seenCount: 0 };
    }

    // Step 1: Intra-batch deduplication (guarantees unique listings within the input)
    const uniqueLeads: BusinessData[] = [];
    const inBatchSeenIds = new Set<string>();
    const inBatchSeenPhones = new Set<string>();

    for (const lead of leads) {
      const placeId = lead.place_id?.trim();
      const phoneInfo = cleanJordanianPhone(lead.phone_number);
      const canonicalPhone = phoneInfo.isValidMobile ? phoneInfo.formattedPhone : null;

      // Check intra-batch duplication
      if (placeId && inBatchSeenIds.has(placeId)) {
        continue;
      }
      if (canonicalPhone && inBatchSeenPhones.has(canonicalPhone)) {
        continue;
      }

      if (placeId) inBatchSeenIds.add(placeId);
      if (canonicalPhone) inBatchSeenPhones.add(canonicalPhone);
      uniqueLeads.push(lead);
    }

    // Step 2: Query SQLite for existing place_ids
    const candidatePlaceIds = Array.from(inBatchSeenIds);
    const dbSeenPlaceIds = new Set<string>();

    if (candidatePlaceIds.length > 0) {
      // Chunk in groups of 500 to stay well under SQLite parameter limits
      for (let i = 0; i < candidatePlaceIds.length; i += 500) {
        const chunk = candidatePlaceIds.slice(i, i + 500);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = db
          .prepare(`SELECT place_id FROM seen_places WHERE place_id IN (${placeholders})`)
          .all(...chunk) as { place_id: string }[];
        rows.forEach((r) => dbSeenPlaceIds.add(r.place_id));
      }
    }

    // Step 3: Query SQLite for existing phone numbers
    const candidatePhones = Array.from(inBatchSeenPhones);
    const dbSeenPhones = new Set<string>();

    if (candidatePhones.length > 0) {
      for (let i = 0; i < candidatePhones.length; i += 500) {
        const chunk = candidatePhones.slice(i, i + 500);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = db
          .prepare(`SELECT phone FROM seen_places WHERE phone IS NOT NULL AND phone IN (${placeholders})`)
          .all(...chunk) as { phone: string }[];
        rows.forEach((r) => dbSeenPhones.add(r.phone));
      }
    }

    // Step 4: Retain only leads that are unseen in both place_id and phone
    const newLeads = uniqueLeads.filter((l) => {
      const placeId = l.place_id?.trim();
      if (placeId && dbSeenPlaceIds.has(placeId)) {
        return false;
      }

      const phoneInfo = cleanJordanianPhone(l.phone_number);
      const canonicalPhone = phoneInfo.isValidMobile ? phoneInfo.formattedPhone : null;
      if (canonicalPhone && dbSeenPhones.has(canonicalPhone)) {
        return false;
      }

      return true;
    });

    const seenCount = leads.length - newLeads.length;
    return { newLeads, seenCount };
  }

  /**
   * Mark leads as seen in SQLite database in a single fast transaction.
   * Canonicalizes phone numbers and generates fallback IDs for places missing a place_id.
   */
  static markSeenBatch(leads: BusinessData[]): void {
    if (!leads || leads.length === 0) return;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO seen_places (place_id, business_name, phone, category, zone)
      VALUES (?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((items: BusinessData[]) => {
      for (const item of items) {
        const phoneInfo = cleanJordanianPhone(item.phone_number);
        const canonicalPhone = phoneInfo.formattedPhone || item.phone_number || null;

        // Generate synthetic place_id if missing to prevent duplicate reprocessing
        let placeId = item.place_id?.trim();
        if (!placeId) {
          const normName = normalizeArabicDigits(item.business_name || 'unnamed')
            .toLowerCase()
            .replace(/[\s\W]+/g, '_');
          const phonePart = canonicalPhone ? canonicalPhone.replace(/\D/g, '') : 'nophone';
          placeId = `synth_${normName}_${phonePart}`;
        }

        stmt.run(
          placeId,
          item.business_name || null,
          canonicalPhone,
          item.category || null,
          item.address || null
        );
      }
    });

    tx(leads);
  }

  /**
   * Get all seen place IDs as a Set (for backward compatibility)
   */
  static getAllIds(): Set<string> {
    const rows = db.prepare('SELECT place_id FROM seen_places').all() as { place_id: string }[];
    return new Set(rows.map((r) => r.place_id));
  }

  /**
   * Total count of seen places in SQLite
   */
  static getCount(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM seen_places').get() as { count: number };
    return row?.count || 0;
  }

  /**
   * Clear all seen places
   */
  static clearAll(): void {
    db.prepare('DELETE FROM seen_places').run();
  }
}
