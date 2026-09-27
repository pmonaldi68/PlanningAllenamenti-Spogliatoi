import React, { useState, useEffect } from 'react';
import {
  Users,
  Tv,
  DoorClosed,
  Lock,
  Unlock,
  Clock,
  Shield,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Sparkles,
  Calendar,
} from 'lucide-react';

export type AppTab = 'today' | 'weekly' | 'live' | 'admin';

interface NavbarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  onLogoutAdmin: () => void;
  csvConnected: boolean;
  onQuickRefresh?: () => void;
  isRefreshing?: boolean;
  lastSyncedAt?: string;
  todaySessionsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  isAdmin,
  onOpenAdminLogin,
  onLogoutAdmin,
  csvConnected,
  onQuickRefresh,
  isRefreshing = false,
  lastSyncedAt,
  todaySessionsCount = 0,
}) => {
  const [time, setTime] = useState<string>('');
  const [todayName, setTodayName] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
      const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
      setTodayName(days[now.getDay()]);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Logo & CYNTHIA1920 Brand (clicking goes to default 'today') */}
          <div
            className="flex items-center gap-3 cursor-pointer shrink-0 group"
            onClick={() => onTabChange('today')}
          >
            <div className="relative w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-sky-400 to-blue-600 shadow-md shadow-cyan-500/25 shrink-0 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
              <img
                src="/cynthia1920_logo.jpg"
                alt="CYNTHIA1920 Logo"
                className="w-full h-full object-cover rounded-full bg-slate-900"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5 font-display">
                  CYNTHIA1920
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Planning & Spogliatoi
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block truncate max-w-xs">
                {csvConnected ? (
                  <span className="text-cyan-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    Auto-sincro attiva {lastSyncedAt ? `(ore ${lastSyncedAt})` : ''}
                  </span>
                ) : (
                  'Orari ufficiali per atleti, genitori e staff'
                )}
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shadow-inner overflow-x-auto scrollbar-none">
            {/* 1. OGGI - Highlighted Default View */}
            <button
              onClick={() => onTabChange('today')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all shrink-0 cursor-pointer ${
                currentTab === 'today'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                  : 'text-emerald-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Sparkles size={15} className={currentTab === 'today' ? 'text-slate-950' : 'text-emerald-400'} />
              <span>Oggi</span>
              {todayName && (
                <span className={`text-[10px] hidden lg:inline font-bold ${currentTab === 'today' ? 'text-slate-900 opacity-90' : 'text-slate-400'}`}>
                  ({todayName})
                </span>
              )}
              {todaySessionsCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    currentTab === 'today'
                      ? 'bg-slate-950 text-emerald-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {todaySessionsCount}
                </span>
              )}
            </button>

            {/* 2. Planning Settimana */}
            <button
              onClick={() => onTabChange('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                currentTab === 'weekly'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Calendar size={15} />
              <span className="hidden md:inline">Planning Settimana</span>
              <span className="md:hidden">Settimana</span>
            </button>

            {/* 3. Live Board */}
            <button
              onClick={() => onTabChange('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                currentTab === 'live'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Tv size={15} />
              <span className="hidden md:inline">Tabellone Live</span>
              <span className="md:hidden">Live</span>
            </button>

            {/* 4. Admin Area */}
            <button
              onClick={() => {
                if (isAdmin) {
                  onTabChange('admin');
                } else {
                  onOpenAdminLogin();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {isAdmin ? <Unlock size={15} className="text-amber-400" /> : <Lock size={15} />}
              <span className="hidden md:inline">Area Admin & Spogliatoi</span>
              <span className="md:hidden">Admin</span>
              {isAdmin && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              )}
            </button>
          </nav>

          {/* Right Area: Clock & Admin Quick Status */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Refresh if CSV configured */}
            {csvConnected && onQuickRefresh && (
              <button
                onClick={onQuickRefresh}
                disabled={isRefreshing}
                title="Aggiorna dati dal file CSV"
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-amber-400' : ''} />
              </button>
            )}

            {/* Live Clock Chip */}
            <div className="hidden xl:flex items-center gap-2 bg-slate-800/70 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
              <Clock size={14} className="text-emerald-400" />
              <span>{todayName}</span>
              <span className="font-bold text-white">{time}</span>
            </div>

            {/* Admin Badge / Login trigger button */}
            {isAdmin ? (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="font-bold text-amber-300 hidden sm:inline">Admin</span>
                <button
                  onClick={onLogoutAdmin}
                  title="Esci da modalità Admin"
                  className="p-1 hover:text-rose-400 text-slate-400 transition-colors ml-1 cursor-pointer"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Lock size={13} className="text-amber-400" />
                <span className="hidden sm:inline">Accedi Admin</span>
                <span className="sm:hidden">Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
