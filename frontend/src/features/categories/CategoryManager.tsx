import React, { useState } from 'react';
import { Tag, Plus, Trash2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Category, api } from '../../services/api';

interface CategoryManagerProps {
  categories: Category[];
  onCategoriesChanged: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  onCategoriesChanged,
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [icon, setIcon] = useState('📌');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createCategory(key.trim().toLowerCase(), name.trim(), icon.trim() || '📌');
      setName('');
      setKey('');
      setIcon('📌');
      onCategoriesChanged();
    } catch (err: any) {
      alert(`Error creating category: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.toggleCategory(id);
      onCategoriesChanged();
    } catch (err: any) {
      alert(`Error toggling category: ${err.message}`);
    }
  };

  const handleDelete = async (id: number, catName: string) => {
    if (!window.confirm(`Delete category "${catName}"?`)) return;
    try {
      await api.deleteCategory(id);
      onCategoriesChanged();
    } catch (err: any) {
      alert(`Error deleting category: ${err.message}`);
    }
  };

  const handleSyncZarqa = async () => {
    setSyncLoading(true);
    try {
      const res = await api.syncZarqaSeeds();
      alert(res.message || 'Zarqa seeds synchronized!');
      onCategoriesChanged();
    } catch (err: any) {
      alert(`Error syncing Zarqa seeds: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Tag className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Business Categories & Sheet Router</h2>
          </div>
          <p className="text-xs text-slate-400">
            Define target business niches and their corresponding destination tabs in Google Sheets.
          </p>
        </div>

        <button
          onClick={handleSyncZarqa}
          disabled={syncLoading}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all self-start md:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{syncLoading ? 'Syncing Seeds...' : 'Sync Zarqa Seed Categories'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Category Form */}
        <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Register New Business Category</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Display Name (Tab Name):</label>
              <input
                type="text"
                required
                placeholder="e.g. Restaurants, Dental Clinics..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!key) setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Search Key (Internal slug):</label>
              <input
                type="text"
                required
                placeholder="e.g. restaurants, clinics..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Emoji Icon:</label>
              <input
                type="text"
                placeholder="e.g. ☕, 🍔, 🩺, 🏋️"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Save Category'}</span>
            </button>
          </form>
        </div>

        {/* Right 2 Cols: Category Grid */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Categories: <strong className="text-white">{categories.length}</strong></span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const isActive = cat.is_active === 1;
              return (
                <div
                  key={cat.id}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-obsidian-850/60 border-obsidian-border text-slate-200'
                      : 'bg-obsidian-950/40 border-slate-900 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate pr-2">
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="truncate">
                      <span className="font-semibold block truncate text-xs">{cat.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">key: {cat.key}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleToggle(cat.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-600'
                      }`}
                    >
                      {isActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
