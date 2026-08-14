import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { BlockPoolHeatmap } from './components/BlockPoolHeatmap';
import { LogicalTableViewer } from './components/LogicalTableViewer';
import { DisaggregatedTopology } from './components/DisaggregatedTopology';
import { HostageLeakHunter } from './components/HostageLeakHunter';
import { ScenarioControls } from './components/ScenarioControls';
import { LiveEventLog } from './components/LiveEventLog';
import type { SystemStateSnapshot } from './types';

export function App() {
  const [snapshot, setSnapshot] = useState<SystemStateSnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);
  const [selectedSeqId, setSelectedSeqId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Determine API and WebSocket Base URLs
  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    if (host.includes('5173')) {
      return 'ws://localhost:8000/ws/stream';
    }
    return `${protocol}//${host}/ws/stream`;
  };

  const getApiUrl = (endpoint: string) => {
    if (window.location.host.includes('5173')) {
      return `http://localhost:8000${endpoint}`;
    }
    return endpoint;
  };

  // WebSocket Connection
  useEffect(() => {
    let reconnectTimeout: any;

    const connectWs = () => {
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data: SystemStateSnapshot = JSON.parse(event.data);
            setSnapshot(data);
          } catch (e) {
            console.error("Failed to parse websocket message:", e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 1500);
        };

        ws.onerror = () => {
          ws.close();
        };
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

  // REST API Handlers
  const handleTogglePlay = async () => {
    if (!snapshot) return;
    const newRunning = !snapshot.is_running;
    await fetch(getApiUrl('/api/simulation/control'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ running: newRunning })
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
    await fetch(getApiUrl('/api/simulation/reset'), {
      method: 'POST'
    });
    setSelectedSeqId(null);
  };

  const handleSelectScenario = async (scenario: string) => {
    await fetch(getApiUrl('/api/scenarios/set'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario })
    });
  };

  const handleSubmitCustomSeq = async (prompt: string, maxTokens: number) => {
    await fetch(getApiUrl('/api/sequence/submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, max_tokens: maxTokens })
    });
  };

  const handleInjectLeak = async () => {
    try {
      await fetch(getApiUrl('/api/chaos/inject_leak'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: "CLIENT_WS_CONNECTION_RESET" })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleReclaimSeq = async (sequenceId: string) => {
    await fetch(getApiUrl('/api/diagnostics/reclaim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId })
    });
    if (selectedSeqId === sequenceId) {
      setSelectedSeqId(null);
    }
  };

  const handleReclaimAll = async () => {
    await fetch(getApiUrl('/api/diagnostics/reclaim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });
  };

  const handleDefragNode = async (nodeId: string) => {
    await fetch(getApiUrl('/api/diagnostics/defragment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: nodeId })
    });
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <Header
        state={snapshot}
        isConnected={isConnected}
        onTogglePlay={handleTogglePlay}
        onSpeedChange={handleSpeedChange}
        currentSpeed={currentSpeed}
        onReset={handleReset}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 p-6 max-w-[1720px] mx-auto w-full space-y-6">
        {/* Top Metric Cards */}
        <MetricCards
          metrics={snapshot?.metrics ?? null}
          diagnostics={snapshot?.diagnostics ?? null}
        />

        {/* Middle Row: Disaggregated Topology & Hostage Hunter */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7">
            <DisaggregatedTopology
              nodes={snapshot?.nodes ?? {}}
              onDefragNode={handleDefragNode}
              selectedSeqId={selectedSeqId}
              onSelectSeqId={setSelectedSeqId}
            />
          </div>
          <div className="xl:col-span-5">
            <HostageLeakHunter
              diagnostics={snapshot?.diagnostics ?? null}
              onReclaimSeq={handleReclaimSeq}
              onReclaimAll={handleReclaimAll}
              onSelectSeqId={setSelectedSeqId}
            />
          </div>
        </div>

        {/* Primary Core: Physical Block Heatmap Matrix + Logical Table Viewer */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: 2D Block Heatmap Matrix */}
          <div className="xl:col-span-7">
            <BlockPoolHeatmap
              blocksByNode={snapshot?.blocks_by_node ?? {}}
              nodes={snapshot?.nodes ?? {}}
              selectedSeqId={selectedSeqId}
              onSelectSeqId={setSelectedSeqId}
            />
          </div>

          {/* Right: Sequence-Centric Logical Block Tables */}
          <div className="xl:col-span-5">
            <LogicalTableViewer
              sequences={snapshot?.sequences ?? {}}
              blocksByNode={snapshot?.blocks_by_node ?? {}}
              selectedSeqId={selectedSeqId}
              onSelectSeqId={setSelectedSeqId}
            />
          </div>
        </div>

        {/* Bottom Row: Workload Scenarios & Live Event Log */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7">
            <ScenarioControls
              currentScenario={snapshot?.scenario ?? 'normal_traffic'}
              onSelectScenario={handleSelectScenario}
              onSubmitCustomSeq={handleSubmitCustomSeq}
              onInjectLeak={handleInjectLeak}
            />
          </div>
          <div className="xl:col-span-5">
            <LiveEventLog
              events={snapshot?.recent_events ?? []}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-dark-900/60 py-3 px-6 text-center text-xs font-mono text-slate-500">
        KVCacheScope &bull; PagedAttention Logical VRAM Profiler & Disaggregated Inference Inspector &bull; vLLM / SGLang Architecture
      </footer>
    </div>
  );
}

export default App;
