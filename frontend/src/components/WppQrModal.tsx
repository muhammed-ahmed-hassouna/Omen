import React, { useState } from 'react';
import { X, QrCode, RefreshCw, LogOut, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { WppStatus, api } from '../services/api';

interface WppQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  wppStatus: WppStatus | null;
  onRefresh: () => void;
}

export const WppQrModal: React.FC<WppQrModalProps> = ({
  isOpen,
  onClose,
  wppStatus,
  onRefresh,
}) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleStartSession = async () => {
    setLoading(true);
    setMessage('Initiating WhatsApp Gateway session...');
    try {
      await api.startWppSession();
      setMessage('Session started. Waiting for QR Code...');
      setTimeout(() => {
        onRefresh();
      }, 1500);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to log out the current WhatsApp session?')) return;
    setLoading(true);
    try {
      await api.logoutWppSession();
      setMessage('Session logged out successfully.');
      onRefresh();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel bg-obsidian-900 border border-obsidian-border p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-obsidian-border pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">WhatsApp Gateway Authentication</h3>
              <p className="text-xs text-slate-400 font-mono">WPPConnect Server (Port 21465)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-850 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content based on status */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          {!wppStatus || !wppStatus.isOnline ? (
            <div className="text-center space-y-3 p-4 rounded-xl bg-rose-950/20 border border-rose-900/30">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-rose-200">Gateway Offline</p>
                <p className="text-xs text-slate-400 mt-1">
                  Make sure WPPConnect is running. Run <code className="text-emerald-400 font-mono">start-whatsapp.bat</code> on your system.
                </p>
              </div>
            </div>
          ) : wppStatus.status === 'CONNECTED' ? (
            <div className="text-center space-y-3 p-6 rounded-xl bg-emerald-950/20 border border-emerald-900/30 w-full">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-base font-bold text-emerald-200">WhatsApp Authenticated!</p>
                <p className="text-xs text-slate-300 font-mono mt-1">
                  Connected Account: <span className="text-emerald-400 font-bold">+{wppStatus.phone || 'Ready'}</span>
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect Account</span>
                </button>
              </div>
            </div>
          ) : wppStatus.qrcode ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-cyan-500/30 animate-pulse">
                <img
                  src={wppStatus.qrcode}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 object-contain rounded-lg"
                />
              </div>
              <p className="text-xs text-slate-400 font-mono text-center">
                Scan with WhatsApp: <span className="text-slate-200">Linked Devices → Link a Device</span>
              </p>
            </div>
          ) : (
            <div className="text-center space-y-3 py-6">
              <p className="text-sm text-slate-300 font-medium">Session initialized. Generating QR code...</p>
              <button
                onClick={handleStartSession}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow hover:brightness-110 transition-all"
              >
                {loading ? 'Starting...' : 'Request QR Code'}
              </button>
            </div>
          )}

          {message && (
            <p className="text-xs text-cyan-300 font-mono bg-cyan-950/30 px-3 py-1.5 rounded-lg border border-cyan-800/30">
              {message}
            </p>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between border-t border-obsidian-border pt-4 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>End-to-end encrypted session</span>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </div>
  );
};
