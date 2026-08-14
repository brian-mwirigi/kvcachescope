import React from 'react';
import { HardDrive, Cpu, Percent, AlertTriangle, Sparkles, ShieldAlert } from 'lucide-react';
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. VRAM Utilization */}
      <div className="cyber-card p-4 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">Physical VRAM Pool</span>
          <HardDrive className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-slate-100">
            {metrics.used_vram_mb} <span className="text-sm font-normal text-slate-400">/ {metrics.total_vram_mb} MB</span>
          </span>
          <span className="text-xs font-mono font-medium text-cyan-400">{usedVramPct}%</span>
        </div>
        {/* Mini progress bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${usedVramPct}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
          <span>Active Tokens: {metrics.logical_tokens_cached}</span>
          <span className="text-emerald-400">Eff: {metrics.allocation_efficiency_pct}%</span>
        </div>
      </div>

      {/* 2. Internal Slack Fragmentation */}
      <div className="cyber-card p-4 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">Internal Slack Waste</span>
          <Percent className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-amber-300">
            {metrics.internal_frag_pct}%
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
            Tail Slack
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
          <div 
            className="h-full bg-amber-400 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, metrics.internal_frag_pct)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] font-mono text-slate-400">
          <span>Unused slots in allocated blocks</span>
        </div>
      </div>

      {/* 3. External Fragmentation */}
      <div className="cyber-card p-4 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">External Frag Index</span>
          <Cpu className="w-4 h-4 text-purple-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-purple-300">
            {metrics.external_frag_pct}%
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-800/40">
            Free Queue
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
          <div 
            className="h-full bg-purple-400 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, metrics.external_frag_pct)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] font-mono text-slate-400">
          <span>Non-contiguous free runs</span>
        </div>
      </div>

      {/* 4. Hostage / Zombie Blocks */}
      <div className={`cyber-card p-4 relative overflow-hidden group border-2 ${
        isHostageCritical ? 'border-rose-500/70 bg-rose-950/20 cyber-glow-rose' : 'border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
            {isHostageCritical && <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />}
            Hostage Blocks
          </span>
          <AlertTriangle className={`w-4 h-4 ${isHostageCritical ? 'text-rose-400' : 'text-slate-500'}`} />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className={`text-2xl font-bold font-mono ${isHostageCritical ? 'text-rose-400' : 'text-slate-400'}`}>
            {hostageCount} <span className="text-xs font-normal">blocks</span>
          </span>
          <span className="text-[11px] font-mono font-medium text-rose-300">
            ${metrics.estimated_waste_usd_per_hour}/hr
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
          <div 
            className="h-full bg-rose-500 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, hostageCount * 4)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] font-mono flex justify-between text-slate-400">
          <span>{diagnostics?.hostage_sequences.length ?? 0} Rogue Session(s)</span>
          <span className={isHostageCritical ? 'text-rose-400 font-semibold' : ''}>
            {isHostageCritical ? 'LEAK DETECTED' : 'Clean'}
          </span>
        </div>
      </div>

      {/* 5. Prefix Cache Hit Rate */}
      <div className="cyber-card p-4 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">Prefix Cache Hit Rate</span>
          <Sparkles className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-emerald-300">
            {metrics.prefix_cache_hit_rate}%
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            Radix Reuse
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
          <div 
            className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, metrics.prefix_cache_hit_rate)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
          <span>Active Seqs: {metrics.total_active_sequences}</span>
          <span>Done: {metrics.total_completed_sequences}</span>
        </div>
      </div>
    </div>
  );
};
