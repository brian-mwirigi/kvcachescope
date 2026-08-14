import React, { useState } from 'react';
import { Layers, Cpu, X } from 'lucide-react';
import type { Block, WorkerNodeState } from '../types';

interface BlockPoolHeatmapProps {
  blocksByNode: Record<string, Block[]>;
  nodes: Record<string, WorkerNodeState>;
  selectedSeqId: string | null;
  onSelectSeqId: (seqId: string | null) => void;
}

export const BlockPoolHeatmap: React.FC<BlockPoolHeatmapProps> = ({
  blocksByNode,
  nodes,
  selectedSeqId,
  onSelectSeqId
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('ALL');
  const [activeModalBlock, setActiveModalBlock] = useState<Block | null>(null);

  const nodeKeys = Object.keys(nodes);
  const activeBlocks: Block[] = selectedNodeId === 'all'
    ? Object.values(blocksByNode).flat()
    : blocksByNode[selectedNodeId] || [];

  // Filter blocks
  const filteredBlocks = activeBlocks.filter(b => {
    // Filter by sequence
    if (selectedSeqId && !b.sequence_ids.includes(selectedSeqId)) {
      return false;
    }
    // Filter by state
    if (filterState === 'ALL') return true;
    if (filterState === 'HOSTAGE') return b.state === 'HOSTAGE_ZOMBIE';
    if (filterState === 'SHARED') return b.state === 'PREFIX_SHARED' || b.ref_count > 1;
    if (filterState === 'ACTIVE') return b.state === 'ACTIVE';
    if (filterState === 'FREE') return b.state === 'FREE';
    if (filterState === 'SLACK') return b.slack_tokens >= (b.capacity / 2) && b.state !== 'FREE';
    return true;
  });

  const getBlockStyle = (block: Block) => {
    if (block.state === 'HOSTAGE_ZOMBIE') {
      return 'bg-rose-600/90 text-white border-rose-400 animate-pulse shadow-md shadow-rose-600/50';
    }
    if (block.state === 'PREFIX_SHARED' || block.ref_count > 1) {
      return 'bg-emerald-500/80 text-emerald-950 border-emerald-300 font-semibold shadow-sm shadow-emerald-500/30';
    }
    if (block.state === 'ACTIVE') {
      if (block.slack_tokens > (block.capacity / 2)) {
        // High slack
        return 'bg-amber-500/70 text-amber-950 border-amber-300';
      }
      return 'bg-cyan-500/80 text-cyan-950 border-cyan-300';
    }
    // FREE
    return 'bg-slate-900/60 text-slate-600 border-slate-800 hover:border-slate-700';
  };

  return (
    <div className="cyber-card p-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100">
            Physical GPU Block Pool Matrix
          </h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {filteredBlocks.length} Blocks Shown
          </span>
        </div>

        {/* Filters and Node Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Node Tab Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setSelectedNodeId('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedNodeId === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Workers
            </button>
            {nodeKeys.map(nid => (
              <button
                key={nid}
                onClick={() => setSelectedNodeId(nid)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedNodeId === nid ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {nodes[nid]?.name.split(' ')[0] || nid}
              </button>
            ))}
          </div>

          {/* State Filter Buttons */}
          <div className="flex items-center space-x-1 text-xs font-mono">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE', label: 'Active', color: 'text-cyan-400' },
              { id: 'SHARED', label: 'Shared', color: 'text-emerald-400' },
              { id: 'HOSTAGE', label: 'Hostage', color: 'text-rose-400' },
              { id: 'SLACK', label: 'High Slack', color: 'text-amber-400' },
              { id: 'FREE', label: 'Free', color: 'text-slate-500' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterState(f.id)}
                className={`px-2 py-1 rounded border transition-colors ${
                  filterState === f.id 
                    ? 'bg-slate-800 border-slate-600 text-white font-semibold' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className={f.color}>{f.label}</span>
              </button>
            ))}
          </div>

          {/* Clear sequence filter if active */}
          {selectedSeqId && (
            <button
              onClick={() => onSelectSeqId(null)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs font-mono text-rose-300 hover:bg-rose-900/60"
            >
              <span>Seq: {selectedSeqId}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs font-mono py-2.5 text-slate-400 gap-2 border-b border-slate-800/60">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-cyan-500/80 border border-cyan-300" />
            <span>Active Block (16 tokens)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/80 border border-emerald-300" />
            <span>Prefix Shared (Ref &gt; 1)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-rose-600 border border-rose-400 animate-pulse" />
            <span>Hostage / Zombie Leaked</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/70 border border-amber-300" />
            <span>Tail Slack (&gt;50% empty)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-slate-900 border border-slate-800" />
            <span>Free Queue</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-500">Click any block to inspect logical mapping</span>
      </div>

      {/* 2D Block Matrix Grid */}
      <div className="mt-4 grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-24 xl:grid-cols-32 gap-1.5 max-h-[380px] overflow-y-auto p-2 rounded-lg bg-dark-950/80 border border-slate-800/80">
        {filteredBlocks.map((block) => {
          const isHighlighted = selectedSeqId && block.sequence_ids.includes(selectedSeqId);
          return (
            <button
              key={`${block.node_id}-${block.block_id}`}
              onClick={() => setActiveModalBlock(block)}
              className={`h-7 rounded border flex flex-col items-center justify-center text-[10px] font-mono transition-all transform hover:scale-110 hover:z-20 relative ${getBlockStyle(block)} ${
                isHighlighted ? 'ring-2 ring-white scale-105 z-10' : ''
              }`}
              title={`Block #${block.block_id} [${block.state}] - ${block.token_count}/${block.capacity} tokens`}
            >
              <span>{block.block_id}</span>
              {block.ref_count > 1 && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-emerald-900 text-emerald-200 px-1 rounded-full border border-emerald-400 font-bold">
                  {block.ref_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Block Inspector Modal / Popover */}
      {activeModalBlock && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="cyber-card p-6 max-w-md w-full border border-cyan-500/40 cyber-glow">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold font-mono text-slate-100">
                  Block #{activeModalBlock.block_id} Telemetry
                </h3>
              </div>
              <button
                onClick={() => setActiveModalBlock(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Node / Device:</span>
                <span className="text-cyan-300 font-semibold">{nodes[activeModalBlock.node_id]?.name || activeModalBlock.node_id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Lifecycle State:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  activeModalBlock.state === 'HOSTAGE_ZOMBIE' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                  activeModalBlock.state === 'PREFIX_SHARED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  activeModalBlock.state === 'ACTIVE' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-400'
                }`}>
                  {activeModalBlock.state}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Token Fill / Capacity:</span>
                <span className="text-slate-200">
                  {activeModalBlock.token_count} / {activeModalBlock.capacity} tokens 
                  <span className="text-amber-400 ml-1.5">({activeModalBlock.slack_tokens} slack slots)</span>
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Reference Count:</span>
                <span className="text-emerald-400 font-bold">{activeModalBlock.ref_count}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Prefix Hash (Radix):</span>
                <span className="text-purple-300 font-mono">{activeModalBlock.prefix_hash || 'None (Tail Block)'}</span>
              </div>

              {/* 16-Token Physical Slot Allocation Visualizer */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-slate-400">Physical Token Slots (16-token Block):</span>
                  <span className="text-[10px] text-slate-400">
                    {activeModalBlock.token_count} active / {activeModalBlock.slack_tokens} slack
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1 p-2 rounded-lg bg-dark-950 border border-slate-800">
                  {Array.from({ length: activeModalBlock.capacity || 16 }).map((_, idx) => {
                    const isFilled = idx < activeModalBlock.token_count;
                    return (
                      <div
                        key={idx}
                        className={`h-5 rounded flex items-center justify-center text-[9px] font-mono border ${
                          isFilled
                            ? activeModalBlock.state === 'HOSTAGE_ZOMBIE'
                              ? 'bg-rose-600/60 border-rose-400 text-rose-100'
                              : activeModalBlock.state === 'PREFIX_SHARED'
                              ? 'bg-emerald-600/60 border-emerald-400 text-emerald-100'
                              : 'bg-cyan-600/60 border-cyan-400 text-cyan-100'
                            : 'bg-slate-900 border-slate-800/80 text-slate-600'
                        }`}
                        title={`Slot #${idx}: ${isFilled ? 'Allocated Token' : 'Unused Slack Space'}`}
                      >
                        {idx}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Owning Sequences */}
              <div className="pt-2">
                <span className="text-slate-400 block mb-1.5">Owning Sequences:</span>
                {activeModalBlock.sequence_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activeModalBlock.sequence_ids.map(sid => (
                      <button
                        key={sid}
                        onClick={() => {
                          onSelectSeqId(sid);
                          setActiveModalBlock(null);
                        }}
                        className="px-2 py-1 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 text-[11px] hover:bg-cyan-900 hover:border-cyan-500 transition-colors"
                      >
                        {sid} &rarr; Focus in Table
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 italic">None (In Free Queue)</span>
                )}
              </div>

              {/* Token Preview */}
              {activeModalBlock.tokens_preview && (
                <div className="pt-2">
                  <span className="text-slate-400 block mb-1">Stored Tokens Preview:</span>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono select-all">
                    "{activeModalBlock.tokens_preview}"
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-mono">Offset: 0x{((activeModalBlock.physical_id || activeModalBlock.block_id) * 320).toString(16).toUpperCase()}</span>
              <button
                onClick={() => setActiveModalBlock(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-mono transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
