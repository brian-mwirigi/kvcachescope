import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Play, Pause, RefreshCw, Layers, Database, GitFork, 
  Server, AlertTriangle, Terminal, Download, Search, Trash2, Cpu
} from 'lucide-react';
import type { SystemStateSnapshot, Block, Sequence, EventLog } from './types';

export function App() {
  const [snapshot, setSnapshot] = useState<SystemStateSnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);
  const [activeTab, setActiveTab] = useState<'memory_map' | 'page_tables' | 'topology' | 'leaks' | 'events'>('memory_map');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedSeqId, setSelectedSeqId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<string>('ALL');
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const wsRef = useRef<WebSocket | null>(null);

  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    if (host.includes('5173')) return 'ws://localhost:8000/ws/stream';
    return `${protocol}//${host}/ws/stream`;
  };

  const getApiUrl = (endpoint: string) => {
    if (window.location.host.includes('5173')) return `http://localhost:8000${endpoint}`;
    return endpoint;
  };

  useEffect(() => {
    let reconnectTimeout: any;
    const connectWs = () => {
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;
        ws.onopen = () => setIsConnected(true);
        ws.onmessage = (event) => {
          try {
            const data: SystemStateSnapshot = JSON.parse(event.data);
            setSnapshot(data);
          } catch (e) {
            console.error("WS Parse error", e);
          }
        };
        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 1500);
        };
        ws.onerror = () => ws.close();
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 1500);
      }
    };
    connectWs();
    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleTogglePlay = async () => {
    if (!snapshot) return;
    await fetch(getApiUrl('/api/simulation/control'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ running: !snapshot.is_running })
    });
  };

  const handleSpeedChange = async (speed: number) => {
    setCurrentSpeed(speed);
    await fetch(getApiUrl('/api/simulation/control'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed })
    });
  };

  const handleReset = async () => {
    await fetch(getApiUrl('/api/simulation/reset'), { method: 'POST' });
    setSelectedSeqId(null);
    setSelectedBlock(null);
  };

  const handleSelectScenario = async (scenario: string) => {
    await fetch(getApiUrl('/api/scenarios/set'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario })
    });
  };

  const handleInjectLeak = async () => {
    await fetch(getApiUrl('/api/chaos/inject_leak'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: "ASYNC_CANCELLED_ERROR_BACKEND_PROPAGATION_FAILURE" })
    });
  };

  const handleReclaimSeq = async (sequenceId: string) => {
    await fetch(getApiUrl('/api/diagnostics/reclaim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId })
    });
  };

  const handleReclaimAll = async () => {
    await fetch(getApiUrl('/api/diagnostics/reclaim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });
  };

  const handleDefrag = async (nodeId: string) => {
    await fetch(getApiUrl('/api/diagnostics/defragment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: nodeId })
    });
  };

  const metrics = snapshot?.metrics;
  const diagnostics = snapshot?.diagnostics;
  const blocksByNode = snapshot?.blocks_by_node ?? {};
  const sequences = snapshot?.sequences ?? {};
  const nodes = snapshot?.nodes ?? {};
  const events = snapshot?.recent_events ?? [];

  const allBlocks: Block[] = selectedNode === 'all' 
    ? Object.values(blocksByNode).flat() 
    : blocksByNode[selectedNode] || [];

  const filteredBlocks = allBlocks.filter(b => {
    if (selectedSeqId && !b.sequence_ids.includes(selectedSeqId)) return false;
    if (filterState === 'ACTIVE') return b.state === 'ACTIVE';
    if (filterState === 'SHARED') return b.state === 'PREFIX_SHARED' || b.ref_count > 1;
    if (filterState === 'HOSTAGE') return b.state === 'HOSTAGE_ZOMBIE';
    if (filterState === 'SLACK') return b.slack_tokens >= (b.capacity / 2) && b.state !== 'FREE';
    if (filterState === 'FREE') return b.state === 'FREE';
    return true;
  });

  const seqList = Object.values(sequences).filter(s => 
    s.seq_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.client_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#d4d4d8] font-mono text-[11px] flex flex-col antialiased select-none">
      {/* 1. Top System Toolbar (Chrome DevTools / Datadog Style) */}
      <div className="h-9 border-b border-[#27272a] bg-[#141417] px-3 flex items-center justify-between gap-4">
        {/* Left: Brand & Engine status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold text-zinc-100 text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>kvcachescope</span>
            <span className="text-[10px] text-zinc-500 font-normal">v0.1.0</span>
          </div>
          <div className="h-3.5 w-px bg-zinc-700" />
          <div className="flex items-center space-x-1 text-zinc-400">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span>{isConnected ? '10Hz sampling' : 'disconnected'}</span>
          </div>
          <div className="h-3.5 w-px bg-zinc-700" />
          <div className="text-zinc-400">
            target: <span className="text-zinc-200">vLLM / PagedAttention (3 nodes, 384 blocks)</span>
          </div>
        </div>

        {/* Center: Live Cluster Summary */}
        <div className="flex items-center space-x-4 text-zinc-300">
          <div>
            <span className="text-zinc-500">VRAM: </span>
            <span className="font-semibold text-zinc-100">{metrics?.used_vram_mb ?? 0}</span>
            <span className="text-zinc-500">/{metrics?.total_vram_mb ?? 120}MB</span>
          </div>
          <div>
            <span className="text-zinc-500">Slack: </span>
            <span className="font-semibold text-amber-400">{metrics?.internal_frag_pct ?? 0}%</span>
          </div>
          <div>
            <span className="text-zinc-500">Radix Reuse: </span>
            <span className="font-semibold text-emerald-400">{metrics?.prefix_cache_hit_rate ?? 0}%</span>
          </div>
          <div>
            <span className="text-zinc-500">Leaked: </span>
            <span className={`font-semibold ${(metrics?.hostage_blocks_count ?? 0) > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
              {metrics?.hostage_blocks_count ?? 0} blks (${metrics?.estimated_waste_usd_per_hour ?? '0.00'}/hr)
            </span>
          </div>
        </div>

        {/* Right: Engine Control Buttons */}
        <div className="flex items-center space-x-1.5">
          <select 
            value={snapshot?.scenario ?? 'normal_traffic'}
            onChange={(e) => handleSelectScenario(e.target.value)}
            className="bg-[#1c1c21] border border-zinc-700 text-zinc-200 text-[11px] px-2 py-0.5 rounded focus:outline-none focus:border-zinc-500"
          >
            <option value="normal_traffic">Workload: Continuous Batching</option>
            <option value="prefix_caching_demo">Workload: Prefix Caching Radix</option>
            <option value="hostage_leak_demo">Workload: Abort Divergence (Chaos)</option>
            <option value="disaggregated_stranding">Workload: Disaggregated KV Flood</option>
            <option value="slack_waste_saturation">Workload: Tail Slack Saturation</option>
          </select>

          <button
            onClick={handleInjectLeak}
            className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 transition-colors"
            title="Trigger client abort error"
          >
            Abort Stream
          </button>

          {diagnostics && diagnostics.hostage_sequences.length > 0 && (
            <button
              onClick={handleReclaimAll}
              className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors"
            >
              Reclaim ({diagnostics.total_hostage_blocks})
            </button>
          )}

          <div className="h-3.5 w-px bg-zinc-700" />

          <button
            onClick={handleTogglePlay}
            className="p-1 rounded bg-[#1c1c21] border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
          >
            {snapshot?.is_running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#1c1c21] border border-zinc-700 text-zinc-400 hover:text-zinc-200"
            title="Reset simulation"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. Profiler Tab Ribbon */}
      <div className="h-8 border-b border-[#27272a] bg-[#111114] px-3 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {[
            { id: 'memory_map', label: 'Physical Memory Pool', icon: Database, count: allBlocks.length },
            { id: 'page_tables', label: 'Logical Page Tables', icon: GitFork, count: Object.keys(sequences).length },
            { id: 'topology', label: 'Cluster Topology & Bus', icon: Server, count: Object.keys(nodes).length },
            { id: 'leaks', label: 'Memory Leaks / Divergence', icon: AlertTriangle, count: diagnostics?.hostage_sequences.length ?? 0, badgeColor: (diagnostics?.hostage_sequences.length ?? 0) > 0 ? 'bg-rose-900 text-rose-200' : 'bg-zinc-800 text-zinc-400' },
            { id: 'events', label: 'Event Stream', icon: Terminal, count: events.length },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-7 px-2.5 flex items-center space-x-1.5 border-b-2 transition-colors ${
                  isActive 
                    ? 'border-cyan-400 text-zinc-100 font-semibold bg-[#1a1a1f]' 
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#16161a]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1 py-0.2 rounded text-[9px] ${tab.badgeColor || 'bg-zinc-800 text-zinc-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search / Filter in Ribbon */}
        {activeTab === 'page_tables' && (
          <div className="flex items-center space-x-1">
            <Search className="w-3 h-3 text-zinc-500" />
            <input
              type="text"
              placeholder="filter seq_id, client, prompt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1c1c21] border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-48"
            />
          </div>
        )}
      </div>

      {/* 3. Main Workspace Area */}
      <div className="flex-1 overflow-hidden p-3 flex flex-col">
        {/* TAB 1: PHYSICAL MEMORY POOL (2D Matrix + Inspector Pane) */}
        {activeTab === 'memory_map' && (
          <div className="flex-1 flex gap-3 overflow-hidden">
            {/* Left: Memory Grid */}
            <div className="flex-1 border border-[#27272a] bg-[#121215] rounded flex flex-col overflow-hidden">
              {/* Grid Toolbar */}
              <div className="h-8 border-b border-[#27272a] px-2.5 bg-[#151519] flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-2">
                  <span className="text-zinc-400">Node:</span>
                  <div className="flex items-center bg-[#1c1c21] border border-zinc-800 rounded">
                    <button
                      onClick={() => setSelectedNode('all')}
                      className={`px-2 py-0.5 ${selectedNode === 'all' ? 'bg-zinc-700 text-zinc-100 font-bold' : 'text-zinc-400'}`}
                    >
                      All
                    </button>
                    {Object.keys(nodes).map(nid => (
                      <button
                        key={nid}
                        onClick={() => setSelectedNode(nid)}
                        className={`px-2 py-0.5 ${selectedNode === nid ? 'bg-zinc-700 text-zinc-100 font-bold' : 'text-zinc-400'}`}
                      >
                        {nid.replace('node_', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {[
                      { id: 'ALL', label: 'All' },
                      { id: 'ACTIVE', label: 'Active', color: 'text-cyan-400' },
                      { id: 'SHARED', label: 'Shared', color: 'text-emerald-400' },
                      { id: 'HOSTAGE', label: 'Leaked', color: 'text-rose-400' },
                      { id: 'SLACK', label: 'Slack', color: 'text-amber-400' },
                      { id: 'FREE', label: 'Free', color: 'text-zinc-500' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFilterState(f.id)}
                        className={`px-1.5 py-0.5 rounded border text-[9px] ${
                          filterState === f.id ? 'bg-zinc-700 border-zinc-500 text-white font-bold' : 'border-zinc-800 bg-[#1c1c21] text-zinc-400'
                        }`}
                      >
                        <span className={f.color}>{f.label}</span>
                      </button>
                    ))}
                  </div>

                  {selectedSeqId && (
                    <button
                      onClick={() => setSelectedSeqId(null)}
                      className="text-rose-400 hover:underline"
                    >
                      Clear focus ({selectedSeqId})
                    </button>
                  )}
                </div>
              </div>

              {/* Matrix Cells */}
              <div className="flex-1 p-3 overflow-y-auto bg-[#09090b]">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(32px,1fr))] gap-1.5">
                  {filteredBlocks.map(block => {
                    const isSelected = selectedBlock?.block_id === block.block_id && selectedBlock?.node_id === block.node_id;
                    const isSeqActive = selectedSeqId && block.sequence_ids.includes(selectedSeqId);

                    let bg = 'bg-[#151518] text-zinc-600 border-[#27272a]';
                    if (block.state === 'HOSTAGE_ZOMBIE') bg = 'bg-rose-950/80 text-rose-300 border-rose-700';
                    else if (block.state === 'PREFIX_SHARED' || block.ref_count > 1) bg = 'bg-emerald-950/80 text-emerald-300 border-emerald-700';
                    else if (block.state === 'ACTIVE') {
                      if (block.slack_tokens > 8) bg = 'bg-amber-950/80 text-amber-300 border-amber-700';
                      else bg = 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
                    }

                    return (
                      <button
                        key={`${block.node_id}-${block.block_id}`}
                        onClick={() => setSelectedBlock(block)}
                        className={`aspect-square rounded border text-[9px] flex flex-col items-center justify-center relative transition-all hover:border-zinc-400 ${bg} ${
                          isSelected ? 'ring-2 ring-white z-10 font-bold' : ''
                        } ${isSeqActive ? 'ring-2 ring-cyan-400 font-bold' : ''}`}
                        title={`Block #${block.block_id} [${block.state}] - ${block.token_count}/${block.capacity} tokens`}
                      >
                        <span>{block.block_id}</span>
                        {block.ref_count > 1 && (
                          <span className="absolute -top-1 -right-1 text-[7px] bg-emerald-900 text-emerald-200 px-0.5 rounded font-bold border border-emerald-500">
                            {block.ref_count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Bar */}
              <div className="h-6 border-t border-[#27272a] bg-[#141417] px-2.5 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Showing {filteredBlocks.length} / {allBlocks.length} total blocks</span>
                <div className="flex items-center space-x-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-cyan-950 border border-cyan-800" /> Active</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-emerald-950 border border-emerald-700" /> Prefix Shared</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-rose-950 border border-rose-700" /> Leaked</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-amber-950 border border-amber-700" /> Tail Slack</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#16161a] border border-zinc-800" /> Free</span>
                </div>
              </div>
            </div>

            {/* Right: Hardware Block Inspector Pane */}
            <div className="w-80 border border-[#27272a] bg-[#121215] rounded flex flex-col overflow-hidden">
              <div className="h-8 border-b border-[#27272a] px-3 bg-[#151519] flex items-center justify-between text-[11px] font-bold text-zinc-200">
                <span>Block Telemetry Inspector</span>
                {selectedBlock && <span className="text-zinc-500 font-normal">#{selectedBlock.block_id}</span>}
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {!selectedBlock ? (
                  <div className="text-zinc-500 py-12 text-center text-[10px]">
                    Select any block in the pool matrix to inspect physical memory mapping and token slots.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 pb-2 border-b border-zinc-800 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Physical Address:</span>
                        <span className="text-zinc-200 font-mono">0x{((selectedBlock.physical_id || selectedBlock.block_id) * 320).toString(16).toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Node Instance:</span>
                        <span className="text-cyan-300 font-bold">{nodes[selectedBlock.node_id]?.name || selectedBlock.node_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">State:</span>
                        <span className="font-bold text-zinc-100">{selectedBlock.state}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Capacity / Fill:</span>
                        <span className="text-zinc-200">{selectedBlock.token_count} / {selectedBlock.capacity} tokens ({selectedBlock.slack_tokens} slack)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Reference Count:</span>
                        <span className="text-emerald-400 font-bold">{selectedBlock.ref_count}</span>
                      </div>
                    </div>

                    {/* 16-slot token array */}
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Token Slots (16-token Page):</span>
                        <span>{selectedBlock.token_count} active</span>
                      </div>
                      <div className="grid grid-cols-8 gap-1 p-1.5 rounded bg-[#09090b] border border-zinc-800">
                        {Array.from({ length: 16 }).map((_, idx) => {
                          const isFilled = idx < selectedBlock.token_count;
                          return (
                            <div
                              key={idx}
                              className={`h-4 rounded-xs flex items-center justify-center text-[7px] border ${
                                isFilled
                                  ? selectedBlock.state === 'HOSTAGE_ZOMBIE'
                                    ? 'bg-rose-950 border-rose-700 text-rose-200'
                                    : selectedBlock.state === 'PREFIX_SHARED'
                                    ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
                                    : 'bg-cyan-950 border-cyan-700 text-cyan-200'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-700'
                              }`}
                            >
                              {idx}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Owning Sequences */}
                    <div>
                      <span className="text-zinc-500 text-[10px] block mb-1">Mapped Sequences:</span>
                      {selectedBlock.sequence_ids.length > 0 ? (
                        <div className="space-y-1">
                          {selectedBlock.sequence_ids.map(sid => (
                            <button
                              key={sid}
                              onClick={() => {
                                setSelectedSeqId(sid);
                                setActiveTab('page_tables');
                              }}
                              className="w-full text-left p-1.5 rounded bg-[#18181d] border border-zinc-800 hover:border-zinc-700 text-cyan-300 flex items-center justify-between"
                            >
                              <span>{sid}</span>
                              <span className="text-zinc-500 text-[9px]">view in table &rarr;</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-600 italic text-[10px]">Unassigned (In Free Queue)</span>
                      )}
                    </div>

                    {/* Stored Token Preview */}
                    {selectedBlock.tokens_preview && (
                      <div>
                        <span className="text-zinc-500 text-[10px] block mb-1">Tokens Preview:</span>
                        <div className="p-2 rounded bg-[#09090b] border border-zinc-800 text-zinc-300 text-[10px] break-all select-all font-mono">
                          "{selectedBlock.tokens_preview}"
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LOGICAL PAGE TABLES (High-Density Structured Table) */}
        {activeTab === 'page_tables' && (
          <div className="flex-1 border border-[#27272a] bg-[#121215] rounded flex flex-col overflow-hidden">
            <div className="h-8 border-b border-[#27272a] px-3 bg-[#151519] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Showing {seqList.length} sequences</span>
              <span>Click sequence row to filter block matrix</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#27272a] bg-[#151519] text-zinc-400 text-[10px] sticky top-0">
                    <th className="py-1.5 px-3">SEQUENCE ID</th>
                    <th className="py-1.5 px-3">CLIENT</th>
                    <th className="py-1.5 px-3">NODE</th>
                    <th className="py-1.5 px-3">STATUS</th>
                    <th className="py-1.5 px-3">TOKENS (P+G/MAX)</th>
                    <th className="py-1.5 px-3">VIRTUAL &rarr; PHYSICAL BLOCKS</th>
                    <th className="py-1.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202025]">
                  {seqList.map(seq => {
                    const isSelected = selectedSeqId === seq.seq_id;
                    const totalTokens = seq.prompt_tokens + seq.generated_tokens;
                    const totalAlloc = seq.logical_blocks.length * 16;
                    const slack = Math.max(0, totalAlloc - totalTokens);

                    return (
                      <tr 
                        key={seq.seq_id}
                        onClick={() => setSelectedSeqId(isSelected ? null : seq.seq_id)}
                        className={`hover:bg-[#18181d] cursor-pointer transition-colors ${
                          seq.is_hostage ? 'bg-rose-950/20' : isSelected ? 'bg-zinc-800/80' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-bold text-cyan-300">{seq.seq_id}</td>
                        <td className="py-2 px-3 text-zinc-400">{seq.client_id}</td>
                        <td className="py-2 px-3 text-zinc-300">{seq.node_id.replace('node_', '')}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                            seq.is_hostage ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                            seq.status === 'DECODING' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                            seq.status === 'PREFILL' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {seq.is_hostage ? 'LEAKED' : seq.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center space-x-2">
                            <span>{seq.prompt_tokens}p + {seq.generated_tokens}g / {seq.max_tokens}</span>
                            {slack > 0 && <span className="text-amber-400 text-[9px]">({slack} slack)</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {seq.logical_blocks.map((bid, idx) => (
                              <span
                                key={idx}
                                className={`px-1 rounded text-[9px] border ${
                                  seq.is_hostage ? 'bg-rose-950 border-rose-800 text-rose-300' :
                                  idx < seq.prefix_shared_blocks ? 'bg-emerald-950 border-emerald-800 text-emerald-300' :
                                  'bg-zinc-900 border-zinc-700 text-zinc-300'
                                }`}
                              >
                                L{idx}:#{bid}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {seq.is_hostage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReclaimSeq(seq.seq_id);
                              }}
                              className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 text-[9px]"
                            >
                              Reclaim
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CLUSTER TOPOLOGY & BUS */}
        {activeTab === 'topology' && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 overflow-y-auto">
            {Object.values(nodes).map(node => (
              <div key={node.node_id} className="border border-[#27272a] bg-[#121215] rounded p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <span className="font-bold text-zinc-100">{node.name}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{node.role}</span>
                  </div>

                  <div className="mt-3 space-y-2 text-[10px]">
                    <div>
                      <div className="flex justify-between text-zinc-400 mb-1">
                        <span>Memory Utilization</span>
                        <span className="font-bold text-zinc-100">{node.memory_pressure_pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${node.memory_pressure_pct}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-1.5 rounded bg-[#18181d] border border-zinc-800">
                        <span className="text-zinc-500 block">Allocated / Free:</span>
                        <span className="font-bold text-zinc-200">{node.allocated_blocks_count} / {node.free_blocks_count}</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#18181d] border border-zinc-800">
                        <span className="text-zinc-500 block">Prefix Shared:</span>
                        <span className="font-bold text-emerald-400">{node.shared_blocks_count} blks</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#18181d] border border-zinc-800">
                        <span className="text-zinc-500 block">Slack Space:</span>
                        <span className="font-bold text-amber-400">{node.internal_fragmentation_pct}%</span>
                      </div>
                      <div className="p-1.5 rounded bg-[#18181d] border border-zinc-800">
                        <span className="text-zinc-500 block">Hostage Leaks:</span>
                        <span className={`font-bold ${node.hostage_blocks_count > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                          {node.hostage_blocks_count} blks
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-zinc-800 flex justify-between items-center">
                  <span className="text-zinc-500 text-[10px]">{node.active_sequence_ids.length} active requests</span>
                  <button
                    onClick={() => handleDefrag(node.node_id)}
                    className="px-2 py-1 rounded bg-[#1c1c21] border border-zinc-700 hover:bg-zinc-700 text-zinc-300 text-[10px]"
                  >
                    Defragment Node
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: MEMORY LEAKS & STATE DIVERGENCE */}
        {activeTab === 'leaks' && (
          <div className="flex-1 border border-[#27272a] bg-[#121215] rounded flex flex-col overflow-hidden">
            <div className="h-8 border-b border-[#27272a] px-3 bg-[#151519] flex items-center justify-between text-[10px] text-zinc-400">
              <span>{diagnostics?.hostage_sequences.length ?? 0} active memory leaks detected</span>
              {diagnostics && diagnostics.hostage_sequences.length > 0 && (
                <button
                  onClick={handleReclaimAll}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-500"
                >
                  Reclaim All ({diagnostics.total_hostage_blocks} blocks)
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(!diagnostics || diagnostics.hostage_sequences.length === 0) ? (
                <div className="text-center py-16 text-zinc-500 text-xs">
                  Zero memory leaks detected. All logical block tables are synchronized with frontend ASGI client connections.
                </div>
              ) : (
                diagnostics.hostage_sequences.map(h => (
                  <div key={h.sequence_id} className="p-2.5 rounded bg-[#16161b] border border-rose-900/60 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-rose-300">{h.sequence_id}</span>
                        <span className="text-zinc-500">[{h.client_id}]</span>
                        <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 font-bold border border-rose-900 text-[9px]">
                          {h.hostage_block_ids.length} blocks ({h.wasted_memory_kb} KB)
                        </span>
                        <span className="text-zinc-400 text-[10px]">idle: {h.idle_duration_sec}s</span>
                      </div>
                      <div className="text-zinc-400 text-[10px]">
                        <span className="text-zinc-600">Root Cause:</span> {h.reason}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {h.hostage_block_ids.map(bid => (
                          <span key={bid} className="px-1 rounded bg-rose-950 border border-rose-900 text-rose-400 text-[8px]">
                            #{bid}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleReclaimSeq(h.sequence_id)}
                      className="px-3 py-1 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 border border-rose-700 text-[10px] font-bold"
                    >
                      Reclaim
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: EVENT STREAM */}
        {activeTab === 'events' && (
          <div className="flex-1 border border-[#27272a] bg-[#121215] rounded flex flex-col overflow-hidden">
            <div className="h-8 border-b border-[#27272a] px-3 bg-[#151519] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Engine telemetry event buffer</span>
              <span>{events.length} events logged</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
              {events.map((evt, idx) => (
                <div key={idx} className="flex items-start space-x-2 py-0.5 px-1 rounded hover:bg-[#18181d]">
                  <span className="text-zinc-600 whitespace-nowrap">{new Date(evt.timestamp * 1000).toLocaleTimeString()}</span>
                  <span className="px-1 rounded bg-zinc-800 text-zinc-300 text-[8px] uppercase">{evt.category}</span>
                  <span className={`flex-1 ${evt.level === 'error' ? 'text-rose-400 font-bold' : evt.level === 'warn' ? 'text-amber-400' : 'text-zinc-300'}`}>
                    {evt.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
