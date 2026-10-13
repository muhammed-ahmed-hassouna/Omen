// Typed API Client for Omen Backend

export interface Zone {
  id: number;
  name: string;
  city: string;
  is_active: number;
  created_at?: string;
}

export interface Category {
  id: number;
  key: string;
  name: string;
  icon: string;
  is_active: number;
  created_at?: string;
}

export interface Template {
  id: number;
  key: string;
  title: string;
  template: string;
  updated_at?: string;
}

export interface AppSettings {
  googleSheetUrl: string;
  googleSheetWebhookUrl: string;
  wppconnectUrl: string;
  sendDelaySeconds: number;
  delayRandomJitter: number;
  maxBatchLimit: number;
  wppSessionName: string;
  dailyMessageCap: number;
  batchCooldownEvery: number;
  batchCooldownMinSeconds: number;
  batchCooldownMaxSeconds: number;
  sendWindowStart: number;
  sendWindowEnd: number;
  enableMessageVariation: boolean;
}

export interface WppStatus {
  isOnline: boolean;
  status: 'CONNECTED' | 'QRCODE' | 'DISCONNECTED' | 'OFFLINE';
  phone?: string;
  qrcode?: string;
  error?: string;
}

export interface CampaignStatus {
  isRunning: boolean;
  currentBatch: number;
  totalBatches: number;
  sentCount: number;
  failedCount: number;
  statusText: string;
  activeCategory?: string;
  activeTab?: string;
}

export interface DailyStats {
  date: string;
  count: number;
  cap: number;
  remaining: number;
}

export interface HealthResponse {
  status: string;
  database: string;
  queued: number;
  running: number;
  campaign?: CampaignStatus;
}

export interface HistoryItem {
  date: string;
  filename: string;
  size?: number;
  modified?: string;
}

// Helpers
async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || errorBody.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // System Health & Seen Cache
  getHealth: () => req<HealthResponse>('/health'),
  getSeenCount: () => req<{ totalSeen: number }>('/api/seen'),
  clearSeenCount: () => req<{ success: boolean; cleared: number }>('/api/seen', { method: 'DELETE' }),

  // Settings & Config
  getConfig: () => req<any>('/api/config'),
  getSettings: () => req<AppSettings>('/api/settings'),
  saveSettings: (settings: Partial<AppSettings>) =>
    req<{ success: boolean; settings: AppSettings }>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // Zones
  getZones: () => req<Zone[]>('/api/zones'),
  getCities: () => req<string[]>('/api/zones/cities'),
  createZone: (name: string, city = 'Amman') =>
    req<Zone>('/api/zones', {
      method: 'POST',
      body: JSON.stringify({ name, city }),
    }),
  createZonesBulk: (city: string, names: string[]) =>
    req<{ added: number }>('/api/zones/bulk', {
      method: 'POST',
      body: JSON.stringify({ city, names }),
    }),
  toggleZone: (id: number) =>
    req<{ id: number; is_active: number }>(`/api/zones/${id}/toggle`, { method: 'POST' }),
  deleteZone: (id: number) => req<{ success: boolean }>(`/api/zones/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => req<Category[]>('/api/categories'),
  createCategory: (key: string, name: string, icon = '📌') =>
    req<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ key, name, icon }),
    }),
  toggleCategory: (id: number) =>
    req<{ id: number; is_active: number }>(`/api/categories/${id}/toggle`, { method: 'POST' }),
  deleteCategory: (id: number) =>
    req<{ success: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),
  syncZarqaSeeds: () =>
    req<{ success: boolean; message: string }>('/api/categories/sync-zarqa-seeds', { method: 'POST' }),

  // Templates
  getTemplates: () => req<Template[]>('/api/templates'),
  saveTemplate: (key: string, title: string, template: string) =>
    req<Template>('/api/templates', {
      method: 'POST',
      body: JSON.stringify({ key, title, template }),
    }),
  deleteTemplate: (key: string) =>
    req<{ success: boolean }>(`/api/templates/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  renderTemplate: (template: string, businessName = 'مطعم النجم', zone = 'العبدلي') =>
    req<{ rendered: string }>('/api/templates/render', {
      method: 'POST',
      body: JSON.stringify({ template, businessName, zone }),
    }),

  // Scraper
  scrapeSingle: (data: {
    category: string;
    zone: string;
    city?: string;
    maxResults?: number;
    pushToSheet?: boolean;
    tabName?: string;
  }) => req<any>('/api/scrape', { method: 'POST', body: JSON.stringify(data) }),

  scrapeBatch: (data: {
    category: string;
    city?: string;
    zoneIds?: number[];
    maxPerZone?: number;
    pushToSheet?: boolean;
    tabName?: string;
  }) => req<any>('/api/scrape/batch', { method: 'POST', body: JSON.stringify(data) }),

  // Outreach & WhatsApp
  getWppStatus: () => req<WppStatus>('/api/outreach/wpp-status'),
  startWppSession: () => req<any>('/api/outreach/wpp-start', { method: 'POST' }),
  logoutWppSession: () => req<any>('/api/outreach/wpp-logout', { method: 'POST' }),
  getCampaignStatus: () => req<CampaignStatus>('/api/outreach/status'),
  startCampaign: (tabName: string, category: string) =>
    req<any>('/api/outreach/start', {
      method: 'POST',
      body: JSON.stringify({ tabName, category }),
    }),
  stopCampaign: () => req<any>('/api/outreach/stop', { method: 'POST' }),
  getDailyStats: () => req<DailyStats>('/api/outreach/daily-stats'),
  resetDailyStats: () => req<any>('/api/outreach/daily-stats/reset', { method: 'POST' }),

  // Google Sheets
  getNewLeads: (tabName: string) =>
    req<{ success: boolean; count: number; leads: any[] }>('/api/sheets/new-leads', {
      method: 'POST',
      body: JSON.stringify({ tabName }),
    }),
  testSheetsWebhook: (webhookUrl: string, tabName = 'Cafes') =>
    req<any>('/api/sheets/push', {
      method: 'POST',
      body: JSON.stringify({
        webhookUrl,
        tabName,
        category: 'Test',
        leads: [],
      }),
    }),

  // History
  getHistory: () => req<HistoryItem[]>('/api/history'),
};
