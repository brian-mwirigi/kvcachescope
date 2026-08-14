import React from 'react';
import { Server, ArrowRight, Zap, Cpu, RefreshCw } from 'lucide-react';
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
        className={`p-4 rounded-xl border transition-all ${
          isHostagePresent 
            ? 'bg-rose-950/20 border-rose-800/80 shadow-lg shadow-rose-950/30' 
            : 'bg-dark-900/80 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
          <div className="flex items-center space-x-2">
            <Server className={`w-4 h-4 ${node.role === 'PREFILL' ? 'text-blue-400' : 'text-cyan-400'}`} />
            <div>
              <h3 className="text-xs font-bold font-mono text-slate-100">{node.name}</h3>
              <span className="text-[10px] font-mono uppercase text-slate-400">
                {node.role} INSTANCE &bull; {node.total_blocks} BLOCKS
              </span>
            </div>
          </div>
          <button
            onClick={() => onDefragNode(node.node_id)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center space-x-1"
            title="Defragment & compact slack memory"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Compact</span>
          </button>
        </div>

        {/* Memory Pressure Bar */}
        <div className="mt-3 space-y-1.5 font-mono text-xs">
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>Memory Pressure:</span>
            <span className={`font-semibold ${node.memory_pressure_pct > 80 ? 'text-rose-400' : 'text-cyan-400'}`}>
              {node.memory_pressure_pct}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                node.memory_pressure_pct > 80 
                  ? 'bg-rose-500' 
                  : node.role === 'PREFILL' ? 'bg-blue-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${node.memory_pressure_pct}%` }}
            />
          </div>
        </div>

        {/* Node stats breakdown */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 flex flex-col">
            <span className="text-slate-400">Free / Alloc:</span>
            <span className="text-slate-200 font-bold">
              {node.free_blocks_count} / {node.allocated_blocks_count}
            </span>
          </div>
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 flex flex-col">
            <span className="text-slate-400">Shared Prefix:</span>
            <span className="text-emerald-400 font-bold">
              {node.shared_blocks_count} blocks
            </span>
          </div>
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 flex flex-col">
            <span className="text-slate-400">Slack Waste:</span>
            <span className="text-amber-400 font-bold">
              {node.internal_fragmentation_pct}%
            </span>
          </div>
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 flex flex-col">
            <span className="text-slate-400">Hostage / Leaks:</span>
            <span className={`font-bold ${isHostagePresent ? 'text-rose-400' : 'text-slate-400'}`}>
              {node.hostage_blocks_count} blocks
            </span>
          </div>
        </div>

        {/* Active sequences running on this node */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/60">
          <span className="text-[10px] font-mono text-slate-400 block mb-1">Active Sequences:</span>
          {node.active_sequence_ids.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {node.active_sequence_ids.map(sid => (
                <button
                  key={sid}
                  onClick={() => onSelectSeqId(selectedSeqId === sid ? null : sid)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                    selectedSeqId === sid 
                      ? 'bg-cyan-500 text-black border-white font-bold' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {sid}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[10px] font-mono text-slate-500 italic">Idle</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cyber-card p-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100">
            Disaggregated Inference & KV Cache Routing Topology
          </h2>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-300">
          <Zap className="w-3.5 h-3.5" />
          <span>RDMA / PCIe Gen5 KV-Bus Active</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Prefill Stage */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-mono text-blue-400 font-semibold flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>PREFILL STAGE (Prompt Chunking & Prefix Radix Dedup)</span>
          </div>
          {prefillNodes.map(renderNodeCard)}
        </div>

        {/* Transfer Channel Connector */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center p-2 text-center">
          <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 hidden lg:block mb-2" />
          <div className="px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 text-[10px] font-mono flex items-center space-x-1.5">
            <ArrowRight className="w-3 h-3 text-cyan-400 hidden lg:block" />
            <span>KV Migration Bus</span>
          </div>
          <span className="text-[9px] font-mono text-slate-500 mt-1">Cross-Node RDMA Sync</span>
          <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 hidden lg:block mt-2" />
        </div>

        {/* Decode Stage */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-mono text-cyan-400 font-semibold flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>DECODE STAGE (Autoregressive Token Generation & Tail Allocation)</span>
          </div>
          {decodeNodes.map(renderNodeCard)}
        </div>
      </div>
    </div>
  );
};
