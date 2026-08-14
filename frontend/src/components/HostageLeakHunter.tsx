import React, { useState } from 'react';
import { ShieldAlert, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, Search } from 'lucide-react';
import type { DiagnosticReport } from '../types';

interface HostageLeakHunterProps {
  diagnostics: DiagnosticReport | null;
  onReclaimSeq: (seqId: string) => void;
  onReclaimAll: () => void;
  onSelectSeqId: (seqId: string) => void;
}

export const HostageLeakHunter: React.FC<HostageLeakHunterProps> = ({
  diagnostics,
  onReclaimSeq,
  onReclaimAll,
  onSelectSeqId
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!diagnostics) return null;

  const hasHostages = diagnostics.hostage_sequences.length > 0;
  const filteredHostages = diagnostics.hostage_sequences.filter(h =>
    h.sequence_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.client_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`cyber-card p-5 flex flex-col h-full ${
      hasHostages ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-slate-800 gap-2">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg ${
            hasHostages ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
          }`}>
            {hasHostages ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold font-mono text-slate-100">
                Hostage Block & Zombie Leak Hunter
              </h2>
              {hasHostages && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 font-bold">
                  {diagnostics.hostage_sequences.length} LEAKS
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Unreleased GPU memory tables on terminated client sessions
            </p>
          </div>
        </div>

        {/* Global Reclaim Button */}
        {hasHostages && (
          <button
            onClick={onReclaimAll}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-rose-900/30 transition-all hover:scale-105 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reclaim All ({diagnostics.total_hostage_blocks} blks)</span>
          </button>
        )}
      </div>

      {/* Main Body */}
      <div className="mt-3 flex-1 flex flex-col">
        {!hasHostages ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between my-auto">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="text-xs font-semibold font-mono text-emerald-300">
                  Zero Hostage Sequences Detected
                </h4>
                <p className="text-[11px] text-slate-400 font-mono">
                  All logical block tables are synchronized with active client sessions.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-1 rounded border border-emerald-800">
              Pool Health: {diagnostics.health_score}%
            </span>
          </div>
        ) : (
          <div className="space-y-2.5 flex-1 flex flex-col">
            {/* Search Bar for Leaks */}
            {diagnostics.hostage_sequences.length > 4 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by seq_id, client_id, or root cause..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-dark-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Scrollable Compact Leak Rows */}
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {filteredHostages.map((h) => (
                <div
                  key={h.sequence_id}
                  className="p-3 rounded-lg bg-dark-950/90 border border-rose-900/60 hover:border-rose-700/80 transition-all flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onSelectSeqId(h.sequence_id)}
                        className="font-mono text-xs font-bold text-rose-300 hover:underline flex items-center gap-1"
                      >
                        {h.sequence_id}
                      </button>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {h.client_id}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 font-bold border border-rose-900">
                        {h.hostage_block_ids.length} blocks ({h.wasted_memory_kb} KB)
                      </span>
                    </div>

                    <button
                      onClick={() => onReclaimSeq(h.sequence_id)}
                      className="px-2.5 py-1 rounded bg-rose-900/50 hover:bg-rose-800 text-rose-200 text-[11px] font-mono flex items-center space-x-1 border border-rose-800 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Reclaim</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="text-slate-300 truncate max-w-[280px]" title={h.reason}>
                      <span className="text-slate-500">Cause:</span> {h.reason}
                    </span>
                    <span className="text-rose-400 font-semibold">Idle: {h.idle_duration_sec}s</span>
                  </div>

                  {/* Block ID Pills */}
                  <div className="flex flex-wrap items-center gap-1">
                    {h.hostage_block_ids.slice(0, 10).map((bid) => (
                      <span
                        key={bid}
                        className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-900 text-[9px] font-mono font-bold"
                      >
                        #{bid}
                      </span>
                    ))}
                    {h.hostage_block_ids.length > 10 && (
                      <span className="text-[9px] font-mono text-slate-500">
                        +{h.hostage_block_ids.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Remediation Tip */}
            {diagnostics.recommendations.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/40 text-[11px] font-mono text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{diagnostics.recommendations[0]}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
