import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BusinessData } from './types';
import { extractBusinessData, normalizeArabicDigits } from './parser';
import { parseGoogleMapsRpc } from './rpcParser';

const DOM_FALLBACK_CONCURRENCY = 3;

export class GoogleMapsScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'ar-JO',
      timezoneId: 'Asia/Amman',
      extraHTTPHeaders: {
        'Accept-Language': 'ar-JO,ar;q=0.9,en;q=0.8',
      },
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin' },
          { name: 'Chrome PDF Viewer' },
          { name: 'Native Client' },
        ],
      });
    });

    // Resource Route Optimization: block heavy media, fonts, and telemetry
    await this.context.route('**/*', (route) => {
      const req = route.request();
      const type = req.resourceType();
      const url = req.url();

      if (
        ['image', 'media', 'font'].includes(type) ||
        url.includes('google-analytics') ||
        url.includes('play.google.com/log') ||
        url.includes('google.com/gen_204') ||
        url.includes('khms') ||
        url.includes('maps.gstatic.com/tactile')
      ) {
        return route.abort();
      }
      return route.continue();
    });
  }

  async scrape(query: string, maxResults: number = 20): Promise<BusinessData[]> {
    if (!this.context) throw new Error('Call launch() first');

    const page = await this.context.newPage();
    const capturedRpcs: string[] = [];

    // Intercept Google Maps search RPC responses
    page.on('response', async (res) => {
      const url = res.url();
      if (
        url.includes('search?tbm=map') ||
        (url.includes('batchexecute') && url.includes('rpcids=T4jwAf'))
      ) {
        try {
          const text = await res.text();
          capturedRpcs.push(text);
        } catch {
          // ignore closed response
        }
      }
    });

    const startTime = Date.now();

    try {
      console.log(`[scraper] Searching: "${query}", target: ${maxResults} (High-Speed RPC engine)`);

      const encodedQuery = encodeURIComponent(query);
      const searchUrl = `https://www.google.com/maps/search/${encodedQuery}?hl=ar&gl=jo`;

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

      // Dismiss consent dialog if shown
      await this.dismissConsentDialog(page);

      // Wait for results feed
      try {
        await page.waitForSelector('div[role="feed"]', { timeout: 12000 });
      } catch {
        // Quick retry if consent took a moment
        await this.dismissConsentDialog(page);
        await page.waitForSelector('div[role="feed"]', { timeout: 6000 }).catch(() => null);
      }

      // Allow a brief moment for the initial RPC response to finish streaming
      if (capturedRpcs.length === 0) {
        await this.delay(800, 1200);
      }

      // If user requested more than 20 results, scroll down to trigger pagination RPCs
      if (maxResults > 20) {
        await this.scrollForPagination(page, maxResults);
      }

      // Parse all captured RPC streams
      let allPlaces: BusinessData[] = [];
      for (const rpc of capturedRpcs) {
        const places = parseGoogleMapsRpc(rpc);
        allPlaces.push(...places);
      }

      // Deduplicate by place_id or business_name
      const placeMap = new Map<string, BusinessData>();
      for (const p of allPlaces) {
        const key = p.place_id || p.business_name;
        if (!placeMap.has(key)) {
          placeMap.set(key, p);
        }
      }
      let results = Array.from(placeMap.values());

      // If RPC parsed places successfully, enrich with feed reviews count and return!
      if (results.length > 0) {
        await this.enrichFromFeedDom(page, results);

        const duration = Date.now() - startTime;
        console.log(
          `[scraper] ⚡ RPC Stream Success: captured ${results.length} places in ${duration}ms for "${query}"`
        );
        return results.slice(0, maxResults);
      }

      // --- Seamless Fallback: DOM scraping if RPC yielded no results ---
      console.warn(`[scraper] RPC yielded 0 places. Executing resilient DOM fallback for "${query}"...`);
      return await this.scrapeViaDomFallback(page, maxResults);
    } finally {
      await page.close();
    }
  }

  /**
   * Enriches parsed RPC places with review counts from the feed DOM (takes ~50ms).
   */
  private async enrichFromFeedDom(page: Page, places: BusinessData[]): Promise<void> {
    try {
      const feedItems = await page.$$eval('div[role="feed"] > div > div[jsaction]', (els) => {
        return els
          .map((el) => {
            const link = el.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null;
            const title = link ? link.getAttribute('aria-label') : null;
            const ratingEl = el.querySelector(
              'span[role="img"], span[aria-label*="نجوم"], span[aria-label*="star"], span[aria-label*="تقييم"]'
            );
            const aria = ratingEl ? ratingEl.getAttribute('aria-label') : null;
            const text = (el as HTMLElement).innerText || '';
            const reviewMatch = text.match(/\((\d[\d,.]*)\)/);

            return {
              title,
              aria,
              reviewsFromText: reviewMatch ? reviewMatch[1] : null,
            };
          })
          .filter((x) => x.title);
      });

      for (const r of places) {
        if (r.reviews_count !== null) continue;
        const match = feedItems.find(
          (f) =>
            f.title &&
            (f.title.includes(r.business_name) || r.business_name.includes(f.title))
        );
        if (match) {
          if (match.reviewsFromText) {
            const count = parseInt(match.reviewsFromText.replace(/,/g, ''), 10);
            if (!isNaN(count)) r.reviews_count = count;
          } else if (match.aria) {
            const digits = match.aria.match(/\b(\d+)\s*(?:مراجعة|تقييم|reviews?)/i);
            if (digits) {
              const count = parseInt(digits[1], 10);
              if (!isNaN(count)) r.reviews_count = count;
            }
          }
        }
      }
    } catch {
      // Ignore DOM enrichment errors
    }
  }

  /**
   * Fast scroll to trigger pagination RPC requests when maxResults > 20
   */
  private async scrollForPagination(page: Page, targetCount: number): Promise<void> {
    let scrollCount = 0;
    const maxScrolls = Math.min(5, Math.ceil((targetCount - 20) / 15));

    while (scrollCount < maxScrolls) {
      scrollCount++;
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop = feed.scrollHeight;
      });
      await this.delay(1200, 1800);
    }
  }

  /**
   * Resilient DOM fallback parser if RPC interception is not available
   */
  private async scrapeViaDomFallback(page: Page, maxResults: number): Promise<BusinessData[]> {
    const results: BusinessData[] = [];

    // Scroll to load listings
    await this.scrollResultsList(page, maxResults);

    const resultLinks = await page.$$eval(
      'div[role="feed"] a[href*="/maps/place/"]',
      (els) => els.map((el) => (el as HTMLAnchorElement).href)
    );

    const targetLinks = [...new Set(resultLinks)].slice(0, maxResults);
    console.log(`[scraper fallback] Found ${targetLinks.length} listings - processing in batches of ${DOM_FALLBACK_CONCURRENCY}`);

    for (let i = 0; i < targetLinks.length; i += DOM_FALLBACK_CONCURRENCY) {
      const batch = targetLinks.slice(i, i + DOM_FALLBACK_CONCURRENCY);

      const batchResults = await Promise.all(
        batch.map(async (link) => {
          const tabPage = await this.context!.newPage();
          try {
            const url = new URL(link);
            url.searchParams.set('hl', 'ar');
            await tabPage.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 15000 });
            return await extractBusinessData(tabPage);
          } catch (err) {
            console.error(`[scraper fallback] Error on ${link}:`, err);
            return null;
          } finally {
            await tabPage.close();
          }
        })
      );

      batchResults.forEach((b) => {
        if (b) results.push(b);
      });
    }

    return results;
  }

  private async dismissConsentDialog(page: Page): Promise<void> {
    const consentSelectors = [
      'button[aria-label="قبول الكل"]',
      'button[aria-label="الموافقة على استخدام ملفات تعريف الارتباط"]',
      'button:has-text("قبول الكل")',
      'button:has-text("الموافقة على الكل")',
      'button:has-text("أوافق")',
      'button:has-text("موافق")',
      'button[aria-label="Accept all"]',
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
    ];

    for (const selector of consentSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          await this.delay(500);
          return;
        }
      } catch {
        /* try next */
      }
    }
  }

  private async scrollResultsList(page: Page, targetCount: number): Promise<void> {
    let previousCount = 0;
    let stuckIterations = 0;
    const MAX_STUCK = 3;

    while (stuckIterations < MAX_STUCK) {
      const currentLinks = await page.$$eval(
        'div[role="feed"] a[href*="/maps/place/"]',
        (els) => els.length
      );

      if (currentLinks >= targetCount) break;

      if (currentLinks === previousCount) stuckIterations++;
      else stuckIterations = 0;
      previousCount = currentLinks;

      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, 1200);
      });

      await this.delay(1000, 1500);
    }
  }

  private delay(min: number = 500, max?: number): Promise<void> {
    const ms = max ? Math.floor(Math.random() * (max - min) + min) : min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.context = null;
  }
}
