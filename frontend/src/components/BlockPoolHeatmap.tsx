import React, { useState } from 'react';
import { Layers, X } from 'lucide-react';
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
    if (selectedSeqId && !b.sequence_ids.includes(selectedSeqId)) {
      return false;
    }
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
      return 'bg-rose-900/80 text-rose-100 border-rose-600 hover:bg-rose-800';
    }
    if (block.state === 'PREFIX_SHARED' || block.ref_count > 1) {
      return 'bg-emerald-900/70 text-emerald-100 border-emerald-600 hover:bg-emerald-800';
    }
    if (block.state === 'ACTIVE') {
      if (block.slack_tokens > (block.capacity / 2)) {
        return 'bg-amber-950/80 text-amber-200 border-amber-600 hover:bg-amber-900';
      }
      return 'bg-cyan-950/80 text-cyan-200 border-cyan-700 hover:bg-cyan-900';
    }
    // FREE
    return 'bg-[#151518] text-zinc-600 border-zinc-800/80 hover:border-zinc-700 hover:text-zinc-400';
  };

  return (
    <div className="cyber-card p-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-zinc-100">
            Physical GPU Block Allocation Table
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {filteredBlocks.length} Blocks
          </span>
        </div>

        {/* Filters and Node Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Node Tab Selector */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-xs">
            <button
              onClick={() => setSelectedNodeId('all')}
              className={`px-2 py-0.5 rounded transition-colors ${
                selectedNodeId === 'all' ? 'bg-zinc-700 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Nodes
            </button>
            {nodeKeys.map(nid => (
              <button
                key={nid}
                onClick={() => setSelectedNodeId(nid)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedNodeId === nid ? 'bg-zinc-700 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {nodes[nid]?.name.split(' ')[0] || nid}
              </button>
            ))}
          </div>

          {/* State Filter Buttons */}
          <div className="flex items-center space-x-1">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE', label: 'Active', color: 'text-cyan-400' },
              { id: 'SHARED', label: 'Shared', color: 'text-emerald-400' },
              { id: 'HOSTAGE', label: 'Hostage', color: 'text-rose-400' },
              { id: 'SLACK', label: 'Slack', color: 'text-amber-400' },
              { id: 'FREE', label: 'Free', color: 'text-zinc-500' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterState(f.id)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  filterState === f.id 
                    ? 'bg-zinc-750 border-zinc-600 text-white font-semibold' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
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
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-xs hover:bg-rose-900"
            >
              <span>Seq: {selectedSeqId}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono py-2 text-zinc-400 gap-2 border-b border-zinc-800/60">
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-950 border border-cyan-700" />
            <span>Active (16 tok)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-950 border border-emerald-700" />
            <span>Prefix Shared</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-950 border border-rose-700" />
            <span>Hostage / Leaked</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-950 border border-amber-700" />
            <span>Tail Slack</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#151518] border border-zinc-800" />
            <span>Free Queue</span>
          </div>
        </div>
        <span className="text-[10px] text-zinc-500">Click any block to inspect virtual translation</span>
      </div>

      {/* 2D Block Matrix Grid */}
      <div className="mt-3 grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-24 xl:grid-cols-32 gap-1 max-h-[340px] overflow-y-auto p-1.5 rounded bg-[#0b0b0e] border border-zinc-800/80">
        {filteredBlocks.map((block) => {
          const isHighlighted = selectedSeqId && block.sequence_ids.includes(selectedSeqId);
          return (
            <button
              key={`${block.node_id}-${block.block_id}`}
              onClick={() => setActiveModalBlock(block)}
              className={`h-6 rounded border flex flex-col items-center justify-center text-[9px] font-mono transition-all relative ${getBlockStyle(block)} ${
                isHighlighted ? 'ring-1 ring-white z-10 font-bold' : ''
              }`}
              title={`Block #${block.block_id} [${block.state}] - ${block.token_count}/${block.capacity} tokens`}
            >
              <span>{block.block_id}</span>
              {block.ref_count > 1 && (
                <span className="absolute -top-1 -right-1 text-[7px] bg-emerald-950 text-emerald-300 px-0.5 rounded border border-emerald-600 font-bold">
                  {block.ref_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Block Inspector Modal */}
      {activeModalBlock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-[#121215] border border-zinc-700 rounded-lg p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-zinc-100">
                  Block #{activeModalBlock.block_id} Inspection
                </h3>
              </div>
              <button
                onClick={() => setActiveModalBlock(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Node:</span>
                <span className="text-zinc-200 font-semibold">{nodes[activeModalBlock.node_id]?.name || activeModalBlock.node_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Lifecycle State:</span>
                <span className={`px-1.5 py-0.2 rounded font-bold text-[11px] ${
                  activeModalBlock.state === 'HOSTAGE_ZOMBIE' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                  activeModalBlock.state === 'PREFIX_SHARED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  activeModalBlock.state === 'ACTIVE' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {activeModalBlock.state}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Token Fill / Capacity:</span>
                <span className="text-zinc-200">
                  {activeModalBlock.token_count} / {activeModalBlock.capacity} tokens 
                  <span className="text-amber-400 ml-1">({activeModalBlock.slack_tokens} slack)</span>
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Reference Count:</span>
                <span className="text-emerald-400 font-bold">{activeModalBlock.ref_count}</span>
              </div>

              {/* 16-Token Physical Slot Allocation Visualizer */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1 text-[11px]">
                  <span className="text-zinc-400">Physical Token Slots:</span>
                  <span className="text-zinc-500">
                    {activeModalBlock.token_count} filled / {activeModalBlock.slack_tokens} empty
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1 p-1.5 rounded bg-zinc-950 border border-zinc-800">
                  {Array.from({ length: activeModalBlock.capacity || 16 }).map((_, idx) => {
                    const isFilled = idx < activeModalBlock.token_count;
                    return (
                      <div
                        key={idx}
                        className={`h-4 rounded flex items-center justify-center text-[8px] font-mono border ${
                          isFilled
                            ? activeModalBlock.state === 'HOSTAGE_ZOMBIE'
                              ? 'bg-rose-950 border-rose-700 text-rose-200'
                              : activeModalBlock.state === 'PREFIX_SHARED'
                              ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
                              : 'bg-cyan-950 border-cyan-700 text-cyan-200'
                            : 'bg-zinc-900 border-zinc-800/60 text-zinc-600'
                        }`}
                      >
                        {idx}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Owning Sequences */}
              <div className="pt-1">
                <span className="text-zinc-400 block mb-1 text-[11px]">Owning Sequences:</span>
                {activeModalBlock.sequence_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {activeModalBlock.sequence_ids.map(sid => (
                      <button
                        key={sid}
                        onClick={() => {
                          onSelectSeqId(sid);
                          setActiveModalBlock(null);
                        }}
                        className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-cyan-300 text-[10px] hover:bg-zinc-700"
                      >
                        {sid} &rarr; Focus in Table
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-zinc-600 italic text-[11px]">None (In Free Queue)</span>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center pt-2 border-t border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-mono">Offset: 0x{((activeModalBlock.physical_id || activeModalBlock.block_id) * 320).toString(16).toUpperCase()}</span>
              <button
                onClick={() => setActiveModalBlock(null)}
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
