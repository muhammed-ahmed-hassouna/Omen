import React from 'react';
import { 
  Radar, 
  Send, 
  MapPin, 
  Tag, 
  Sparkles, 
  History, 
  Settings, 
  Database,
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { WppStatus } from '../services/api';

export type TabType = 'scraper' | 'outreach' | 'zones' | 'categories' | 'templates' | 'history' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  seenCount: number;
  wppStatus: WppStatus | null;
  scraperRunning: boolean;
  onOpenQrModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  seenCount,
  wppStatus,
  scraperRunning,
  onOpenQrModal,
}) => {
  const navItems = [
    { id: 'scraper' as TabType, label: 'Scraper Hub', icon: Radar },
    { id: 'outreach' as TabType, label: 'WhatsApp Outreach', icon: Send },
    { id: 'zones' as TabType, label: 'Zones', icon: MapPin },
    { id: 'categories' as TabType, label: 'Categories', icon: Tag },
    { id: 'templates' as TabType, label: 'Templates', icon: Sparkles },
    { id: 'history' as TabType, label: 'History', icon: History },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  const getWppBadge = () => {
    if (!wppStatus || !wppStatus.isOnline) {
      return (
        <button
          onClick={onOpenQrModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>WPP Offline</span>
        </button>
      );
    }
    if (wppStatus.status === 'CONNECTED') {
      return (
        <button
          onClick={onOpenQrModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{wppStatus.phone ? `+${wppStatus.phone}` : 'Connected'}</span>
        </button>
      );
    }
    return (
      <button
        onClick={onOpenQrModal}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all animate-pulse"
      >
        <QrCode className="w-3.5 h-3.5" />
        <span>Scan QR</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-obsidian-border bg-obsidian-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow">
              <Radar className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black tracking-wider text-white">OMEN</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  v2.0 REACT
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5">
                Intelligent Lead Engine & Outreach CRM
              </p>
            </div>
          </div>

          {/* Quick Metrics & System Status */}
          <div className="flex items-center space-x-2.5">
            {/* Seen Cache Badge */}
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono bg-obsidian-850 border border-obsidian-border text-slate-300">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">Seen:</span>
              <span className="text-white font-semibold">{seenCount.toLocaleString()}</span>
            </div>

            {/* Scraper Status Badge */}
            <div
              className={`hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
                scraperRunning
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse'
                  : 'bg-obsidian-850 border-obsidian-border text-slate-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${scraperRunning ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
              <span>{scraperRunning ? 'Scraper Active' : 'Scraper Idle'}</span>
            </div>

            {/* WhatsApp Status Pill */}
            {getWppBadge()}
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto no-scrollbar py-2 border-t border-obsidian-border/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-300 border border-cyan-500/30 shadow-glow font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-850'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
