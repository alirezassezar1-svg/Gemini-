import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Image as ImageIcon,
  Video,
  Film,
  Cpu,
  Clock,
  FolderKanban,
  Activity,
  Menu,
  X,
  Server,
  Zap,
  Shield,
} from 'lucide-react';
import { ServerHealthResponse } from '../types';

export type ActiveTab =
  | 'dashboard'
  | 'image'
  | 'video'
  | 'pipeline'
  | 'settings'
  | 'models'
  | 'queue'
  | 'library'
  | 'diagnostics';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  serverHealth: ServerHealthResponse | null;
  activeJobsCount: number;
  dailyProgress: { completed: number; target: number };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  serverHealth,
  activeJobsCount,
  dailyProgress,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Layers className="w-4 h-4" /> },
    { id: 'image', label: 'Image Studio', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'video', label: 'Video Studio', icon: <Video className="w-4 h-4" /> },
    { id: 'pipeline', label: 'Long-Form Pipeline', icon: <Film className="w-4 h-4" /> },
    { id: 'settings', label: 'Providers & Keys', icon: <Shield className="w-4 h-4" /> },
    { id: 'models', label: 'Model Catalog', icon: <Cpu className="w-4 h-4" /> },
    { id: 'queue', label: 'Production Queue', icon: <Clock className="w-4 h-4" /> },
    { id: 'library', label: 'Asset Library', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Activity className="w-4 h-4" /> },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#080A0F]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleSelectTab('dashboard')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white tracking-tight">Apex AI Studio</span>
                <span className="text-[10px] uppercase font-semibold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                  Google Veo & Gemini
                </span>
              </div>
              <div className="text-xs text-slate-400 hidden sm:block">
                <span>Automated Production Pipeline</span>
                <span className="mx-1.5 text-slate-600">·</span>
                <span>30x30m Daily Engine</span>
              </div>
            </div>
          </div>

          {/* Center Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    active
                      ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === 'queue' && activeJobsCount > 0 && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status Indicators */}
          <div className="flex items-center space-x-3">
            {/* Target Tracker */}
            <div className="hidden md:flex flex-col items-end text-right">
              <div className="text-[11px] text-slate-400">
                Daily Target: <span className="text-white font-mono font-medium">{dailyProgress.completed}</span> / <span className="text-cyan-400 font-mono font-medium">{dailyProgress.target}</span>
              </div>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((dailyProgress.completed / (dailyProgress.target || 1)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Server / API Status */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800 text-xs text-slate-300">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>API Ready</span>
              {serverHealth?.ffmpegAvailable && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> FFmpeg
                  </span>
                </>
              )}
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0B0F17] border-b border-slate-800 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.id === 'queue' && activeJobsCount > 0 && (
                  <span className="text-xs font-mono bg-cyan-900/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-700/40">
                    {activeJobsCount} active
                  </span>
                )}
              </button>
            );
          })}
          <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Daily Target: {dailyProgress.completed} / {dailyProgress.target} vids</span>
            <span className="text-cyan-400 font-mono">FFmpeg: {serverHealth?.ffmpegAvailable ? 'Operational' : 'Unavailable'}</span>
          </div>
        </div>
      )}
    </header>
  );
};
