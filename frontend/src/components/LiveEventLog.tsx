import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import type { EventLog } from '../types';

interface LiveEventLogProps {
  events: EventLog[];
}

export const LiveEventLog: React.FC<LiveEventLogProps> = ({ events }) => {
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const filteredEvents = events.filter(e => {
    if (filterLevel === 'ALL') return true;
    return e.level === filterLevel.toLowerCase();
  });

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'error': return 'text-rose-400 font-semibold';
      case 'warn': return 'text-amber-400 font-medium';
      default: return 'text-zinc-300';
    }
  };

  const getCategoryBadge = (cat: string) => {
    if (cat.includes('HOSTAGE') || cat.includes('LEAK')) {
      return 'bg-rose-950 text-rose-300 border-rose-900';
    }
    if (cat.includes('REMEDIATION') || cat.includes('COMPLETED')) {
      return 'bg-emerald-950 text-emerald-300 border-emerald-900';
    }
    if (cat.includes('MIGRATION') || cat.includes('TRANSFER')) {
      return 'bg-blue-950 text-blue-300 border-blue-900';
    }
    return 'bg-zinc-900 text-zinc-400 border-zinc-800';
  };

  return (
    <div className="cyber-card p-4 font-mono">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-sm font-bold text-zinc-100">
            Engine Event Stream
          </h2>
        </div>

        <div className="flex items-center space-x-1 text-[10px]">
          {['ALL', 'INFO', 'WARN', 'ERROR'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-1.5 py-0.5 rounded border transition-colors ${
                filterLevel === lvl 
                  ? 'bg-zinc-700 border-zinc-600 text-white font-bold' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 space-y-1 max-h-48 overflow-y-auto pr-1 text-xs">
        {filteredEvents.length === 0 ? (
          <div className="text-zinc-600 text-[11px] py-4 text-center">
            No events logged yet.
          </div>
        ) : (
          filteredEvents.map((evt, idx) => {
            const timeStr = new Date(evt.timestamp * 1000).toLocaleTimeString();

            return (
              <div
                key={`${evt.timestamp}-${idx}`}
                className="flex items-start space-x-2 py-1 px-1 rounded hover:bg-zinc-900/60 transition-colors border-b border-zinc-900"
              >
                <span className="text-zinc-600 text-[10px] whitespace-nowrap pt-0.2">
                  {timeStr}
                </span>
                <span className={`text-[8px] uppercase px-1 py-0.2 rounded border font-semibold ${getCategoryBadge(evt.category)}`}>
                  {evt.category}
                </span>
                <span className={`text-[11px] flex-1 ${getLevelStyle(evt.level)}`}>
                  {evt.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
