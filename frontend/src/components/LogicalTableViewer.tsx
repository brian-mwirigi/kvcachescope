import React from 'react';
import { GitFork, ShieldAlert, Sparkles } from 'lucide-react';
import type { Sequence, Block } from '../types';

interface LogicalTableViewerProps {
  sequences: Record<string, Sequence>;
  blocksByNode: Record<string, Block[]>;
  selectedSeqId: string | null;
  onSelectSeqId: (seqId: string | null) => void;
}

export const LogicalTableViewer: React.FC<LogicalTableViewerProps> = ({
  sequences,
  blocksByNode,
  selectedSeqId,
  onSelectSeqId
}) => {
  const seqList = Object.values(sequences);

  // Helper to find block details
  const getBlock = (nodeId: string, blockId: number): Block | undefined => {
    return blocksByNode[nodeId]?.find(b => b.block_id === blockId);
  };

  const getStatusBadge = (status: string, isHostage: boolean) => {
    if (isHostage || status === 'ZOMBIE_LEAKED') {
      return (
        <span className="flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-400 font-bold animate-pulse">
          <ShieldAlert className="w-3 h-3" />
          <span>HOSTAGE LEAK</span>
        </span>
      );
    }
    if (status === 'PREFILL') {
      return (
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800 text-blue-400">
          PREFILL
        </span>
      );
    }
    if (status === 'DECODING') {
      return (
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-400">
          DECODING
        </span>
      );
    }
    if (status === 'FINISHED') {
      return (
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
          COMPLETED
        </span>
      );
    }
    return (
      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-400">
        {status}
      </span>
    );
  };

  return (
    <div className="cyber-card p-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <GitFork className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100">
            Logical Sequence Block Tables (Virtual Memory Map)
          </h2>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {seqList.length} Active / Tracked Sequences
        </span>
      </div>

      <div className="mt-4 space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
        {seqList.length === 0 ? (
          <div className="text-center py-8 text-slate-500 font-mono text-xs">
            No active sequences currently in logical block tables.
          </div>
        ) : (
          seqList.map((seq) => {
            const isSelected = selectedSeqId === seq.seq_id;
            const totalTokens = seq.prompt_tokens + seq.generated_tokens;
            const totalAllocatedCap = seq.logical_blocks.length * 16;
            const slack = Math.max(0, totalAllocatedCap - totalTokens);

            return (
              <div
                key={seq.seq_id}
                onClick={() => onSelectSeqId(isSelected ? null : seq.seq_id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  seq.is_hostage 
                    ? 'bg-rose-950/20 border-rose-800/80 hover:border-rose-600' 
                    : isSelected
                    ? 'bg-cyan-950/30 border-cyan-500/80 ring-1 ring-cyan-500'
                    : 'bg-dark-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top sequence summary row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono text-xs font-bold text-cyan-300">
                      {seq.seq_id}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      [{seq.client_id}]
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Node: {seq.node_id.replace('node_', '')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(seq.status, seq.is_hostage)}
                  </div>
                </div>

                {/* Prompt snippet */}
                <p className="mt-1.5 text-xs text-slate-300 font-mono truncate">
                  <span className="text-slate-500">Prompt:</span> "{seq.prompt}"
                </p>

                {/* Progress bar for generation */}
                <div className="mt-2.5 flex items-center space-x-3 text-xs font-mono text-slate-400">
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        seq.is_hostage ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                      }`}
                      style={{ width: `${Math.min(100, (seq.generated_tokens / Math.max(1, seq.max_tokens)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px]">
                    Tokens: {seq.prompt_tokens}p + {seq.generated_tokens}g / {seq.max_tokens} max
                  </span>
                  {slack > 0 && (
                    <span className="text-[11px] text-amber-400">
                      Slack: {slack} slots
                    </span>
                  )}
                </div>

                {/* Virtual Page Table Block Chain */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                    <span>Virtual Token Range &rarr; Physical GPU Block ID</span>
                    <span className="text-cyan-400">{seq.logical_blocks.length} Blocks Allocated</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {seq.logical_blocks.map((blockId, idx) => {
                      const blk = getBlock(seq.node_id, blockId);
                      const isShared = (blk && blk.ref_count > 1) || idx < seq.prefix_shared_blocks;
                      const isTail = idx === seq.logical_blocks.length - 1;
                      const startToken = idx * 16;
                      const endToken = Math.min(totalTokens, (idx + 1) * 16) - 1;

                      return (
                        <div
                          key={`${seq.seq_id}-blk-${blockId}-${idx}`}
                          className={`flex items-center px-2 py-1 rounded border text-[11px] font-mono ${
                            seq.is_hostage 
                              ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                              : isShared
                              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                              : isTail && blk && blk.slack_tokens > 8
                              ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-cyan-300'
                          }`}
                          title={`Logical Block ${idx} [tokens ${startToken}..${endToken}] -> Physical Block #${blockId}`}
                        >
                          <span className="text-slate-400 text-[9px] mr-1">L{idx}:</span>
                          <span className="font-bold">#{blockId}</span>
                          {isShared && <Sparkles className="w-2.5 h-2.5 ml-1 text-emerald-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
