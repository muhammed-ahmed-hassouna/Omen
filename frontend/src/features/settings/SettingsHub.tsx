import React, { useState, useEffect } from 'react';
import { Settings, Save, Database, Trash2, CheckCircle2, ShieldAlert, FileSpreadsheet, Smartphone, Sliders } from 'lucide-react';
import { AppSettings, api } from '../../services/api';

interface SettingsHubProps {
  seenCount: number;
  onSeenCountCleared: () => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
  seenCount,
  onSeenCountCleared,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [testingSheet, setTestingSheet] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.getSettings();
      setSettings(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setFeedback('');
    try {
      await api.saveSettings(settings);
      setFeedback('Settings saved successfully!');
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearSeen = async () => {
    if (!window.confirm(`⚠️ DANGER: This will wipe all ${seenCount} records from the deduplication SQLite cache. Newly scraped places may duplicate previous runs. Proceed?`)) return;
    try {
      const res = await api.clearSeenCount();
      alert(`Cleared ${res.cleared} seen places from SQLite.`);
      onSeenCountCleared();
    } catch (err: any) {
      alert(`Error clearing seen cache: ${err.message}`);
    }
  };

  const handleTestWebhook = async () => {
    if (!settings?.googleSheetWebhookUrl) {
      alert('Please enter a Google Sheets Webhook URL first.');
      return;
    }
    setTestingSheet(true);
    try {
      await api.testSheetsWebhook(settings.googleSheetWebhookUrl);
      alert('Webhook connection successful! Connected to Google Apps Script.');
    } catch (err: any) {
      alert(`Webhook test failed: ${err.message}`);
    } finally {
      setTestingSheet(false);
    }
  };

  if (!settings) {
    return <div className="text-center py-12 text-slate-500 text-xs">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">System & Engine Configuration</h2>
          </div>
          <p className="text-xs text-slate-400">
            Configure integration endpoints, WhatsApp anti-ban intervals, and SQLite database storage controls.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-glow hover:brightness-110 transition-all self-start md:self-auto"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Google Sheets Integration */}
        <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm border-b border-obsidian-border pb-3">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Google Sheets Webhook Settings</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Apps Script Webhook URL (/exec):</label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={settings.googleSheetWebhookUrl}
                onChange={(e) => setSettings({ ...settings, googleSheetWebhookUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Target Google Spreadsheet URL:</label>
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={settings.googleSheetUrl}
                onChange={(e) => setSettings({ ...settings, googleSheetUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={testingSheet}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 text-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{testingSheet ? 'Testing Connection...' : 'Test Webhook Connectivity'}</span>
            </button>
          </div>
        </div>

        {/* 2. WhatsApp Gateway Configuration */}
        <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm border-b border-obsidian-border pb-3">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>WhatsApp Gateway (WPPConnect)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Gateway Endpoint URL:</label>
              <input
                type="url"
                value={settings.wppconnectUrl}
                onChange={(e) => setSettings({ ...settings, wppconnectUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Session Identifier:</label>
              <input
                type="text"
                value={settings.wppSessionName}
                onChange={(e) => setSettings({ ...settings, wppSessionName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
        </div>

        {/* 3. Anti-Ban Timers & Rate Limits */}
        <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm border-b border-obsidian-border pb-3">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Anti-Ban Scheduling & Safety</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Base Send Delay (seconds):</label>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.sendDelaySeconds}
                onChange={(e) => setSettings({ ...settings, sendDelaySeconds: parseInt(e.target.value, 10) || 20 })}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Random Jitter (± seconds):</label>
              <input
                type="number"
                min="0"
                max="30"
                value={settings.delayRandomJitter}
                onChange={(e) => setSettings({ ...settings, delayRandomJitter: parseInt(e.target.value, 10) || 5 })}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Cooldown Every (msgs):</label>
              <input
                type="number"
                min="5"
                max="50"
                value={settings.batchCooldownEvery}
                onChange={(e) => setSettings({ ...settings, batchCooldownEvery: parseInt(e.target.value, 10) || 15 })}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Daily Cap (hard limit):</label>
              <input
                type="number"
                min="10"
                max="100"
                value={settings.dailyMessageCap}
                onChange={(e) => setSettings({ ...settings, dailyMessageCap: parseInt(e.target.value, 10) || 40 })}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs"
              />
            </div>
          </div>
        </div>

        {/* 4. SQLite Seen Places Deduplication Cache */}
        <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm border-b border-obsidian-border pb-3">
            <Database className="w-4 h-4 text-blue-400" />
            <span>SQLite Deduplication CRM</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-border flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">Total Seen Places Indexed:</span>
                <span className="text-xl font-bold font-mono text-cyan-300">
                  {seenCount.toLocaleString()} Records
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearSeen}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition-all font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Wipe Seen Cache</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              The Seen Places table ensures that already extracted businesses will never be re-added or re-messaged.
            </p>
          </div>
        </div>
      </form>

      {feedback && (
        <div className="p-3 text-center text-xs text-cyan-300 font-mono bg-cyan-950/20 rounded-xl border border-cyan-800/30">
          {feedback}
        </div>
      )}
    </div>
  );
};
