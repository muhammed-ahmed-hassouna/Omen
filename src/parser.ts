import { Page } from 'playwright';
import { BusinessData } from './types';

/**
 * Normalizes all Arabic-Indic (٠١٢٣٤٥٦٧٨٩) and Persian (۰۱۲۳۴۵۶۷۸۹) numerals to standard English digits (0-9).
 */
export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
}

/**
 * Extracts coordinates from a Google Maps URL.
 */
export function extractCoordinates(url: string): { lat: number; lng: number } | null {
  const shortMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (shortMatch) return { lat: parseFloat(shortMatch[1]), lng: parseFloat(shortMatch[2]) };

  const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };

  return null;
}

/**
 * Extracts the stable Google Maps Place ID from the URL.
 */
export function extractPlaceId(url: string): string | null {
  const match = url.match(/!1s(0x[a-f0-9]+:[a-f0-9]+)/i);
  return match ? match[1] : null;
}

export async function extractBusinessData(page: Page): Promise<BusinessData | null> {
  try {
    await page.waitForSelector('h1', { timeout: 8000 });

    const url = page.url();
    const coords = extractCoordinates(url);
    const place_id = extractPlaceId(url);

    // --- Business Name (Arabic / Primary Native name in h1) ---
    const business_name = await page
      .$eval('h1', el => el.textContent?.trim() ?? '')
      .catch(() => '');

    // --- Category (Native Arabic category from Google Maps) ---
    const category = await page
      .$eval('button[jsaction*="category"]', el => el.textContent?.trim())
      .catch(async () =>
        page.$eval('div[jsaction*="category"]', el => el.textContent?.trim()).catch(() => null)
      );

    // --- Rating (Supports standard and Arabic decimal formats) ---
    const ratingRaw = await page
      .$eval('div.F7nice span[aria-hidden="true"]', el => el.textContent?.trim())
      .catch(() => null);
    let rating: number | null = null;
    if (ratingRaw) {
      const normalized = normalizeArabicDigits(ratingRaw).replace('٫', '.').replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed)) rating = parsed;
    }

    // --- Reviews Count ---
    const reviewsRaw = await page
      .$eval('div.F7nice span[aria-label]', el => el.getAttribute('aria-label') ?? '')
      .catch(() => null);
    let reviews_count: number | null = null;
    if (reviewsRaw) {
      const digitsOnly = normalizeArabicDigits(reviewsRaw).replace(/[^0-9]/g, '');
      const parsed = parseInt(digitsOnly, 10);
      if (!isNaN(parsed)) reviews_count = parsed;
    }

    // --- Address (Native Arabic address from Google Maps) ---
    const address = await page
      .$eval('[data-item-id="address"] .Io6YTe', el => el.textContent?.trim())
      .catch(async () =>
        page.$eval('button[aria-label*="العنوان" i] .Io6YTe', el => el.textContent?.trim()).catch(async () =>
          page.$eval('button[aria-label*="Address" i] .Io6YTe', el => el.textContent?.trim()).catch(() => null)
        )
      );

    // --- Phone (Normalized to standard digits) ---
    const rawPhone = await page
      .$eval('a[href^="tel:"]', el => el.getAttribute('href')?.replace('tel:', '').trim())
      .catch(async () =>
        page.$eval('button[data-item-id^="phone:tel:"] .Io6YTe', el => el.textContent?.trim()).catch(() => null)
      );
    const phone_number = rawPhone ? normalizeArabicDigits(rawPhone) : null;

    // --- Website ---
    const website = await page
      .$eval('a[data-item-id="authority"]', el => el.getAttribute('href'))
      .catch(async () =>
        page.$eval('a[aria-label*="website" i]', el => el.getAttribute('href')).catch(async () =>
          page.$eval('a[aria-label*="الموقع الإلكتروني" i]', el => el.getAttribute('href')).catch(() => null)
        )
      );

    // --- Opening Hours ---
    const opening_hours = await page
      .$eval('[data-item-id="oh"] .Io6YTe', el => el.textContent?.trim())
      .catch(async () =>
        page.$eval('[aria-label*="hours" i]', el => el.getAttribute('aria-label')?.trim()).catch(() => null)
      );

    if (!business_name) return null;

    return {
      place_id: place_id || null,
      business_name: normalizeArabicDigits(business_name),
      phone_number: phone_number ? normalizeArabicDigits(phone_number) : null,
      address: address ? normalizeArabicDigits(address) : null,
      category: category ? normalizeArabicDigits(category) : null,
      rating: rating !== null && !isNaN(rating) ? rating : null,
      reviews_count: reviews_count !== null && !isNaN(reviews_count) ? reviews_count : null,
      website: website || null,
      opening_hours: opening_hours ? normalizeArabicDigits(opening_hours) : null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      place_url: url,
    };
  } catch (err) {
    console.error('[parser] Failed to extract business data:', err);
    return null;
  }
}
