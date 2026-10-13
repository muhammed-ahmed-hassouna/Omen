# 🔍 Omen — Search Algorithm & Extraction Architecture Explained

> A deep-dive into how the scraper finds, validates, and deduplicates business leads from Google Maps.

---

## Table of Contents

1. [Overview](#overview)
2. [Step 1 — Query Construction](#step-1--query-construction)
3. [Step 2 — Browser Automation (Playwright)](#step-2--browser-automation-playwright)
4. [Step 3 — Data Extraction (Parser)](#step-3--data-extraction-parser)
5. [Step 4 — Deduplication (SQLite)](#step-4--deduplication-sqlite)
6. [Step 5 — Lead Validation & Phone Normalization](#step-5--lead-validation--phone-normalization)
7. [Step 6 — Smart Tab Routing](#step-6--smart-tab-routing)
8. [Batch Mode (Multi-Zone Sweep)](#batch-mode-multi-zone-sweep)
9. [Anti-Detection Measures](#anti-detection-measures)
10. [Can We Filter by Business Age?](#can-we-filter-by-business-age)

---

## Overview

The scraper works by **combining a business category with a geographic zone** to build a natural-language Google Maps search query, then automating a real browser to collect and extract all results — exactly as a human would search.

```
Category + Zone  →  Google Maps Search  →  Scrape Listings  →  Validate  →  SQLite CRM
```

---

## Step 1 — Query Construction

**File:** `src/queryBuilder.ts`

### How it works

Queries are built by combining a **category** (what to find) with a **zone** (where to look).

```
Arabic category  →  "مقاهي في الشميساني عمان"
English category →  "cafes in Shmeisani Amman"
```

The function detects the language automatically via Unicode range check:

```typescript
const isArabic = /[\u0600-\u06FF]/.test(category);
return zones.map(zone =>
  isArabic ? `${category} في ${zone}` : `${category} in ${zone}`
);
```

### Zone Sources (SQLite)

Zones are loaded from **SQLite** (`zones` table) and grouped by city:

| City   | Count | Example Zones                           |
|--------|-------|-----------------------------------------|
| Amman  | 15    | الشميساني، عبدون، الصويفية، شارع الرينبو |
| Zarqa  | 8     | وسط الزرقاء، الزرقاء الجديدة، الرصيفة   |
| Irbid  | 6     | وسط إربد، شارع الجامعة، البارحة          |
| Aqaba  | 4     | وسط العقبة، الكورنيش                     |
| Salt   | 3     | وسط السلط، الوادي                        |

You can add **any new city, street, or neighborhood** via the UI → Zone Management.

### Supported Categories

| English Key   | Arabic Equivalent  |
|---------------|--------------------|
| cafes         | مقاهي / كافيهات    |
| restaurants   | مطاعم              |
| gyms          | جيم / نوادي رياضية |
| clinics       | عيادات             |
| pharmacies    | صيدليات            |
| supermarkets  | سوبرماركت          |

---

## Step 2 — Browser Automation (Playwright)

**File:** `src/scraper.ts`

A **Chromium** browser is launched headlessly with Jordanian locale settings:

```
Locale:     ar-JO (Arabic Jordan)
Timezone:   Asia/Amman
Language:   ar-JO,ar;q=0.9,en;q=0.8
hl param:   ?hl=ar  (Forces Arabic data from Google Maps API)
```

### Scrape Flow

```
1. Navigate   →  google.com/maps/search/<query>?hl=ar
2. Dismiss consent/cookie dialog (tries 12 Arabic + English button selectors)
3. Wait for   →  div[role="feed"]  (the results sidebar)
4. Scroll the feed until target count reached (or 5 stuck iterations)
5. Collect    →  a[href*="/maps/place/"]  links  (deduplicated)
6. Process links in parallel batches of 3 tabs
7. For each tab  →  navigate with ?hl=ar and extract business data
8. Close browser
```

### Scroll Strategy

The scraper scrolls the results list panel progressively, checking the link count after each scroll. It stops when:
- It has >= `maxResults` links, OR
- The count has not changed for 5 consecutive scrolls (end of results)

### Concurrency

Results are processed **3 tabs at a time** to balance speed vs. detection risk. Between batches, a randomized delay of 1.5–2 seconds is applied.

---

## Step 3 — Data Extraction (Parser)

**File:** `src/parser.ts`

For each business page, the parser extracts these fields using CSS selectors:

| Field          | Selector / Method                                          |
|----------------|------------------------------------------------------------|
| business_name  | `h1` — the primary heading                                |
| category       | `button[jsaction*="category"]` — Google's own tag         |
| rating         | `div.F7nice span[aria-hidden="true"]`                     |
| reviews_count  | `div.F7nice span[aria-label]`                             |
| address        | `[data-item-id="address"] .Io6YTe`                        |
| phone_number   | `a[href^="tel:"]` or `button[data-item-id^="phone:tel:"]` |
| website        | `a[data-item-id="authority"]`                             |
| latitude/lng   | Parsed from URL: `@lat,lng` or `!3d..!4d..` format       |
| place_id       | Parsed from URL: `!1s0x...` hex format                   |

> **Arabic digit normalization** — Arabic-Indic (٠١٢٣٤٥٦٧٨٩) and Persian (۰۱۲۳۴۵۶۷۸۹) numerals are automatically converted to ASCII digits (0-9) before storage.

---

## Step 4 — Deduplication (SQLite)

**File:** `src/models/SeenPlace.ts`

Every scraped place is checked against a **SQLite `seen_places` table** using the stable Google Maps `place_id` as the unique key.

### How it works

1. **Batch-query all place_ids** in a single `SELECT ... WHERE place_id IN (...)` — no N+1 queries
2. Build an in-memory Set of seen IDs
3. Filter leads to only the ones **not** in the set
4. Mark all scraped leads as seen in a **single SQLite transaction** (`INSERT OR IGNORE`)

```
Total scraped: 25
Already seen:  18  (skipped)
New leads:      7  (processed further)
```

Running the same search multiple times is safe — the more you run, the smarter the deduplication becomes.

---

## Step 5 — Lead Validation & Phone Normalization

**File:** `src/leadValidator.ts`

Every new lead's phone number goes through a strict Jordanian phone validator.

### Normalization Pipeline

```
Raw input: "٠٧٩ ٥٩٢ ٢٧٨٧"
Step 1 → Arabic digits to ASCII:  "079 592 2787"
Step 2 → Strip non-digit chars:   "0795922787"
Step 3 → Remove country prefix:   "795922787"
Step 4 → Pattern match
```

### Phone Classification

| Pattern         | Result           | WhatsApp? |
|-----------------|------------------|-----------|
| 7[789]XXXXXXX   | Valid mobile     | Yes       |
| 7XXXXXXXXX      | Valid mobile     | Yes       |
| [2356]XXXXXXX   | Landline         | No        |
| Missing / empty | No Phone         | No        |
| Anything else   | Invalid Phone    | No        |

### Output Fields

- `phone_number` → `+962795922787` (formatted, international)
- `wpp_phone`    → `962795922787` (for WPPConnect API)
- `is_eligible_for_whatsapp` → true / false
- `status`       → New / Invalid Phone / No Phone

---

## Step 6 — Smart Tab Routing

**File:** `src/queryBuilder.ts` → `resolveSmartTab()`

After validation, each lead is routed to the correct **Google Sheets tab** based on the business's **actual Google Maps category** (not just the search keyword).

```
Google Maps category: "مقهى متخصص"  →  "Cafes" tab
Google Maps category: "مطعم برجر"   →  "Restaurants" tab
Phone = landline / missing           →  "Invalid Numbers" tab
```

---

## Batch Mode (Multi-Zone Sweep)

**File:** `src/controllers/ScraperController.ts` → `scrapeBatch()`

In batch mode, **one browser instance** sweeps across all selected zones sequentially:

```
[batch] Starting sweep: "مقاهي" across 15 zones (Amman)
  [1/15] → "مقاهي في الشميساني عمان"  →  20 scraped, 7 new
  [2/15] → "مقاهي في عبدون عمان"      →  18 scraped, 12 new
  ...
  [15/15] → ...
[batch] Completed: 285 total scraped, 94 new leads
```

Key behaviors:
- **Single browser** reused across all zones (efficient)
- **1,500ms pause** between zones (anti-rate-limit)
- **Rate limiter** (Bottleneck): max 1 concurrent batch, min 2s between scrapes
- Deduplication runs **per zone** — a place seen in Zone 1 is skipped in Zone 2

---

## Anti-Detection Measures

| Measure                          | Purpose                                   |
|----------------------------------|-------------------------------------------|
| headless Chromium + custom UA    | Mimics a real Chrome 120 browser          |
| navigator.webdriver = false      | Hides Playwright automation flag          |
| Fake plugin list                 | Looks like a real browser profile         |
| Arabic locale + Amman timezone   | Appears as a local Jordanian user         |
| Randomized delays (1.5–3s)      | Avoids bot-pattern detection              |
| Batch concurrency = 3 tabs max   | Stays within normal multi-tab browsing    |
| Bottleneck rate limiter          | Prevents parallel batch runs              |

---

## Can We Filter by Business Age?

### Short answer: No — and here is exactly why.

Google Maps **does not expose a "date created" or "date opened" field** in its public UI or in the data accessible via browser scraping. When you visit a business listing page, Google shows:

- Name, category, rating, reviews, phone, address, hours, website
- Photos, Q&A, Posts, Popular times

**None of these include when the business was registered on Google Maps or when it was founded.**

### Why the "date" does not exist even in the URL/HTML

The `place_id` (e.g. `0x151b6e39bff68ba7:0x1f7d3b7de85a`) is a **geographic coordinate-based hash**, not a timestamp. It reveals the location, not the creation date.

The **Google Places API** (official, paid API) also does NOT include a creation date — this is a deliberate Google policy.

---

### What we CAN use as a proxy for "new" vs "established"

Since we cannot get a true creation date, here are **real signals we already collect** that can approximate business age:

| Signal        | What it means                                              | How to use it                   |
|---------------|------------------------------------------------------------|---------------------------------|
| reviews_count | Low count (< 20) → likely new, not yet established        | Sort ascending → newest feeling |
| rating        | New places often have few reviews and unsettled ratings    | Combine with low review count   |
| website       | New places rarely have a website yet                       | Filter where website is empty   |

> **Recommended approach** for "newer / emerging" businesses:
> Filter leads where `reviews_count < 30` AND `rating > 0`.
> These are active businesses that haven't been around long enough to accumulate many reviews — prime outreach targets.

---

### The only real option: Review timestamps

The **only date-like signal on Google Maps** is visible in individual **user reviews** — each review shows "X months ago" or "X years ago". The **oldest visible review** gives you the earliest date the business had any Google Maps activity.

This would require:
1. Clicking into the Reviews panel of each listing
2. Sorting by "Oldest first"
3. Reading the timestamp of the first review

This is **technically possible** to add to the parser, but it adds significant scrape time per business (extra page interaction per listing).

> **Want this feature?** Say the word and we can add `oldest_review_age` as an optional field to the scraper.

---

*Jordan Leads Hunter v2 — MVC + SQLite Architecture — September 2026*
