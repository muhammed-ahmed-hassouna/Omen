import React, { useState } from 'react';
import { 
  Radar, 
  MapPin, 
  Tag, 
  Layers, 
  Play, 
  FileSpreadsheet, 
  Check, 
  Sliders, 
  Terminal, 
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Category, Zone, api } from '../../services/api';

interface ScraperHubProps {
  categories: Category[];
  zones: Zone[];
  cities: string[];
  onScrapeStarted: () => void;
}

export const ScraperHub: React.FC<ScraperHubProps> = ({
  categories,
  zones,
  cities,
  onScrapeStarted,
}) => {
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.key || 'cafes');
  const [selectedCity, setSelectedCity] = useState<string>(cities[0] || 'Amman');
  const [selectedZones, setSelectedZones] = useState<number[]>([]);
  const [singleZoneName, setSingleZoneName] = useState<string>('');
  const [maxResults, setMaxResults] = useState<number>(30);
  const [pushToSheet, setPushToSheet] = useState<boolean>(true);
  
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultMessage, setResultMessage] = useState<string>('');

  // Filtered zones for selected city
  const cityZones = zones.filter((z) => z.city === selectedCity);

  const toggleZone = (id: number) => {
    setSelectedZones((prev) =>
      prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]
    );
  };

  const selectAllCityZones = () => {
    const allIds = cityZones.map((z) => z.id);
    setSelectedZones(allIds);
  };

  const deselectAllZones = () => {
    setSelectedZones([]);
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const handleLaunch = async () => {
    setIsRunning(true);
    setResultMessage('');
    addLog(`🚀 Initiating Discovery Engine (${mode.toUpperCase()} MODE)...`);

    try {
      if (mode === 'single') {
        const zoneToUse = singleZoneName || (cityZones[0]?.name || 'Downtown');
        addLog(`Searching: Category="${selectedCategory}", Zone="${zoneToUse}", City="${selectedCity}"`);
        const res = await api.scrapeSingle({
          category: selectedCategory,
          zone: zoneToUse,
          city: selectedCity,
          maxResults,
          pushToSheet,
        });
        addLog(`✅ Single search dispatched: ${res.message || 'Queued successfully'}`);
        setResultMessage(res.message || 'Scrape dispatched successfully.');
      } else {
        const zonesToRun = selectedZones.length > 0 ? selectedZones : cityZones.map((z) => z.id);
        addLog(`Multi-Zone Sweep: Category="${selectedCategory}", Target Zones count=${zonesToRun.length}`);
        const res = await api.scrapeBatch({
          category: selectedCategory,
          city: selectedCity,
          zoneIds: zonesToRun,
          maxPerZone: maxResults,
          pushToSheet,
        });
        addLog(`✅ Batch sweep dispatched: ${res.message || 'Batch sweep running'}`);
        setResultMessage(res.message || 'Batch sweep dispatched successfully.');
      }
      onScrapeStarted();
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
      setResultMessage(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Radar className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Geolocation Discovery Sweeper</h2>
          </div>
          <p className="text-xs text-slate-400">
            Automates Google Maps RPC extraction, phone verification, and automatic Google Sheets synchronization.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center p-1 rounded-xl bg-obsidian-950 border border-obsidian-border">
          <button
            onClick={() => setMode('batch')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'batch'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Zone Batch Sweep</span>
          </button>
          <button
            onClick={() => setMode('single')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'single'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Single Zone Targeted</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Config Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Category Selection */}
          <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
            <div className="flex items-center space-x-2 text-slate-300 font-semibold text-sm">
              <Tag className="w-4 h-4 text-cyan-400" />
              <span>1. Target Business Category</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`flex items-center space-x-2.5 p-3 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-200 shadow-glow font-bold'
                        : 'bg-obsidian-850/60 border-obsidian-border text-slate-400 hover:text-white hover:bg-obsidian-800'
                    }`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Geolocation & Zones Selection */}
          <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-300 font-semibold text-sm">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>2. Target Geographic Territory</span>
              </div>

              {/* City Pill Switcher */}
              <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-obsidian-950 border border-obsidian-border">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setSelectedCity(city);
                      setSelectedZones([]);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      selectedCity === city
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'batch' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Zones Selected:{' '}
                    <strong className="text-white">
                      {selectedZones.length > 0 ? selectedZones.length : `All ${cityZones.length}`}
                    </strong>
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={selectAllCityZones}
                      className="text-cyan-400 hover:underline text-[11px]"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      onClick={deselectAllZones}
                      className="text-slate-400 hover:underline text-[11px]"
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {cityZones.map((zone) => {
                    const isChecked = selectedZones.includes(zone.id);
                    return (
                      <button
                        key={zone.id}
                        onClick={() => toggleZone(zone.id)}
                        className={`flex items-center space-x-2 p-2.5 rounded-xl border text-left text-xs transition-all ${
                          isChecked
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                            : 'bg-obsidian-850/50 border-obsidian-border text-slate-400 hover:bg-obsidian-800'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? 'bg-cyan-500 border-cyan-400 text-obsidian-950 font-bold'
                              : 'border-slate-600 bg-obsidian-950'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate">{zone.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Specific Zone or Sub-District Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Abdoun, Dabouq, 7th Circle, Shmeisani..."
                  value={singleZoneName}
                  onChange={(e) => setSingleZoneName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            )}
          </div>

          {/* 3. Execution Tuning & Launch Button */}
          <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
            <div className="flex items-center space-x-2 text-slate-300 font-semibold text-sm">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>3. Scraper Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Max Results Per Zone Query:</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={maxResults}
                  onChange={(e) => setMaxResults(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-4 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-xl bg-obsidian-950 border border-obsidian-border">
                <input
                  type="checkbox"
                  id="pushSheetToggle"
                  checked={pushToSheet}
                  onChange={(e) => setPushToSheet(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 bg-obsidian-900 border-slate-600 focus:ring-0"
                />
                <label htmlFor="pushSheetToggle" className="text-xs text-slate-300 cursor-pointer flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Sync Validated Leads to Google Sheets</span>
                </label>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="pt-2">
              <button
                onClick={handleLaunch}
                disabled={isRunning}
                className="w-full flex items-center justify-center space-x-2.5 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-glow hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isRunning ? 'Initiating Sweeper...' : 'Launch Geolocation Discovery Sweeper'}</span>
              </button>
            </div>

            {resultMessage && (
              <p className="text-xs text-center text-cyan-300 font-mono bg-cyan-950/20 py-2 rounded-lg border border-cyan-800/30">
                {resultMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Live Terminal Feed & Activity Logs */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
              <div className="flex items-center space-x-2 text-slate-300 font-semibold text-sm">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Engine Execution Terminal</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <p className="text-[11px] text-slate-400">
              Live updates of Playwright browser execution, RPC frames intercepted, and SQLite deduplication.
            </p>

            <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-border font-mono text-[11px] space-y-2 text-slate-300">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic py-8 text-center">
                  Engine idle. Configure and launch a sweep to view live execution logs.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed border-b border-slate-900/60 pb-1 break-words">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
