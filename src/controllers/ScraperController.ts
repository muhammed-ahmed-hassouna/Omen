import { Request, Response } from 'express';
import { z } from 'zod';
import Bottleneck from 'bottleneck';
import { GoogleMapsScraper } from '../scraper';
import { BusinessData } from '../types';
import { buildQueryList, formatTabName } from '../queryBuilder';
import { archiveScrapeHistory } from '../store';
import { ProcessedLead, processLead, cleanJordanianPhone } from '../leadValidator';
import { SeenPlaceModel } from '../models/SeenPlace';
import { ZoneModel } from '../models/Zone';

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 1000,
});

const ScrapeSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters'),
  maxResults: z.number().int().positive().max(120).optional().default(20),
  category: z.string().optional(),
});

const BatchSchema = z.object({
  category: z.string().min(2, 'Category must be at least 2 characters'),
  zones: z.array(z.string()).optional(),
  city: z.string().optional(),
  resultsPerZone: z.number().int().positive().max(60).optional().default(20),
});

/**
 * Worker pool helper for controlled concurrency
 */
async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  iteratorFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = await iteratorFn(items[currentIndex], currentIndex);
      } catch (err) {
        console.error(`Worker error on item ${currentIndex}:`, err);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class ScraperController {
  /**
   * POST /api/scrape - Single Search Query
   */
  static async scrapeSingle(req: Request, res: Response) {
    const parsed = ScrapeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { query, maxResults, category } = parsed.data;
    const resolvedCategory = category || query.split(' ')[0] || 'General';
    const tabName = formatTabName(resolvedCategory);

    try {
      const rawData = await limiter.schedule(async () => {
        const scraper = new GoogleMapsScraper();
        try {
          await scraper.launch();
          return await scraper.scrape(query, maxResults);
        } finally {
          await scraper.close();
        }
      });

      // 1. Fast SQLite Deduplication
      const { newLeads: newRawData, seenCount } = SeenPlaceModel.filterUnseen(rawData);
      SeenPlaceModel.markSeenBatch(rawData);

      // 2. Validate and format leads
      const processedLeads: ProcessedLead[] = newRawData.map((b) =>
        processLead(b, resolvedCategory, tabName)
      );

      // 3. Archive history snapshot on disk
      const archive = archiveScrapeHistory(resolvedCategory, query, rawData, newRawData.length);

      console.log(
        `[server] Done: ${rawData.length} scraped, ${newRawData.length} new, ${seenCount} already seen (SQLite indexed)`
      );

      return res.json({
        success: true,
        total_scraped: rawData.length,
        total_new: newRawData.length,
        total_seen: seenCount,
        total_seen_in_store: SeenPlaceModel.getCount(),
        category: resolvedCategory,
        tab_name: tabName,
        history_file: archive.filename,
        data: processedLeads,
      });
    } catch (err: any) {
      console.error('[server] Scrape failed:', err);
      return res.status(500).json({ success: false, error: err.message, data: [] });
    }
  }

  /**
   * POST /api/scrape/batch - Multi-Zone Sweeper across Jordanian cities / streets
   */
  static async scrapeBatch(req: Request, res: Response) {
    const parsed = BatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { category, zones: customZones, city, resultsPerZone } = parsed.data;
    const tabName = formatTabName(category);

    // Determine target zones: either explicitly provided, or pulled from SQLite by city/active
    let targetZones = customZones;
    if (!targetZones || targetZones.length === 0) {
      targetZones = ZoneModel.getNames(city);
    }

    const queries = buildQueryList(category, targetZones);
    const allNewRaw: BusinessData[] = [];
    const logMap = new Map<string, { query: string; scraped: number; new: number }>();

    console.log(
      `\n[batch] Starting high-speed parallel sweep: "${category}" across ${queries.length} zones (${city || 'All Cities'})`
    );

    try {
      await limiter.schedule(async () => {
        const scraper = new GoogleMapsScraper();
        try {
          await scraper.launch();

          // Controlled concurrency pool of 3 concurrent zones
          const WORKER_CONCURRENCY = 3;
          let completedZones = 0;

          await asyncPool(WORKER_CONCURRENCY, queries, async (q, index) => {
            console.log(`[batch] [${index + 1}/${queries.length}] Starting zone: "${q}"`);
            try {
              const zoneData = await scraper.scrape(q, resultsPerZone);

              // Pre-filter unseen via SQLite immediately
              const { newLeads: newInZone } = SeenPlaceModel.filterUnseen(zoneData);
              SeenPlaceModel.markSeenBatch(zoneData);

              allNewRaw.push(...newInZone);
              logMap.set(q, { query: q, scraped: zoneData.length, new: newInZone.length });

              completedZones++;
              console.log(
                `[batch] [${completedZones}/${queries.length}] Completed "${q}" -> ${zoneData.length} scraped, ${newInZone.length} new`
              );
            } catch (zoneErr: any) {
              console.error(`[batch] Zone failed: "${q}":`, zoneErr.message);
              logMap.set(q, { query: q, scraped: 0, new: 0 });
            }

            // Brief pause between tasks in worker
            await new Promise((resolve) => setTimeout(resolve, 300));
          });
        } finally {
          await scraper.close();
        }
      });

      // Preserve query order in logs
      const log = queries.map((q) => logMap.get(q) || { query: q, scraped: 0, new: 0 });

      // Final in-memory deduplication across parallel workers
      const uniqueMap = new Map<string, BusinessData>();
      for (const b of allNewRaw) {
        const phone = cleanJordanianPhone(b.phone_number).formattedPhone;
        const key = b.place_id || phone || b.business_name;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, b);
        }
      }
      const finalNewRaw = Array.from(uniqueMap.values());

      const processedLeads: ProcessedLead[] = finalNewRaw.map((b) =>
        processLead(b, category, tabName)
      );

      const totalScraped = log.reduce((acc, l) => acc + l.scraped, 0);
      const totalNew = finalNewRaw.length;
      const totalSeen = totalScraped - totalNew;

      const archive = archiveScrapeHistory(
        category,
        `batch_${city || 'jordan'}_${queries.length}zones`,
        finalNewRaw,
        totalNew
      );

      console.log(
        `\n[batch] Completed: ${totalScraped} total scraped, ${totalNew} new leads archived (Total DB seen: ${SeenPlaceModel.getCount()})`
      );

      return res.json({
        success: true,
        total_scraped: totalScraped,
        total_new: totalNew,
        total_seen: totalSeen,
        total_seen_in_store: SeenPlaceModel.getCount(),
        category,
        tab_name: tabName,
        zones_searched: queries.length,
        history_file: archive.filename,
        zone_log: log,
        data: processedLeads,
      });
    } catch (err: any) {
      console.error('[batch] Sweep failed:', err);
      return res.status(500).json({ success: false, error: err.message, data: [] });
    }
  }

  static getLimiterStatus() {
    return {
      queued: limiter.queued(),
      running: limiter.running(),
    };
  }
}
