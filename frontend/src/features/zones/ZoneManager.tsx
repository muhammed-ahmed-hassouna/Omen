import React, { useState } from 'react';
import { MapPin, Plus, Search, Trash2, CheckCircle2, XCircle, Layers } from 'lucide-react';
import { Zone, api } from '../../services/api';

interface ZoneManagerProps {
  zones: Zone[];
  cities: string[];
  onZonesChanged: () => void;
}

export const ZoneManager: React.FC<ZoneManagerProps> = ({
  zones,
  cities,
  onZonesChanged,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  
  // Single Add State
  const [newZoneName, setNewZoneName] = useState<string>('');
  const [newZoneCity, setNewZoneCity] = useState<string>(cities[0] || 'Amman');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Bulk Add State
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkCity, setBulkCity] = useState<string>(cities[0] || 'Amman');
  const [bulkText, setBulkText] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  const filteredZones = zones.filter((z) => {
    const matchesCity = selectedCity === 'All' || z.city === selectedCity;
    const matchesSearch = z.name.toLowerCase().includes(search.toLowerCase());
    return matchesCity && matchesSearch;
  });

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    setIsAdding(true);
    try {
      await api.createZone(newZoneName.trim(), newZoneCity);
      setNewZoneName('');
      onZonesChanged();
    } catch (err: any) {
      alert(`Error creating zone: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!bulkText.trim()) return;
    const names = bulkText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    setBulkLoading(true);
    try {
      const res = await api.createZonesBulk(bulkCity, names);
      alert(`Successfully added ${res.added} zones!`);
      setBulkText('');
      setBulkModalOpen(false);
      onZonesChanged();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.toggleZone(id);
      onZonesChanged();
    } catch (err: any) {
      alert(`Error toggling zone: ${err.message}`);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete zone "${name}"?`)) return;
    try {
      await api.deleteZone(id);
      onZonesChanged();
    } catch (err: any) {
      alert(`Error deleting zone: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Geographic Zone Manager</h2>
          </div>
          <p className="text-xs text-slate-400">
            Define, partition, and maintain municipal search zones across Jordan to optimize Google Maps extraction coverage.
          </p>
        </div>

        <button
          onClick={() => setBulkModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold shadow-glow hover:brightness-110 transition-all self-start md:self-auto"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Bulk Import Zones</span>
        </button>
      </div>

      {/* Control Strip & Add Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Add Zone Card */}
        <div className="p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Add New Single Zone</h3>
          <form onSubmit={handleCreateZone} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Target City:</label>
              <select
                value={newZoneCity}
                onChange={(e) => setNewZoneCity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-cyan-500/50"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Zone / Neighborhood Name:</label>
              <input
                type="text"
                required
                placeholder="e.g. Al-Rawabi, Khalda, Sweifieh..."
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold bg-obsidian-850 hover:bg-obsidian-800 text-cyan-300 border border-cyan-500/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'Adding...' : 'Add Zone to Directory'}</span>
            </button>
          </form>
        </div>

        {/* Right 2 Cols: Zone Directory Table */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* City Tabs */}
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-obsidian-950 border border-obsidian-border overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedCity('All')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedCity === 'All'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({zones.length})
              </button>
              {cities.map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    selectedCity === city
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {city} ({zones.filter((z) => z.city === city).length})
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search zones..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs focus:outline-none focus:border-cyan-500/50 w-full sm:w-48"
              />
            </div>
          </div>

          {/* Zones List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredZones.map((zone) => {
              const isActive = zone.is_active === 1;
              return (
                <div
                  key={zone.id}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                    isActive
                      ? 'bg-obsidian-850/60 border-obsidian-border text-slate-200'
                      : 'bg-obsidian-950/40 border-slate-900 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <span className="font-semibold block truncate">{zone.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{zone.city}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleToggle(zone.id)}
                      title={isActive ? 'Deactivate Zone' : 'Activate Zone'}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isActive
                          ? 'text-emerald-400 hover:bg-emerald-500/10'
                          : 'text-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      {isActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(zone.id, zone.name)}
                      title="Delete Zone"
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

      {/* Bulk Add Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Bulk Import Zones</h3>
            <p className="text-xs text-slate-400">
              Paste a list of zone names separated by newlines or commas.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">Target City:</label>
              <select
                value={bulkCity}
                onChange={(e) => setBulkCity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={6}
              placeholder="Amman Downtown&#10;7th Circle&#10;Abdoun&#10;Jabal Al-Weibdeh"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full p-3 rounded-xl bg-obsidian-950 border border-obsidian-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
            />

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setBulkModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-obsidian-850"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCreate}
                disabled={bulkLoading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow hover:brightness-110"
              >
                {bulkLoading ? 'Importing...' : 'Confirm Bulk Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
