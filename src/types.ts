export interface BusinessData {
  place_id: string | null;
  business_name: string;
  phone_number: string | null;
  address: string | null;
  category: string | null;
  rating: number | null;
  reviews_count: number | null;
  website: string | null;
  opening_hours: string | null;
  latitude: number | null;
  longitude: number | null;
  place_url: string;
}

export interface ScrapeRequest {
  query: string;
  maxResults?: number; // default 20
  category?: string;
  zone?: string;
}

export interface ScrapeResponse {
  success: boolean;
  total_scraped: number;
  total_new: number;
  total_seen: number;
  category?: string;
  data: BusinessData[];
  error?: string;
  history_file?: string;
}

export interface CategoryTemplate {
  key: string;
  title: string;
  template: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  timestamp: string;     // ISO
  category: string;
  query: string;
  total_scraped: number;
  total_new: number;
  filename: string;
}

export interface AppSettings {
  googleSheetUrl: string;
  googleSheetWebhookUrl: string;
  wppconnectUrl: string;
  sendDelaySeconds?: number;
  delayRandomJitter?: number;
  maxBatchLimit?: number;
  wppSessionName?: string;
  dailyMessageCap?: number;
  batchCooldownEvery?: number;
  batchCooldownMinSeconds?: number;
  batchCooldownMaxSeconds?: number;
  sendWindowStart?: number;
  sendWindowEnd?: number;
  enableMessageVariation?: boolean;
}
