import React from 'react';
import { ShieldAlert, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
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
  if (!diagnostics) return null;

  const hasHostages = diagnostics.hostage_sequences.length > 0;

  return (
    <div className={`cyber-card p-5 ${
      hasHostages ? 'border-rose-500/60 bg-rose-950/10' : 'border-slate-800'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-xl ${hasHostages ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
            {hasHostages ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-100">
                Hostage Block & Zombie Leak Hunter
              </h2>
              {hasHostages && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-bold">
                  {diagnostics.hostage_sequences.length} LEAKS DETECTED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Detects logical block tables holding GPU VRAM hostage invisible to physical profilers
            </p>
          </div>
        </div>

        {/* Global Reclaim Button */}
        {hasHostages && (
          <button
            onClick={onReclaimAll}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono text-xs font-bold flex items-center space-x-2 shadow-lg shadow-rose-900/40 transition-all transform hover:scale-105"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reclaim ALL Hostage Blocks ({diagnostics.total_hostage_blocks} blks)</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="mt-4">
        {!hasHostages ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="text-sm font-semibold font-mono text-emerald-300">
                  No Hostage Sequences Detected
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  All logical block tables are synchronized with active client sessions. Free queue is healthy.
                </p>
              </div>
            </div>
            <div className="text-right font-mono text-xs text-slate-400">
              Health Index: <span className="text-emerald-400 font-bold">{diagnostics.health_score}%</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {diagnostics.hostage_sequences.map((h) => (
                <div
                  key={h.sequence_id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-800/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-rose-300">
                        {h.sequence_id}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-900">
                        {h.client_id}
                      </span>
                    </div>
                    <button
                      onClick={() => onReclaimSeq(h.sequence_id)}
                      className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-[11px] font-mono flex items-center space-x-1 transition-colors border border-rose-700/60"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Reclaim ({h.hostage_block_ids.length} blks)</span>
                    </button>
                  </div>

                  <div className="text-[11px] font-mono text-slate-300">
                    <span className="text-slate-500">Root Cause:</span> {h.reason}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                    <span>Idle: {h.idle_duration_sec}s</span>
                    <span>Wasted: {h.wasted_memory_kb} KB</span>
                    <button
                      onClick={() => onSelectSeqId(h.sequence_id)}
                      className="text-cyan-400 hover:underline"
                    >
                      Inspect in Table &rarr;
                    </button>
                  </div>

                  {/* Hostage Block IDs */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {h.hostage_block_ids.slice(0, 12).map((bid) => (
                      <span
                        key={bid}
                        className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-900 text-[10px] font-mono font-bold"
                      >
                        #{bid}
                      </span>
                    ))}
                    {h.hostage_block_ids.length > 12 && (
                      <span className="text-[10px] font-mono text-slate-500 self-center">
                        +{h.hostage_block_ids.length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Diagnostic Recommendations */}
            {diagnostics.recommendations.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs font-mono text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Automated Engine Remediation Advice:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1">
                  {diagnostics.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
