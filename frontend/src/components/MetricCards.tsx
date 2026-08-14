import React from 'react';
import { HardDrive, Cpu, Percent, AlertTriangle, Sparkles } from 'lucide-react';
import type { ClusterMetrics, DiagnosticReport } from '../types';

interface MetricCardsProps {
  metrics: ClusterMetrics | null;
  diagnostics: DiagnosticReport | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics, diagnostics }) => {
  if (!metrics) return null;

  const usedVramPct = Math.round((metrics.used_vram_mb / Math.max(1, metrics.total_vram_mb)) * 100);
  const hostageCount = metrics.hostage_blocks_count;
  const isHostageCritical = hostageCount > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. VRAM Utilization */}
      <div className="cyber-card p-3.5">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
          <span>Physical VRAM Pool</span>
          <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between font-mono">
          <span className="text-xl font-bold text-zinc-100">
            {metrics.used_vram_mb} <span className="text-xs font-normal text-zinc-500">/ {metrics.total_vram_mb} MB</span>
          </span>
          <span className="text-xs font-semibold text-cyan-400">{usedVramPct}%</span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
          <div 
            className="h-full bg-cyan-500 rounded-full transition-all duration-200"
            style={{ width: `${usedVramPct}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] font-mono text-zinc-400 flex justify-between">
          <span>Tokens: {metrics.logical_tokens_cached}</span>
          <span className="text-emerald-400">Alloc Eff: {metrics.allocation_efficiency_pct}%</span>
        </div>
      </div>

      {/* 2. Internal Slack Fragmentation */}
      <div className="cyber-card p-3.5">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
          <span>Internal Block Slack</span>
          <Percent className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between font-mono">
          <span className="text-xl font-bold text-amber-400">
            {metrics.internal_frag_pct}%
          </span>
          <span className="text-[10px] text-zinc-400 border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 rounded">
            Tail Slack
          </span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
          <div 
            className="h-full bg-amber-500 rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, metrics.internal_frag_pct)}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] font-mono text-zinc-400">
          <span>Unused slots in active blocks</span>
        </div>
      </div>

      {/* 3. External Fragmentation */}
      <div className="cyber-card p-3.5">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
          <span>Free Queue Frag Index</span>
          <Cpu className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between font-mono">
          <span className="text-xl font-bold text-zinc-200">
            {metrics.external_frag_pct}%
          </span>
          <span className="text-[10px] text-zinc-400 border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 rounded">
            Free Runs
          </span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
          <div 
            className="h-full bg-zinc-400 rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, metrics.external_frag_pct)}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] font-mono text-zinc-400">
          <span>Non-contiguous free blocks</span>
        </div>
      </div>

      {/* 4. Hostage / Unreleased Allocations */}
      <div className={`cyber-card p-3.5 border ${
        isHostageCritical ? 'border-rose-800/80 bg-rose-950/15' : 'border-zinc-800'
      }`}>
        <div className="flex items-center justify-between text-xs font-mono">
          <span className={isHostageCritical ? 'text-rose-300 font-semibold' : 'text-zinc-400'}>
            Unreleased Hostage Blocks
          </span>
          <AlertTriangle className={`w-3.5 h-3.5 ${isHostageCritical ? 'text-rose-400' : 'text-zinc-500'}`} />
        </div>
        <div className="mt-2 flex items-baseline justify-between font-mono">
          <span className={`text-xl font-bold ${isHostageCritical ? 'text-rose-400' : 'text-zinc-400'}`}>
            {hostageCount} <span className="text-xs font-normal text-zinc-500">blocks</span>
          </span>
          <span className="text-[11px] font-medium text-rose-300">
            ${metrics.estimated_waste_usd_per_hour}/hr
          </span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
          <div 
            className="h-full bg-rose-500 rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, hostageCount * 4)}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] font-mono flex justify-between text-zinc-400">
          <span>{diagnostics?.hostage_sequences.length ?? 0} Leaked Requests</span>
          <span className={isHostageCritical ? 'text-rose-400 font-medium' : 'text-zinc-500'}>
            {isHostageCritical ? 'LEAK ACTIVE' : 'Clean'}
          </span>
        </div>
      </div>

      {/* 5. Prefix Cache Hit Rate */}
      <div className="cyber-card p-3.5">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
          <span>Prefix Cache Hit Rate</span>
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between font-mono">
          <span className="text-xl font-bold text-emerald-400">
            {metrics.prefix_cache_hit_rate}%
          </span>
          <span className="text-[10px] text-zinc-400 border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 rounded">
            Radix Tree
          </span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, metrics.prefix_cache_hit_rate)}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] font-mono text-zinc-400 flex justify-between">
          <span>Active: {metrics.total_active_sequences}</span>
          <span>Completed: {metrics.total_completed_sequences}</span>
        </div>
      </div>
    </div>
  );
};
