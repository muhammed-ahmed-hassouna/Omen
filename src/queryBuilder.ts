// -----------------------------------------------------------------------------
// queryBuilder.ts
// Jordanian target zones and category configuration with dynamic tab name resolution.
// -----------------------------------------------------------------------------

import { ZoneModel } from './models/Zone';

export const AMMAN_ZONES = [
  'شارع الرينبو عمان',
  'عبدون عمان',
  'الشميساني عمان',
  'الصويفية عمان',
  'وسط البلد عمان',
  'جبل عمان',
  'شارع مكة عمان',
  'تلاع العلي عمان',
  'خلدا عمان',
  'دابوق عمان',
  'الدوار السابع عمان',
  'الدوار الثامن عمان',
  'الجبيهة عمان',
  'شارع المدينة المنورة عمان',
  'شارع الجامعة الأردنية عمان',
];

// category key -> display label
export const CATEGORY_MAP: Record<string, string> = {
  cafes:           'Cafes',
  'مقاهي':         'Cafes',
  'كافيهات':       'Cafes',
  restaurants:     'Restaurants',
  'مطاعم':         'Restaurants',
  'fast food':     'Fast Food',
  'وجبات سريعة':   'Fast Food',
  'jordanian food':'Jordanian Food',
  'أكلات أردنية':  'Jordanian Food',
  'arabic food':   'Arabic Food',
  'أكلات عربية':   'Arabic Food',
  pizza:           'Pizza',
  'بيتزا':         'Pizza',
  sushi:           'Sushi',
  'سوشي':          'Sushi',
  'burger restaurants': 'Burgers',
  'برجر':          'Burgers',
  gyms:            'Gyms',
  'نوادي رياضية':  'Gyms',
  'جيم':           'Gyms',
  clinics:         'Clinics',
  'عيادات':        'Clinics',
  supermarkets:    'Supermarkets',
  'سوبرماركت':     'Supermarkets',
  pharmacies:      'Pharmacies',
  'صيدليات':       'Pharmacies',
};

/**
 * Builds Google Maps search queries by combining category + zone.
 * Supports any Jordanian city, street, or neighborhood (Amman, Zarqa, Irbid, etc.).
 */
export function buildQueryList(category: string, zones?: string[]): string[] {
  let targetZones = zones;
  if (!targetZones || targetZones.length === 0) {
    targetZones = getZones();
  }

  const isArabic = /[\u0600-\u06FF]/.test(category);
  return targetZones.map(zone => {
    if (category.toLowerCase() === 'zarqaall') {
      return zone.includes('الزرقاء') ? zone : `${zone} الزرقاء`;
    }
    return isArabic ? `${category} في ${zone}` : `${category} in ${zone}`;
  });
}

// Formats category string to a clean Google Sheets tab name
export function formatTabName(category: string): string {
  if (!category) return 'General';
  const trimmed = category.trim();
  if (trimmed.toLowerCase() === 'zarqaall') return 'zarqaAll';
  if (CATEGORY_MAP[trimmed.toLowerCase()]) {
    return CATEGORY_MAP[trimmed.toLowerCase()];
  }
  // Title Case
  return trimmed
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/[\\/?*[\]]/g, ''); // Remove invalid Google Sheet tab characters
}

/**
 * Smart Auto-Routing: Resolves the appropriate Google Sheets tab name
 * based on the business's actual Google Maps category in Arabic or English.
 */
export function resolveSmartTab(category: string | null | undefined, fallbackTab: string = 'General'): string {
  if (!category || !category.trim()) return fallbackTab;
  const lower = category.trim().toLowerCase();

  // 1. Cafes & Coffee
  if (
    /مقهى|كافيه|قهو|كوفي|cafe|coffee|espresso|tea house|شاي/.test(lower)
  ) {
    return 'Cafes';
  }

  // 2. Restaurants & Food & Bakeries
  if (
    /مطعم|أكل|وجب|شاورما|فلافل|مشاوي|برجر|بيتزا|سوشي|مخبز|حلويات|restaurant|food|burger|pizza|sushi|bakery|grill|pastry|bistro|diner/.test(lower)
  ) {
    return 'Restaurants';
  }

  // 3. Gyms & Fitness
  if (
    /جيم|نادي رياضي|لياقة|رياض|gym|fitness|sport|crossfit|workout/.test(lower)
  ) {
    return 'Gyms';
  }

  // 4. Clinics & Healthcare
  if (
    /عياد|طبيب|مركز طبي|مستشفى|أسنان|clinic|medical|doctor|dental|hospital/.test(lower)
  ) {
    return 'Clinics';
  }

  // 5. Pharmacies
  if (
    /صيدل|pharmacy|drugstore|chemist/.test(lower)
  ) {
    return 'Pharmacies';
  }

  // 6. Supermarkets & Grocery
  if (
    /سوبرماركت|بقالة|ماركت|تموينات|supermarket|grocery|mart|market/.test(lower)
  ) {
    return 'Supermarkets';
  }

  // 7. Beauty & Salons
  if (
    /صالون|حلاق|تجميل|سبا|salon|barber|beauty|spa/.test(lower)
  ) {
    return 'Beauty & Salons';
  }

  // 8. Retail & Stores
  if (
    /فخار|متجر|محل|معرض|store|shop|boutique|pottery|retail/.test(lower)
  ) {
    return 'Retail & Stores';
  }

  return formatTabName(category) || fallbackTab;
}

// Returns available zones from SQLite, with fallback to AMMAN_ZONES
export function getZones(city?: string): string[] {
  try {
    const names = ZoneModel.getNames(city);
    return names.length > 0 ? names : AMMAN_ZONES;
  } catch {
    return AMMAN_ZONES;
  }
}

// Returns available categories for the UI
export function getCategories(): { key: string; label: string }[] {
  return Object.entries(CATEGORY_MAP).map(([key, label]) => ({ key, label }));
}
