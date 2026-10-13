import fs from 'fs';
import path from 'path';
import { BusinessData, CategoryTemplate, HistoryEntry, AppSettings } from './types';
import { SeenPlaceModel } from './models/SeenPlace';
import { TemplateModel } from './models/Template';
import { SettingModel } from './models/Setting';

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const HISTORY_INDEX_PATH = path.join(HISTORY_DIR, 'index.json');

// --- Seen Places Store (SQLite Powered) --------------------------------------

export function loadSeenIds(): Set<string> {
  return SeenPlaceModel.getAllIds();
}

export function saveSeenIds(ids: Set<string>): void {
  // Legacy adapter: Mark dummy places with these IDs if called directly
  const dummyPlaces: BusinessData[] = [...ids].map(id => ({
    place_id: id,
    business_name: '',
    phone_number: null,
    address: null,
    category: null,
    rating: null,
    reviews_count: null,
    website: null,
    opening_hours: null,
    latitude: null,
    longitude: null,
    place_url: ''
  }));
  SeenPlaceModel.markSeenBatch(dummyPlaces);
}

export function clearSeenIds(): void {
  SeenPlaceModel.clearAll();
}

export function getSeenCount(): number {
  return SeenPlaceModel.getCount();
}

// --- Dynamic Offer Templates (SQLite Powered) --------------------------------

export function loadTemplates(): Record<string, CategoryTemplate> {
  return TemplateModel.getAllDict();
}

export function saveTemplates(templates: Record<string, CategoryTemplate>): void {
  for (const [key, tpl] of Object.entries(templates)) {
    TemplateModel.upsert(key, tpl.title || key, tpl.template);
  }
}

// --- App Settings (SQLite Powered) ------------------------------------------

export function loadSettings(): AppSettings {
  return SettingModel.getAll();
}

export function saveSettings(settings: AppSettings): void {
  SettingModel.saveAll(settings);
}

// --- History Archiving (Retained for file snapshots and downloads) -----------

export function archiveScrapeHistory(
  category: string,
  query: string,
  data: BusinessData[],
  newCount: number
): { filename: string; filePath: string } {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  const dayDir = path.join(HISTORY_DIR, dateStr);

  fs.mkdirSync(dayDir, { recursive: true });

  const safeCategory = (category || 'general').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const safeQuery = query.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);
  const filename = `${safeCategory}_${safeQuery}_${timeStr}.json`;
  const fullPath = path.join(dayDir, filename);

  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');

  // Update index.json
  const entry: HistoryEntry = {
    id: `${dateStr}_${timeStr}_${Math.random().toString(36).substring(2, 6)}`,
    date: dateStr,
    timestamp: now.toISOString(),
    category: category || 'general',
    query,
    total_scraped: data.length,
    total_new: newCount,
    filename,
  };

  const list = getHistoryList();
  list.unshift(entry); // newest first
  fs.writeFileSync(HISTORY_INDEX_PATH, JSON.stringify(list, null, 2), 'utf-8');

  return { filename, filePath: path.join('data', 'history', dateStr, filename) };
}

export function getHistoryList(): HistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_INDEX_PATH)) return [];
    const raw = fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getHistoryData(date: string, filename: string): BusinessData[] | null {
  try {
    const targetPath = path.join(HISTORY_DIR, date, filename);
    if (!fs.existsSync(targetPath)) return null;
    return JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
  } catch {
    return null;
  }
}
