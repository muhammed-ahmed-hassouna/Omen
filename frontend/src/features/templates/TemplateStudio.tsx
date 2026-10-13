import React, { useState } from 'react';
import { Sparkles, Save, Trash2, Smartphone, CheckCheck, Tag } from 'lucide-react';
import { Template, api } from '../../services/api';

interface TemplateStudioProps {
  templates: Template[];
  onTemplatesChanged: () => void;
}

export const TemplateStudio: React.FC<TemplateStudioProps> = ({
  templates,
  onTemplatesChanged,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(templates[0]?.key || 'cafes');
  const currentTemplate = templates.find((t) => t.key === selectedKey) || templates[0];

  const [title, setTitle] = useState(currentTemplate?.title || '');
  const [body, setBody] = useState(currentTemplate?.template || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Sample data for realistic preview
  const [mockBusiness, setMockBusiness] = useState('كافيه الأندلس (Al-Andalus)');
  const [mockZone, setMockZone] = useState('العبدلي - بوليفارد');

  const handleSelect = (tpl: Template) => {
    setSelectedKey(tpl.key);
    setTitle(tpl.title);
    setBody(tpl.template);
    setFeedback('');
  };

  const insertVariable = (variable: string) => {
    setBody((prev) => `${prev} ${variable} `);
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setFeedback('');
    try {
      await api.saveTemplate(selectedKey, title.trim(), body.trim());
      setFeedback('Template saved successfully!');
      onTemplatesChanged();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Render simulated message for the WhatsApp preview
  const previewText = body
    .replace(/\{business_name\}/g, mockBusiness)
    .replace(/\{zone\}/g, mockZone);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Dynamic Offer Template Studio</h2>
          </div>
          <p className="text-xs text-slate-400">
            Design personalized Arabic/English outreach messages with dynamic placeholder insertion and real-time WhatsApp simulation.
          </p>
        </div>

        {/* Template Quick Selector */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleSelect(tpl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedKey === tpl.key
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30 font-bold'
                  : 'bg-obsidian-850 text-slate-400 hover:text-white'
              }`}
            >
              {tpl.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Editor */}
        <div className="lg:col-span-7 space-y-5 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Template Title / Category Tab Target:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs font-semibold focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Variable Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Click to Insert Dynamic Placeholder:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => insertVariable('{business_name}')}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono hover:bg-cyan-500/20 transition-colors"
              >
                + &#123;business_name&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable('{zone}')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono hover:bg-emerald-500/20 transition-colors"
              >
                + &#123;zone&#125;
              </button>
            </div>
          </div>

          {/* Body Editor */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Message Content (Arabic / English):</label>
            <textarea
              rows={8}
              dir="rtl"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-4 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-sm leading-relaxed focus:outline-none focus:border-purple-500/50 font-sans"
            />
          </div>

          {/* Preview Inputs */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-obsidian-950 border border-obsidian-border text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Preview &#123;business_name&#125;:</span>
              <input
                type="text"
                value={mockBusiness}
                onChange={(e) => setMockBusiness(e.target.value)}
                className="w-full bg-transparent text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Preview &#123;zone&#125;:</span>
              <input
                type="text"
                value={mockZone}
                onChange={(e) => setMockZone(e.target.value)}
                className="w-full bg-transparent text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-xl hover:brightness-110 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Template Changes'}</span>
            </button>

            {feedback && (
              <span className="text-xs text-purple-300 font-mono">{feedback}</span>
            )}
          </div>
        </div>

        {/* Right 5 Columns: WhatsApp Phone Screen Mockup */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-3">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Simulated WhatsApp Screen</span>
          </div>

          {/* Realistic Phone Container */}
          <div className="w-full max-w-sm rounded-[2.5rem] bg-[#0b141a] border-4 border-slate-700/80 shadow-2xl p-4 overflow-hidden relative space-y-3">
            {/* Phone Notch */}
            <div className="w-28 h-3.5 bg-slate-800 rounded-full mx-auto" />

            {/* Chat Header */}
            <div className="flex items-center space-x-2.5 border-b border-slate-800/80 pb-2.5 px-1">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                O
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100">{mockBusiness}</p>
                <p className="text-[10px] text-emerald-400 font-mono">online</p>
              </div>
            </div>

            {/* Chat Bubble Area */}
            <div className="py-8 px-1 min-h-[220px] flex flex-col justify-end">
              <div
                className="max-w-[85%] self-end bg-[#005c4b] text-slate-100 p-3.5 rounded-2xl rounded-tr-none shadow-md space-y-1.5 text-xs text-right font-sans"
                dir="rtl"
              >
                <p className="leading-relaxed whitespace-pre-wrap">{previewText}</p>
                <div className="flex items-center justify-start space-x-1 text-[10px] text-emerald-300 font-mono" dir="ltr">
                  <span>14:05</span>
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                </div>
              </div>
            </div>

            {/* Fake Keyboard Input Area */}
            <div className="p-2 rounded-xl bg-[#1f2c34] text-slate-500 text-[11px] flex justify-between items-center">
              <span>Message...</span>
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                🎙️
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
