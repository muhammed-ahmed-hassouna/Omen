import React, { useState, useEffect } from 'react';
import { History, FileText, Download, Calendar, RefreshCw } from 'lucide-react';
import { HistoryItem, api } from '../../services/api';

export const HistoryHub: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const items = await api.getHistory();
      setHistoryItems(items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Scrape Execution History & Exports</h2>
          </div>
          <p className="text-xs text-slate-400">
            Browse and download archives of previously completed extraction runs and lead data payloads.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-slate-200 text-xs transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
        {historyItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-slate-600" />
            <p>No historical runs found yet. Completed scraping sweeps will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {historyItems.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl glass-panel bg-obsidian-850/60 border border-obsidian-border flex items-center justify-between text-xs hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center space-x-3 truncate pr-2">
                  <div className="p-2 rounded-lg bg-obsidian-950 text-cyan-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="font-semibold block truncate text-slate-200">{item.filename}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.date}</span>
                  </div>
                </div>

                <a
                  href={`/api/history/${item.date}/${item.filename}`}
                  download={item.filename}
                  className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
