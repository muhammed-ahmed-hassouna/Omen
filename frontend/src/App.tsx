import React, { useState, useEffect } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { WppQrModal } from './components/WppQrModal';
import { ScraperHub } from './features/scraper/ScraperHub';
import { OutreachHub } from './features/outreach/OutreachHub';
import { ZoneManager } from './features/zones/ZoneManager';
import { CategoryManager } from './features/categories/CategoryManager';
import { TemplateStudio } from './features/templates/TemplateStudio';
import { HistoryHub } from './features/history/HistoryHub';
import { SettingsHub } from './features/settings/SettingsHub';
import { Zone, Category, Template, WppStatus, api } from './services/api';
import { Github, Heart, Shield, Cpu, Terminal } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('scraper');
  const [seenCount, setSeenCount] = useState<number>(0);
  const [wppStatus, setWppStatus] = useState<WppStatus | null>(null);
  const [scraperRunning, setScraperRunning] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // Entities
  const [zones, setZones] = useState<Zone[]>([]);
  const [cities, setCities] = useState<string[]>(['Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Salt']);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Initial Data Fetch
  const loadEntities = async () => {
    try {
      const [zList, cList, tList, citiesList] = await Promise.all([
        api.getZones().catch(() => []),
        api.getCategories().catch(() => []),
        api.getTemplates().catch(() => []),
        api.getCities().catch(() => ['Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Salt']),
      ]);
      setZones(zList);
      setCategories(cList);
      setTemplates(tList);
      if (citiesList.length > 0) setCities(citiesList);
    } catch {
      // ignore
    }
  };

  // Heartbeat Polling
  const pollSystem = async () => {
    try {
      const [seenRes, wppRes, healthRes] = await Promise.all([
        api.getSeenCount().catch(() => ({ totalSeen: 0 })),
        api.getWppStatus().catch(() => ({ isOnline: false, status: 'OFFLINE' as const })),
        api.getHealth().catch(() => ({ running: 0, queued: 0 })),
      ]);
      setSeenCount(seenRes.totalSeen);
      setWppStatus(wppRes as WppStatus);
      setScraperRunning((healthRes.running || 0) > 0 || (healthRes.queued || 0) > 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadEntities();
    pollSystem();
    const interval = setInterval(pollSystem, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 text-slate-100 selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Glow Effects Backdrop */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Modern Top Header / Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        seenCount={seenCount}
        wppStatus={wppStatus}
        scraperRunning={scraperRunning}
        onOpenQrModal={() => setIsQrModalOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scraper' && (
          <ScraperHub
            categories={categories}
            zones={zones}
            cities={cities}
            onScrapeStarted={pollSystem}
          />
        )}

        {activeTab === 'outreach' && (
          <OutreachHub
            categories={categories}
            templates={templates}
            wppStatus={wppStatus}
            onOpenQrModal={() => setIsQrModalOpen(true)}
          />
        )}

        {activeTab === 'zones' && (
          <ZoneManager
            zones={zones}
            cities={cities}
            onZonesChanged={loadEntities}
          />
        )}

        {activeTab === 'categories' && (
          <CategoryManager
            categories={categories}
            onCategoriesChanged={loadEntities}
          />
        )}

        {activeTab === 'templates' && (
          <TemplateStudio
            templates={templates}
            onTemplatesChanged={loadEntities}
          />
        )}

        {activeTab === 'history' && <HistoryHub />}

        {activeTab === 'settings' && (
          <SettingsHub
            seenCount={seenCount}
            onSeenCountCleared={pollSystem}
          />
        )}
      </main>

      {/* WhatsApp Authentication Modal */}
      <WppQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        wppStatus={wppStatus}
        onRefresh={pollSystem}
      />

      {/* Modern Footer */}
      <footer className="border-t border-obsidian-border bg-obsidian-950/60 backdrop-blur-md py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">OMEN LEAD ENGINE</span>
            <span>•</span>
            <span>SQLite WAL</span>
            <span>•</span>
            <span>Playwright RPC</span>
            <span>•</span>
            <span>WPPConnect</span>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/muhammed-ahmed-hassouna/Omen"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
