import React from 'react';
import { RefreshCw, Play, Pause, Server, Layers } from 'lucide-react';
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

  const formatScenarioName = (s: string) => {
    switch (s) {
      case 'prefix_caching_demo': return 'Prefix Caching Radix Benchmark';
      case 'hostage_leak_demo': return 'Chaos: Zombie Leaks (CancelledError)';
      case 'disaggregated_stranding': return 'Disaggregated KV Migration Flood';
      case 'slack_waste_saturation': return 'Short Context Slack Saturation';
      default: return 'Continuous Batching (Standard)';
    }
  };

  return (
    <header className="border-b border-zinc-800 bg-[#0d0d10] sticky top-0 z-50 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
      {/* Title & Brand */}
      <div className="flex items-center space-x-3">
        <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-cyan-400">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-zinc-100 tracking-tight">
              kvcachescope
            </span>
            <span className="text-[10px] text-zinc-400 border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.2 rounded">
              PagedAttention Profiler
            </span>
          </div>
        </div>
      </div>

      {/* Cluster Status Pills */}
      <div className="flex items-center space-x-2 text-[11px]">
        {/* Connection status */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          <span className="text-zinc-300">{isConnected ? '10 Hz Telemetry' : 'Disconnected'}</span>
        </div>

        {/* Node count */}
        <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
          <Server className="w-3 h-3 text-zinc-400" />
          <span>3 Nodes (384 Blocks)</span>
        </div>

        {/* Active Scenario */}
        <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
          <span className="text-zinc-500 mr-1">Workload:</span>
          <span className="text-cyan-400 font-medium">{formatScenarioName(scenario)}</span>
        </div>

        {/* Health Score */}
        <div className={`px-2.5 py-1 rounded border font-semibold ${
          healthScore >= 80 ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-rose-950/40 border-rose-800 text-rose-400'
        }`}>
          Health: {healthScore}%
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center space-x-2">
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className={`px-2.5 py-1 rounded flex items-center space-x-1 border transition-colors ${
            isRunning 
              ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' 
              : 'bg-emerald-950/60 hover:bg-emerald-900 border-emerald-800 text-emerald-300'
          }`}
        >
          {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          <span>{isRunning ? 'Pause' : 'Resume'}</span>
        </button>

        {/* Speed selectors */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-zinc-400">
          {[0.5, 1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                currentSpeed === speed 
                  ? 'bg-zinc-700 text-zinc-100 font-bold' 
                  : 'hover:text-zinc-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Reset button */}
        <button
          onClick={onReset}
          className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
          title="Reset KV Cache Pool State"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
