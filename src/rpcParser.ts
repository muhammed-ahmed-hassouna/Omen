import { BusinessData } from './types';
import { normalizeArabicDigits } from './parser';

/**
 * Robustly parses the internal Google Maps RPC response (`search?tbm=map` and pagination batches).
 * Google Maps returns arrays where business listings reside at index [64].
 */
export function parseGoogleMapsRpc(rawText: string): BusinessData[] {
  if (!rawText || typeof rawText !== 'string') return [];

  // Strip Google anti-XSSI prefixes: `/* ... */` or `)]}'`
  const cleaned = rawText
    .replace(/^\/\*[\s\S]*?\*\//, '')
    .replace(/^\)\]\}'/, '')
    .trim();

  let data: any;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return [];
  }

  // Find places array
  let placesArray: any[] | null = null;

  // 1. Standard Google Maps location: parsed[64]
  if (Array.isArray(data) && Array.isArray(data[64]) && data[64].length > 0) {
    placesArray = data[64];
  } else if (Array.isArray(data)) {
    // 2. Fallback search: look for an array containing items with place structures
    for (let i = 0; i < data.length; i++) {
      if (
        Array.isArray(data[i]) &&
        data[i].length > 0 &&
        Array.isArray(data[i][0]) &&
        data[i][0][1] &&
        typeof data[i][0][1][11] === 'string'
      ) {
        placesArray = data[i];
        break;
      }
    }
  }

  if (!placesArray || !Array.isArray(placesArray)) {
    return [];
  }

  const results: BusinessData[] = [];

  for (const item of placesArray) {
    if (!Array.isArray(item)) continue;
    // The place entity is at item[1]
    const p = item[1];
    if (!p || !Array.isArray(p)) continue;

    // Business Name at index 11
    const rawName = p[11];
    if (!rawName || typeof rawName !== 'string' || !rawName.trim()) continue;
    const business_name = normalizeArabicDigits(rawName.trim());

    // Place ID at index 78, or search for ChIJ / 0x
    let place_id: string | null = null;
    if (typeof p[78] === 'string' && p[78].trim()) {
      place_id = p[78].trim();
    } else {
      const match = JSON.stringify(p).match(/ChIJ[a-zA-Z0-9_-]{20,}/);
      if (match) place_id = match[0];
    }

    // Category at index 13
    let category: string | null = null;
    if (Array.isArray(p[13]) && p[13].length > 0 && typeof p[13][0] === 'string') {
      category = normalizeArabicDigits(p[13][0].trim());
    }

    // Address at index 2
    let address: string | null = null;
    if (Array.isArray(p[2])) {
      const parts = p[2].filter((part: any) => typeof part === 'string' && part.trim());
      if (parts.length > 0) {
        address = normalizeArabicDigits(parts.join(', ').trim());
      }
    } else if (typeof p[2] === 'string') {
      address = normalizeArabicDigits(p[2].trim());
    }

    // Rating & Reviews at index 4
    let rating: number | null = null;
    let reviews_count: number | null = null;
    if (Array.isArray(p[4])) {
      if (typeof p[4][7] === 'number' && !isNaN(p[4][7])) {
        rating = p[4][7];
      }
      if (typeof p[4][8] === 'number' && !isNaN(p[4][8])) {
        reviews_count = p[4][8];
      }
    }

    // Phone Number at index 178, or index 3, or fallback regex
    let phone_number: string | null = null;
    if (Array.isArray(p[178]) && p[178][0]) {
      // p[178][0][0] is the display phone e.g. "07 9592 2787"
      // p[178][0][3] is digits phone e.g. "0795922787"
      const candidate = p[178][0][0] || p[178][0][3] || null;
      if (candidate && typeof candidate === 'string') {
        phone_number = normalizeArabicDigits(candidate.trim());
      }
    }

    if (!phone_number && Array.isArray(p[3]) && typeof p[3][0] === 'string') {
      phone_number = normalizeArabicDigits(p[3][0].trim());
    }

    // Fallback phone regex extraction inside this specific place entity
    if (!phone_number) {
      const pStr = JSON.stringify(p);
      const phoneMatch = pStr.match(/(?:(?:\+962|00962)\s?7[789]\d{7}|07[789]\d{7}|\+9626\d{7}|06\d{7})/);
      if (phoneMatch) {
        phone_number = normalizeArabicDigits(phoneMatch[0].trim());
      }
    }

    // Website at index 7
    let website: string | null = null;
    if (Array.isArray(p[7]) && typeof p[7][0] === 'string' && p[7][0].startsWith('http')) {
      const rawUrl = p[7][0];
      // Decode if google redirect
      if (rawUrl.includes('google.com/url?q=')) {
        try {
          const urlObj = new URL(rawUrl);
          website = urlObj.searchParams.get('q') || rawUrl;
        } catch {
          website = rawUrl;
        }
      } else {
        website = rawUrl;
      }
    }

    // Coordinates at index 9
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (Array.isArray(p[9])) {
      if (typeof p[9][2] === 'number') latitude = p[9][2];
      if (typeof p[9][3] === 'number') longitude = p[9][3];
    }

    // Opening hours at index 34
    let opening_hours: string | null = null;
    if (Array.isArray(p[34]) && p[34][1] && typeof p[34][1][0] === 'string') {
      opening_hours = normalizeArabicDigits(p[34][1][0].trim());
    }

    // Stable place URL
    let place_url = '';
    if (place_id) {
      place_url = `https://www.google.com/maps/place/?q=place_id:${place_id}`;
    } else if (latitude !== null && longitude !== null) {
      place_url = `https://www.google.com/maps/place/${encodeURIComponent(business_name)}/@${latitude},${longitude},17z`;
    } else {
      place_url = `https://www.google.com/maps/search/${encodeURIComponent(business_name)}`;
    }

    results.push({
      place_id,
      business_name,
      phone_number,
      address,
      category,
      rating,
      reviews_count,
      website,
      opening_hours,
      latitude,
      longitude,
      place_url,
    });
  }

  return results;
}
