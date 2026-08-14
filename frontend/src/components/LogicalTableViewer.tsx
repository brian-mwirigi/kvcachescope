import React, { useState } from 'react';
import { GitFork, ShieldAlert, Sparkles, Search } from 'lucide-react';
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
  const [filterQuery, setFilterQuery] = useState('');
  const seqList = Object.values(sequences);

  const filteredSeqList = seqList.filter(s =>
    s.seq_id.toLowerCase().includes(filterQuery.toLowerCase()) ||
    s.client_id.toLowerCase().includes(filterQuery.toLowerCase()) ||
    s.prompt.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const getBlock = (nodeId: string, blockId: number): Block | undefined => {
    return blocksByNode[nodeId]?.find(b => b.block_id === blockId);
  };

  const getStatusBadge = (status: string, isHostage: boolean) => {
    if (isHostage || status === 'ZOMBIE_LEAKED') {
      return (
        <span className="flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 font-bold border border-rose-900">
          <ShieldAlert className="w-2.5 h-2.5" />
          <span>LEAKED</span>
        </span>
      );
    }
    if (status === 'PREFILL') {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-900">
          PREFILL
        </span>
      );
    }
    if (status === 'DECODING') {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-900">
          DECODING
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
        COMPLETED
      </span>
    );
  };

  return (
    <div className="cyber-card p-4 font-mono">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-zinc-800 gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <GitFork className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-zinc-100">
            Sequence Page Tables (Logical &rarr; Physical)
          </h2>
        </div>
        <span className="text-[11px] text-zinc-500">
          {seqList.length} Tracked
        </span>
      </div>

      {seqList.length > 5 && (
        <div className="mt-2.5 relative">
          <Search className="w-3 h-3 absolute left-2.5 top-2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search sequences by ID, prompt..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded pl-7 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
      )}

      <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filteredSeqList.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No active sequences in page tables.
          </div>
        ) : (
          filteredSeqList.map((seq) => {
            const isSelected = selectedSeqId === seq.seq_id;
            const totalTokens = seq.prompt_tokens + seq.generated_tokens;
            const totalAllocatedCap = seq.logical_blocks.length * 16;
            const slack = Math.max(0, totalAllocatedCap - totalTokens);

            return (
              <div
                key={seq.seq_id}
                onClick={() => onSelectSeqId(isSelected ? null : seq.seq_id)}
                className={`p-2.5 rounded border transition-all cursor-pointer ${
                  seq.is_hostage 
                    ? 'bg-rose-950/20 border-rose-900 hover:border-rose-700' 
                    : isSelected
                    ? 'bg-zinc-850 border-cyan-500 ring-1 ring-cyan-500'
                    : 'bg-[#121215] border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Summary row */}
                <div className="flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-cyan-300">
                      {seq.seq_id}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      [{seq.client_id}]
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                      {seq.node_id.replace('node_', '')}
                    </span>
                  </div>
                  {getStatusBadge(seq.status, seq.is_hostage)}
                </div>

                {/* Prompt snippet */}
                <p className="mt-1 text-[11px] text-zinc-400 truncate">
                  <span className="text-zinc-600">Prompt:</span> "{seq.prompt}"
                </p>

                {/* Progress bar */}
                <div className="mt-1.5 flex items-center space-x-2 text-[10px] text-zinc-400">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        seq.is_hostage ? 'bg-rose-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(100, (seq.generated_tokens / Math.max(1, seq.max_tokens)) * 100)}%` }}
                    />
                  </div>
                  <span>{seq.prompt_tokens}p + {seq.generated_tokens}g / {seq.max_tokens}</span>
                  {slack > 0 && (
                    <span className="text-amber-400">
                      ({slack} slack)
                    </span>
                  )}
                </div>

                {/* Virtual Page Table Block Chain */}
                <div className="mt-2 pt-1.5 border-t border-zinc-800/80">
                  <div className="flex flex-wrap items-center gap-1">
                    {seq.logical_blocks.map((blockId, idx) => {
                      const blk = getBlock(seq.node_id, blockId);
                      const isShared = (blk && blk.ref_count > 1) || idx < seq.prefix_shared_blocks;

                      return (
                        <div
                          key={`${seq.seq_id}-blk-${blockId}-${idx}`}
                          className={`flex items-center px-1.5 py-0.5 rounded border text-[10px] ${
                            seq.is_hostage 
                              ? 'bg-rose-950 border-rose-800 text-rose-300'
                              : isShared
                              ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                          }`}
                          title={`Logical block index ${idx} maps to physical block #${blockId}`}
                        >
                          <span className="text-zinc-500 text-[8px] mr-1">L{idx}:</span>
                          <span className="font-bold">#{blockId}</span>
                          {isShared && <Sparkles className="w-2 h-2 ml-0.5 text-emerald-400" />}
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
