import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Smartphone, 
  ShieldCheck, 
  FileSpreadsheet, 
  Sparkles, 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  QrCode
} from 'lucide-react';
import { Category, Template, CampaignStatus, DailyStats, WppStatus, api } from '../../services/api';

interface OutreachHubProps {
  categories: Category[];
  templates: Template[];
  wppStatus: WppStatus | null;
  onOpenQrModal: () => void;
}

export const OutreachHub: React.FC<OutreachHubProps> = ({
  categories,
  templates,
  wppStatus,
  onOpenQrModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.name || 'Cafes');
  const [availableLeadsCount, setAvailableLeadsCount] = useState<number | null>(null);
  const [loadingLeads, setLoadingLeads] = useState<boolean>(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(templates[0]?.key || 'cafes');

  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  const fetchStatusAndStats = async () => {
    try {
      const [cStatus, dStats] = await Promise.all([
        api.getCampaignStatus(),
        api.getDailyStats(),
      ]);
      setCampaignStatus(cStatus);
      setDailyStats(dStats);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatusAndStats();
    const interval = setInterval(fetchStatusAndStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckLeads = async () => {
    setLoadingLeads(true);
    setFeedback('');
    try {
      const res = await api.getNewLeads(selectedCategory);
      setAvailableLeadsCount(res.count);
      setFeedback(`Found ${res.count} fresh lead(s) with status "New" in tab "${selectedCategory}".`);
    } catch (err: any) {
      setFeedback(`Could not fetch leads from Sheet: ${err.message}`);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!wppStatus || wppStatus.status !== 'CONNECTED') {
      onOpenQrModal();
      return;
    }

    setActionLoading(true);
    setFeedback('');
    try {
      await api.startCampaign(selectedCategory, selectedCategory);
      setFeedback('Campaign started! Sending messages with human-like jitter & anti-ban protection.');
      fetchStatusAndStats();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopCampaign = async () => {
    setActionLoading(true);
    try {
      await api.stopCampaign();
      setFeedback('Campaign stopped.');
      fetchStatusAndStats();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const activeTemplate = templates.find((t) => t.key.toLowerCase() === selectedTemplateKey.toLowerCase());

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Send className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">WhatsApp Outreach CRM</h2>
          </div>
          <p className="text-xs text-slate-400">
            Personalized automated messaging directly to Google Sheet leads with human-like randomized delays and rate caps.
          </p>
        </div>

        {/* WhatsApp Gateway Status Bar */}
        <div className="flex items-center space-x-3">
          {wppStatus?.status === 'CONNECTED' ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp Account Online (+{wppStatus.phone})</span>
            </div>
          ) : (
            <button
              onClick={onOpenQrModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-all animate-pulse"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Connect WhatsApp via QR Code</span>
            </button>
          )}
        </div>
      </div>

      {/* Safety & Anti-Ban Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Today's Messages</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {dailyStats?.count || 0} <span className="text-xs font-normal text-slate-500">/ {dailyStats?.cap || 40} cap</span>
          </div>
          <div className="w-full bg-obsidian-950 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (((dailyStats?.count || 0) / (dailyStats?.cap || 40)) * 100))}%`,
              }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Random Jitter Interval</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">20s ± 5s</div>
          <p className="text-[10px] text-slate-500 font-mono">Bypasses WhatsApp pattern filters</p>
        </div>

        <div className="p-4 rounded-xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Batch Cooldown</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">3 - 7 mins</div>
          <p className="text-[10px] text-slate-500 font-mono">Every 15 messages pause window</p>
        </div>

        <div className="p-4 rounded-xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Allowed Time Window</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">09:00 — 20:00</div>
          <p className="text-[10px] text-slate-500 font-mono">Jordan Local Time (GMT+3)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Campaign Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-5">
            <h3 className="text-sm font-semibold text-slate-200">1. Select Target Category & Check Leads</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Google Sheet Category Tab:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setAvailableLeadsCount(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-emerald-500/50"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <button
                  onClick={handleCheckLeads}
                  disabled={loadingLeads}
                  className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-obsidian-850 hover:bg-obsidian-800 text-slate-200 border border-obsidian-border transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLeads ? 'animate-spin' : ''}`} />
                  <span>{loadingLeads ? 'Querying Sheet...' : 'Check Available New Leads'}</span>
                </button>
              </div>
            </div>

            {availableLeadsCount !== null && (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Ready to send leads with status <code className="text-emerald-400 font-bold">New</code>:
                </span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {availableLeadsCount} Leads
                </span>
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">2. Select Message Template</h3>
              <span className="text-xs text-slate-500 font-mono">Dynamic Placeholders Active</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplateKey(tpl.key)}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    selectedTemplateKey.toLowerCase() === tpl.key.toLowerCase()
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-bold'
                      : 'bg-obsidian-850/50 border-obsidian-border text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block truncate">{tpl.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">key: {tpl.key}</span>
                </button>
              ))}
            </div>

            {activeTemplate && (
              <div className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-border text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Template Body:</span>
                  <span className="text-emerald-400 font-mono">Variables: &#123;business_name&#125;, &#123;zone&#125;</span>
                </div>
                <p className="leading-relaxed bg-obsidian-900 p-3 rounded-lg border border-obsidian-border/50 text-right font-sans" dir="rtl">
                  {activeTemplate.template}
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="space-y-3">
            {campaignStatus?.isRunning ? (
              <button
                onClick={handleStopCampaign}
                disabled={actionLoading}
                className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xl transition-all"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Active Outreach Campaign</span>
              </button>
            ) : (
              <button
                onClick={handleStartCampaign}
                disabled={actionLoading}
                className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white shadow-glow-emerald transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Automated Outreach Batch</span>
              </button>
            )}

            {feedback && (
              <p className="text-xs text-center text-emerald-300 font-mono bg-emerald-950/20 py-2 rounded-lg border border-emerald-900/30">
                {feedback}
              </p>
            )}
          </div>
        </div>

        {/* Right Col: Live Campaign Status Card */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
            <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
              <h3 className="text-sm font-semibold text-slate-200">Live Campaign Status</h3>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  campaignStatus?.isRunning ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                }`}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">State:</span>
                <span
                  className={`font-semibold font-mono ${
                    campaignStatus?.isRunning ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {campaignStatus?.isRunning ? 'ACTIVE RUNNING' : 'IDLE'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Sent This Run:</span>
                <span className="font-bold font-mono text-emerald-400">
                  {campaignStatus?.sentCount || 0}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Failed / Unreachable:</span>
                <span className="font-bold font-mono text-rose-400">
                  {campaignStatus?.failedCount || 0}
                </span>
              </div>

              <div className="border-t border-obsidian-border pt-3 space-y-1">
                <span className="text-[11px] text-slate-500">Worker Status Log:</span>
                <p className="text-xs text-slate-300 font-mono bg-obsidian-950 p-2.5 rounded-lg border border-obsidian-border">
                  {campaignStatus?.statusText || 'No active campaign running.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
