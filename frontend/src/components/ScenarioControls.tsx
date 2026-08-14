import React, { useState } from 'react';
import { Send, Cpu, Zap, Activity } from 'lucide-react';

interface ScenarioControlsProps {
  currentScenario: string;
  onSelectScenario: (scenario: string) => void;
  onSubmitCustomSeq: (prompt: string, maxTokens: number) => void;
  onInjectLeak: () => void;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  currentScenario,
  onSelectScenario,
  onSubmitCustomSeq,
  onInjectLeak
}) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [maxTokens, setMaxTokens] = useState(48);

  const scenarios = [
    {
      id: 'prefix_caching_demo',
      name: 'Prefix Caching Radix',
      desc: 'Shared system prompt chunking with Radix tree deduplication'
    },
    {
      id: 'hostage_leak_demo',
      name: 'Client Abort Divergence',
      desc: 'CancelledError client drops leaving unreleased block tables'
    },
    {
      id: 'disaggregated_stranding',
      name: 'Disaggregated KV Flood',
      desc: 'Heavy prompt prefill burst with RDMA migration to decode nodes'
    },
    {
      id: 'slack_waste_saturation',
      name: 'Tail Slack Saturation',
      desc: 'Short 1-token output sequences maximizing internal block slack'
    },
    {
      id: 'normal_traffic',
      name: 'Continuous Batching',
      desc: 'Standard dynamic inference traffic with stochastic arrivals'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    onSubmitCustomSeq(customPrompt, maxTokens);
    setCustomPrompt('');
  };

  return (
    <div className="cyber-card p-4 font-mono">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-zinc-800 gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-zinc-100">
            Workload Generator & Benchmark Scenarios
          </h2>
        </div>

        {/* Quick Abort Trigger */}
        <button
          onClick={onInjectLeak}
          className="px-2.5 py-1 rounded bg-rose-950 border border-rose-800 hover:bg-rose-900 text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-rose-400" />
          <span>Trigger Client Abort (CancelledError)</span>
        </button>
      </div>

      {/* Scenario Buttons Grid */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {scenarios.map((sc) => {
          const isActive = currentScenario === sc.id;

          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`p-2.5 rounded border text-left transition-all flex flex-col justify-between ${
                isActive 
                  ? 'bg-zinc-800 border-cyan-500 ring-1 ring-cyan-500' 
                  : 'bg-[#121215] border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase">Scenario</span>
                {isActive && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold">
                    ACTIVE
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200">{sc.name}</h4>
                <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{sc.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Sequence Submission */}
      <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[11px] text-zinc-400 mb-1">
            Inject Custom Request to Engine:
          </label>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. You are a code generator. Write a CUDA kernel for flash attention..."
            className="w-full px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="w-28">
          <label className="block text-[11px] text-zinc-400 mb-1">
            Max: {maxTokens} tok
          </label>
          <input
            type="range"
            min="8"
            max="128"
            step="8"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        <button
          type="submit"
          className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center space-x-1 transition-colors h-[28px]"
        >
          <Send className="w-3 h-3 text-cyan-400" />
          <span>Submit</span>
        </button>
      </form>
    </div>
  );
};
