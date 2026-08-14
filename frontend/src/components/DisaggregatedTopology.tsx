import React from 'react';
import { Server, ArrowRight, Cpu, RefreshCw } from 'lucide-react';
import type { WorkerNodeState } from '../types';

interface DisaggregatedTopologyProps {
  nodes: Record<string, WorkerNodeState>;
  onDefragNode: (nodeId: string) => void;
  selectedSeqId: string | null;
  onSelectSeqId: (seqId: string | null) => void;
}

export const DisaggregatedTopology: React.FC<DisaggregatedTopologyProps> = ({
  nodes,
  onDefragNode,
  selectedSeqId,
  onSelectSeqId
}) => {
  const prefillNodes = Object.values(nodes).filter(n => n.role === 'PREFILL');
  const decodeNodes = Object.values(nodes).filter(n => n.role === 'DECODE');

  const renderNodeCard = (node: WorkerNodeState) => {
    const isHostagePresent = node.hostage_blocks_count > 0;

    return (
      <div 
        key={node.node_id}
        className={`p-3.5 rounded-lg border transition-all ${
          isHostagePresent 
            ? 'bg-rose-950/15 border-rose-900' 
            : 'bg-[#121215] border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <Server className="w-3.5 h-3.5 text-zinc-400" />
            <div>
              <span className="font-bold text-zinc-200">{node.name}</span>
              <span className="text-[10px] text-zinc-500 block uppercase">
                {node.role} &bull; {node.total_blocks} BLOCKS
              </span>
            </div>
          </div>
          <button
            onClick={() => onDefragNode(node.node_id)}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono flex items-center space-x-1"
            title="Compact memory and reduce free queue fragmentation"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Compact</span>
          </button>
        </div>

        {/* Memory Pressure Bar */}
        <div className="mt-2.5 space-y-1 font-mono text-xs">
          <div className="flex justify-between text-zinc-400 text-[10px]">
            <span>Memory Pressure:</span>
            <span className={`font-semibold ${node.memory_pressure_pct > 80 ? 'text-rose-400' : 'text-cyan-400'}`}>
              {node.memory_pressure_pct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                node.memory_pressure_pct > 80 ? 'bg-rose-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${node.memory_pressure_pct}%` }}
            />
          </div>
        </div>

        {/* Node stats breakdown */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800/80 flex justify-between">
            <span className="text-zinc-500">Free/Alloc:</span>
            <span className="text-zinc-200 font-semibold">
              {node.free_blocks_count}/{node.allocated_blocks_count}
            </span>
          </div>
          <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800/80 flex justify-between">
            <span className="text-zinc-500">Shared:</span>
            <span className="text-emerald-400 font-semibold">
              {node.shared_blocks_count} blks
            </span>
          </div>
          <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800/80 flex justify-between">
            <span className="text-zinc-500">Slack:</span>
            <span className="text-amber-400 font-semibold">
              {node.internal_fragmentation_pct}%
            </span>
          </div>
          <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800/80 flex justify-between">
            <span className="text-zinc-500">Leaks:</span>
            <span className={`font-semibold ${isHostagePresent ? 'text-rose-400' : 'text-zinc-400'}`}>
              {node.hostage_blocks_count} blks
            </span>
          </div>
        </div>

        {/* Active sequences */}
        <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono">
          <span className="text-zinc-500">Active Requests:</span>
          {node.active_sequence_ids.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
              {node.active_sequence_ids.slice(0, 6).map(sid => (
                <button
                  key={sid}
                  onClick={() => onSelectSeqId(selectedSeqId === sid ? null : sid)}
                  className={`px-1 rounded text-[9px] border ${
                    selectedSeqId === sid 
                      ? 'bg-cyan-500 text-black border-white font-bold' 
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {sid}
                </button>
              ))}
              {node.active_sequence_ids.length > 6 && (
                <span className="text-zinc-500 self-center text-[9px]">
                  +{node.active_sequence_ids.length - 6}
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-600 italic">Idle</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cyber-card p-4 h-full flex flex-col justify-between font-mono">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-zinc-100">
            Cluster Node Topology & Transfer Bus
          </h2>
        </div>
        <span className="text-[11px] text-zinc-400">
          RDMA / PCIe Gen5 Sync Active
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center flex-1">
        {/* Prefill Stage */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>PREFILL STAGE (Prompt Chunking)</span>
          </div>
          {prefillNodes.map(renderNodeCard)}
        </div>

        {/* Transfer Channel */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center p-1 text-center">
          <div className="w-full h-px bg-zinc-800 hidden lg:block mb-1.5" />
          <div className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] flex items-center space-x-1">
            <ArrowRight className="w-2.5 h-2.5 text-cyan-400 hidden lg:block" />
            <span>KV Migration</span>
          </div>
          <span className="text-[8px] text-zinc-500 mt-1">Cross-Node RDMA</span>
          <div className="w-full h-px bg-zinc-800 hidden lg:block mt-1.5" />
        </div>

        {/* Decode Stage */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>DECODE STAGE (Token Generation)</span>
          </div>
          {decodeNodes.map(renderNodeCard)}
        </div>
      </div>
    </div>
  );
};
