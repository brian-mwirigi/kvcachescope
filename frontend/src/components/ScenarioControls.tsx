import React, { useState } from 'react';
import { Sparkles, AlertOctagon, Send, Zap, Flame, RefreshCw, Layers, ShieldAlert } from 'lucide-react';

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
      name: 'Prefix Caching Demo',
      desc: 'Shared enterprise system prompts with Radix tree deduplication',
      icon: Sparkles,
      color: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/20'
    },
    {
      id: 'hostage_leak_demo',
      name: 'Hostage Zombie Leaks',
      desc: 'Ungraceful client WebSocket drops holding block tables hostage',
      icon: ShieldAlert,
      color: 'border-rose-500/40 text-rose-400 hover:bg-rose-950/20'
    },
    {
      id: 'disaggregated_stranding',
      name: 'Disaggregated KV Burst',
      desc: 'Heavy prompt prefill burst with RDMA migration to decode nodes',
      icon: Zap,
      color: 'border-cyan-500/40 text-cyan-400 hover:bg-cyan-950/20'
    },
    {
      id: 'slack_waste_saturation',
      name: 'Tail Slack Waste',
      desc: 'Burst of short 1-token responses maximizing internal block slack',
      icon: Layers,
      color: 'border-amber-500/40 text-amber-400 hover:bg-amber-950/20'
    },
    {
      id: 'normal_traffic',
      name: 'Normal Mixed Traffic',
      desc: 'Continuous dynamic inference with stochastic arrivals',
      icon: RefreshCw,
      color: 'border-blue-500/40 text-blue-400 hover:bg-blue-950/20'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    onSubmitCustomSeq(customPrompt, maxTokens);
    setCustomPrompt('');
  };

  return (
    <div className="cyber-card p-5">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center space-x-2">
          <Flame className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-slate-100">
            Workload Scenarios & Chaos Injection Lab
          </h2>
        </div>

        {/* Quick Chaos Button */}
        <button
          onClick={onInjectLeak}
          className="px-3.5 py-1.5 rounded-lg bg-rose-950/80 border border-rose-700/80 hover:bg-rose-900 text-rose-300 text-xs font-mono font-bold flex items-center space-x-2 transition-all transform hover:scale-105"
        >
          <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />
          <span>💥 Inject Hostage Sequence Leak</span>
        </button>
      </div>

      {/* Scenario Buttons Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isActive = currentScenario === sc.id;

          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                isActive 
                  ? 'bg-slate-800/90 border-cyan-400 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400' 
                  : `bg-dark-900/60 ${sc.color}`
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className="w-4 h-4" />
                {isActive && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                    ACTIVE
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold font-mono text-slate-200">{sc.name}</h4>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{sc.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Sequence Submission */}
      <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap gap-2.5 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            Submit Custom Prompt to PagedAttention Engine:
          </label>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. System prompt: Generate a CUDA kernel for flash attention..."
            className="w-full px-3 py-1.5 rounded-lg bg-dark-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="w-32">
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            Max Tokens: {maxTokens}
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
          className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors h-[34px]"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Submit Request</span>
        </button>
      </form>
    </div>
  );
};
