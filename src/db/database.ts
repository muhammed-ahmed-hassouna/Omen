import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'crm.db');
export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

/**
 * Initialize SQLite tables and indices
 */
export function initDatabase(): void {
  // 1. Migrate zones table to composite UNIQUE(name, city) if needed
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='zones'").get() as { sql?: string } | undefined;
    if (tableInfo?.sql && tableInfo.sql.includes('name TEXT NOT NULL UNIQUE')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS zones_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          city TEXT NOT NULL DEFAULT 'Amman',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(name, city)
        );
        INSERT OR IGNORE INTO zones_v2 (id, name, city, is_active, created_at)
        SELECT id, name, city, is_active, created_at FROM zones;
        DROP TABLE zones;
        ALTER TABLE zones_v2 RENAME TO zones;
        CREATE INDEX IF NOT EXISTS idx_zones_city ON zones(city);
        CREATE INDEX IF NOT EXISTS idx_zones_active ON zones(is_active);
      `);
      console.log('[db] Successfully migrated zones to composite UNIQUE(name, city).');
    }
  } catch (err) {
    console.warn('[db] Zone composite migration notice:', err);
  }

  db.exec(`
    -- Zones Table (Supports any city, street, or governorate in Jordan)
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'Amman',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, city)
    );
    CREATE INDEX IF NOT EXISTS idx_zones_city ON zones(city);
    CREATE INDEX IF NOT EXISTS idx_zones_active ON zones(is_active);

    -- Categories Table (Full CRUD for business search presets & tab mapping)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📌',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_categories_key ON categories(key);

    -- Templates Table (Dynamic offer messages per category)
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      template TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_templates_key ON templates(key);

    -- Seen Places (Fast, indexed deduplication)
    CREATE TABLE IF NOT EXISTS seen_places (
      place_id TEXT PRIMARY KEY,
      business_name TEXT,
      phone TEXT,
      category TEXT,
      zone TEXT,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_seen_place_id ON seen_places(place_id);
    CREATE INDEX IF NOT EXISTS idx_seen_places_phone ON seen_places(phone);

    -- Settings Key-Value Store
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Daily WhatsApp Sent Log for Anti-Ban hard daily caps
    CREATE TABLE IF NOT EXISTS daily_sent_log (
      date TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );
  `);

  seedDefaultZones();
  seedDefaultCategories();
  seedZarqaAllZones();
  seedDefaultTemplates();
  migrateLegacyJsonData();
}

/**
 * Pre-seed Jordanian target zones categorized by city / governorate
 */
function seedDefaultZones(): void {
  const count = (db.prepare('SELECT COUNT(*) as count FROM zones').get() as { count: number }).count;
  if (count > 0) return;

  const insertStmt = db.prepare('INSERT OR IGNORE INTO zones (name, city, is_active) VALUES (?, ?, ?)');

  const defaultZones: Array<{ name: string; city: string }> = [
    // --- Amman Neighborhoods & Streets ---
    { name: 'شارع الرينبو عمان', city: 'Amman' },
    { name: 'عبدون عمان', city: 'Amman' },
    { name: 'الشميساني عمان', city: 'Amman' },
    { name: 'الصويفية عمان', city: 'Amman' },
    { name: 'وسط البلد عمان', city: 'Amman' },
    { name: 'جبل عمان', city: 'Amman' },
    { name: 'شارع مكة عمان', city: 'Amman' },
    { name: 'تلاع العلي عمان', city: 'Amman' },
    { name: 'خلدا عمان', city: 'Amman' },
    { name: 'دابوق عمان', city: 'Amman' },
    { name: 'الدوار السابع عمان', city: 'Amman' },
    { name: 'الدوار الثامن عمان', city: 'Amman' },
    { name: 'الجبيهة عمان', city: 'Amman' },
    { name: 'شارع المدينة المنورة عمان', city: 'Amman' },
    { name: 'شارع الجامعة الأردنية عمان', city: 'Amman' },

    // --- Zarqa (الزرقاء) ---
    { name: 'الزرقاء الجديدة', city: 'Zarqa' },
    { name: 'شارع 36 الزرقاء', city: 'Zarqa' },
    { name: 'وسط البلد الزرقاء', city: 'Zarqa' },
    { name: 'المنطقة الحرة الزرقاء', city: 'Zarqa' },
    { name: 'الغويرية الزرقاء', city: 'Zarqa' },
    { name: 'شارع السعادة الزرقاء', city: 'Zarqa' },
    { name: 'حي معصوم الزرقاء', city: 'Zarqa' },
    { name: 'مدينة الشرق الزرقاء', city: 'Zarqa' },

    // --- Irbid (إربد) ---
    { name: 'شارع الجامعة إربد', city: 'Irbid' },
    { name: 'محيط جامعة اليرموك إربد', city: 'Irbid' },
    { name: 'وسط البلد إربد', city: 'Irbid' },
    { name: 'شارع بغداد إربد', city: 'Irbid' },
    { name: 'شارع فلسطين إربد', city: 'Irbid' },
    { name: 'الحي الشرقي إربد', city: 'Irbid' },

    // --- Aqaba (العقبة) ---
    { name: 'وسط البلد العقبة', city: 'Aqaba' },
    { name: 'المنارة العقبة', city: 'Aqaba' },
    { name: 'شاطئ العقبة الجنوبي', city: 'Aqaba' },
    { name: 'شارع الكورنيش العقبة', city: 'Aqaba' },

    // --- As-Salt (السلط) ---
    { name: 'شارع الحمام السلط', city: 'Salt' },
    { name: 'وسط البلد السلط', city: 'Salt' },
    { name: 'دوار الدبابنة السلط', city: 'Salt' },
  ];

  const transaction = db.transaction((zones) => {
    for (const z of zones) {
      insertStmt.run(z.name, z.city, 1);
    }
  });

  transaction(defaultZones);
  console.log(`[db] Seeded ${defaultZones.length} default Jordanian zones across Amman, Zarqa, Irbid, Aqaba, and Salt.`);
}

/**
 * Pre-seed default business categories
 */
function seedDefaultCategories(): void {
  const count = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (count > 0) return;

  const insertStmt = db.prepare('INSERT OR IGNORE INTO categories (key, name, icon, is_active) VALUES (?, ?, ?, ?)');

  const defaults = [
    { key: 'cafes', name: 'Cafes', icon: '☕' },
    { key: 'restaurants', name: 'Restaurants', icon: '🍽️' },
    { key: 'fast food', name: 'Fast Food', icon: '🍔' },
    { key: 'gyms', name: 'Gyms', icon: '💪' },
    { key: 'clinics', name: 'Clinics', icon: '🩺' },
    { key: 'retail', name: 'Retail & Stores', icon: '🛍️' },
    { key: 'supermarkets', name: 'Supermarkets', icon: '🛒' },
    { key: 'pharmacies', name: 'Pharmacies', icon: '💊' },
    { key: 'bakeries', name: 'Bakeries', icon: '🥖' },
    { key: 'zarqaAll', name: 'Zarqa All', icon: '📍' },
  ];

  const tx = db.transaction((items) => {
    for (const item of items) {
      insertStmt.run(item.key, item.name, item.icon, 1);
    }
  });
  tx(defaults);
  console.log(`[db] Seeded ${defaults.length} default categories in SQLite.`);
}

/**
 * Seed or synchronize Zarqa search seeds from seed/zarqa_search_seeds.txt
 */
export function seedZarqaAllZones(): { totalImported: number; totalInFile: number } {
  const seedPath = path.join(process.cwd(), 'seed', 'zarqa_search_seeds.txt');
  if (!fs.existsSync(seedPath)) {
    console.warn(`[db] Seed file not found at: ${seedPath}`);
    return { totalImported: 0, totalInFile: 0 };
  }

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const uniqueSeeds = Array.from(new Set(lines));

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO zones (name, city, is_active)
    VALUES (?, 'zarqaAll', 1)
  `);

  let added = 0;
  const tx = db.transaction(() => {
    for (const seed of uniqueSeeds) {
      const res = insertStmt.run(seed);
      if (res.changes > 0) added++;
    }
  });
  tx();

  // Ensure category 'zarqaAll' exists in categories
  db.prepare(`
    INSERT OR IGNORE INTO categories (key, name, icon, is_active)
    VALUES ('zarqaAll', 'Zarqa All', '📍', 1)
  `).run();

  // Ensure offer template for 'zarqaAll' exists
  db.prepare(`
    INSERT OR IGNORE INTO templates (key, title, template)
    VALUES ('zarqaall', 'Zarqa All Businesses', 'مرحباً {business_name} 👋 نبارك لكم نجاحكم المتميز في {zone} بالزرقاء! حابين نقدم لكم عرض تسويقي حصري لزيادة المبيعات والوصول لزبائن جدد. هل يمكن مشاركة التفاصيل مع الإدارة؟')
  `).run();

  console.log(`[db] Synced Zarqa search seeds: ${added} added into zones (city='zarqaAll'). Total unique seeds: ${uniqueSeeds.length}`);
  return { totalImported: added, totalInFile: uniqueSeeds.length };
}

/**
 * Pre-seed high-converting Arabic & English business outreach templates
 */
function seedDefaultTemplates(): void {
  const count = (db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number }).count;
  if (count > 0) return;

  const insertStmt = db.prepare('INSERT OR IGNORE INTO templates (key, title, template, updated_at) VALUES (?, ?, ?, ?)');

  const defaultTemplates = [
    {
      key: 'cafes',
      title: 'Cafes & Specialty Coffee',
      template: 'مرحباً فريق {business_name} ☕ لاحظنا تقييمكم المميز ({rating} ⭐) في {zone}. حابين نقدم لكم عرض تسويقي مخصص لتطوير المبيعات واستقطاب زبائن جدد للمقهى بأعلى كفاءة. هل يمكننا مشاركة التفاصيل مع الإدارة؟',
    },
    {
      key: 'restaurants',
      title: 'Restaurants & Fine Dining',
      template: 'أهلاً إدارة {business_name} 👋 نبارك لكم نجاحكم المستمر في {zone}. نود تقديم عرض حصري لتطوير وزيادة طلبات الطعام والتوصيل لمطعمكم بنسبة تتجاوز 30%. هل أنتم مهتمون بالاطلاع على التفاصيل؟',
    },
    {
      key: 'fast food',
      title: 'Fast Food & Grills',
      template: 'مرحباً {business_name} 🍔 لدينا عرض مميز لتسريع استقبال وتجهيز طلبات الوجبات السريعة والتوصيل لفرعكم في {zone}. نتشرف بالتواصل وعرض نبذة سريعة!',
    },
    {
      key: 'gyms',
      title: 'Gyms & Fitness Centers',
      template: 'مرحباً كابتن {business_name} 💪 معجبون بنشاطكم الرياضي المتميز في {zone}! لدينا باقة تسويقية حصرية لجذب اشتراكات شهرية وسنوية جديدة للمركز. يسعدنا اطلاعكم على خطتنا.',
    },
    {
      key: 'clinics',
      title: 'Clinics & Healthcare',
      template: 'تحية طيبة {business_name} 🩺 نود تقديم حل متكامل لأتمتة حجز المواعيد والرد الفوري على استفسارات المراجعين لعيادتكم في {zone} عبر الواتساب مباشرة. هل يمكننا تزويدكم بعرض توضيحي؟',
    },
    {
      key: 'supermarkets',
      title: 'Supermarkets & Grocery',
      template: 'مرحباً {business_name} 🛒 لدينا نظام مبتكر لإرسال العروض الأسبوعية وتنشيط مبيعات التوصيل لزبائن منطقة {zone}. هل نتشرف بالتواصل مع قسم المبيعات أو الإدارة؟',
    },
    {
      key: 'retail & stores',
      title: 'Retail & Stores',
      template: 'مرحباً {business_name} 🛍️ معجبون بمنتجاتكم في {zone}! لدينا عرض خاص لتطوير المبيعات وربط المتجر بحملات واتساب تسويقية مباشرة للمهتمين. هل يناسبكم استلام التفاصيل؟',
    },
    {
      key: 'general',
      title: 'General Businesses',
      template: 'مرحباً {business_name} 👋 لاحظنا نشاطكم المتميز في {zone}. يسعدنا تقديم عرض خاص لتطوير خدماتكم والوصول إلى شريحة أوسع من العملاء المستهدفين في منطقتكم. هل يمكن مشاركة العرض معكم؟',
    },
  ];

  const now = new Date().toISOString();
  const transaction = db.transaction((templates) => {
    for (const t of templates) {
      insertStmt.run(t.key, t.title, t.template, now);
    }
  });

  transaction(defaultTemplates);
  console.log(`[db] Seeded ${defaultTemplates.length} default offer templates.`);
}

/**
 * Migrate data from legacy JSON files (seen_places.json, settings.json, templates.json)
 */
function migrateLegacyJsonData(): void {
  // 1. Migrate Settings (one-time legacy migration if settings.json exists)
  const legacySettingsPath = path.join(DATA_DIR, 'settings.json');
  if (fs.existsSync(legacySettingsPath)) {
    try {
      const raw = fs.readFileSync(legacySettingsPath, 'utf-8');
      const settings = JSON.parse(raw);
      const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [k, v] of Object.entries(settings)) {
        if (v !== undefined && v !== null) {
          insertSetting.run(k, String(v));
        }
      }
      console.log('[db] Migrated legacy settings into SQLite.');
    } catch (err) {
      console.warn('[db] Legacy settings.json migration notice:', err);
    }
  }

  // 4. Clean up any invalid cafes testing template if present
  try {
    const cafesTpl = db.prepare('SELECT template FROM templates WHERE key = ?').get('cafes') as { template: string } | undefined;
    if (cafesTpl && (cafesTpl.template.trim() === 'دزمها' || cafesTpl.template.length < 10)) {
      db.prepare(`
        UPDATE templates 
        SET template = 'مرحباً فريق {business_name} ☕ لاحظنا تقييمكم المميز ({rating} ⭐) في {zone}. حابين نقدم لكم عرض تسويقي مخصص لتطوير المبيعات واستقطاب زبائن جدد للمقهى بأعلى كفاءة. هل يمكننا مشاركة التفاصيل مع الإدارة؟',
            title = 'Cafes & Specialty Coffee',
            updated_at = datetime('now')
        WHERE key = 'cafes'
      `).run();
      console.log('[db] Restored clean cafes offer template in SQLite.');
    }
  } catch { /* ignore */ }
}

// Automatically init upon loading database module
initDatabase();
