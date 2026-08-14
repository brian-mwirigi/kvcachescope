import React from 'react';
import { Activity, RefreshCw, Play, Pause, Layers } from 'lucide-react';
import type { SystemStateSnapshot } from '../types';

interface HeaderProps {
  state: SystemStateSnapshot | null;
  isConnected: boolean;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  currentSpeed: number;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  isConnected,
  onTogglePlay,
  onSpeedChange,
  currentSpeed,
  onReset
}) => {
  const healthScore = state?.diagnostics.health_score ?? 100;
  const isRunning = state?.is_running ?? true;
  const scenario = state?.scenario ?? 'normal_traffic';

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30';
    if (score >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-950/30';
    return 'text-rose-400 border-rose-500/40 bg-rose-950/30 animate-pulse';
  };

  const formatScenarioName = (s: string) => {
    switch (s) {
      case 'prefix_caching_demo': return '⚡ Multi-Turn Prefix Sharing';
      case 'hostage_leak_demo': return '⚠️ Chaos: Hostage Zombie Leaks';
      case 'disaggregated_stranding': return '🌊 Disaggregated KV Burst';
      case 'slack_waste_saturation': return '📉 Short Context Slack Waste';
      default: return '🔄 Continuous Mixed Traffic';
    }
  };

  return (
    <header className="border-b border-slate-800/80 bg-dark-900/90 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Title & Brand */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
              KVCacheScope
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
              PagedAttention v3.8
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Logical Memory & Disaggregated Pool Profiler
          </p>
        </div>
      </div>

      {/* Cluster Status & Diagnostics Pill */}
      <div className="flex items-center space-x-3">
        {/* Connection status */}
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
          <span className="text-slate-300">{isConnected ? 'LIVE (10Hz)' : 'CONNECTING...'}</span>
        </div>

        {/* Active Scenario Pill */}
        <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center space-x-1.5">
          <span>{formatScenarioName(scenario)}</span>
        </div>

        {/* Health Score */}
        <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-mono font-semibold ${getHealthColor(healthScore)}`}>
          <Activity className="w-3.5 h-3.5" />
          <span>Pool Health: {healthScore}/100</span>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="flex items-center space-x-2">
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-mono font-medium transition-all ${
            isRunning 
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40' 
              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
          }`}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? 'Pause' : 'Resume'}</span>
        </button>

        {/* Speed selectors */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono text-slate-400">
          {[0.5, 1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`px-2 py-1 rounded transition-colors ${
                currentSpeed === speed 
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold' 
                  : 'hover:text-slate-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Reset button */}
        <button
          onClick={onReset}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          title="Reset KV Cache Pool"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
