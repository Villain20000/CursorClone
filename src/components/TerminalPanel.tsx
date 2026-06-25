'use client';

import { Terminal as TerminalIcon, Sparkles, Play, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function TerminalPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(['$ npm run dev', 'Server started on http://localhost:3000']);
  const [aiSuggestion, setAiSuggestion] = useState('npm install lucide-react');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const getAiSuggestion = async () => {
    setIsSuggesting(true);
    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'help me set up the project', context: '' }),
      });
      const data = await response.json();
      setAiSuggestion(data.suggestion);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSuggesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-48 bg-[#1e1e1e] border-t border-[#333] flex flex-col text-[#cccccc] font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#252526] border-b border-[#333]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-b border-white pb-0.5">
            <TerminalIcon size={14} />
            Terminal
          </div>
          <div className="flex items-center gap-2 text-[#858585] hover:text-white cursor-pointer transition-colors">
            <Sparkles size={14} className="text-purple-400" />
            AI Command
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-[#858585] hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-green-500">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newHistory = [...history, `$ ${input}`];
                if (input.includes('error') || input.includes('fail')) {
                  newHistory.push('Error: Command failed with exit code 1');
                  setLastError('Command failed with exit code 1');
                } else {
                  setLastError(null);
                }
                setHistory(newHistory);
                setInput('');
              }
            }}
          />
        </div>
      </div>

      {/* AI Suggestion Bar */}
      <div className="p-2 bg-[#252526] border-t border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[#858585]">
          <Sparkles size={12} className="text-purple-400" />
          Suggested: <span className="text-white italic">{isSuggesting ? 'Thinking...' : aiSuggestion}</span>
        </div>
        <div className="flex gap-2">
          {lastError && (
            <button
              onClick={getAiSuggestion}
              className="flex items-center gap-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-200 px-2 py-1 rounded text-xs transition-colors border border-red-500/30"
            >
              <Sparkles size={10} />
              Fix with AI
            </button>
          )}
          <button
            onClick={getAiSuggestion}
            className="text-[10px] text-[#858585] hover:text-white transition-colors"
          >
            Refresh Suggestion
          </button>
          <button
            onClick={() => {
              setHistory([...history, `$ ${aiSuggestion}`]);
              setAiSuggestion('');
            }}
            className="flex items-center gap-1.5 bg-[#333] hover:bg-[#444] px-2 py-1 rounded text-xs transition-colors"
          >
            <Play size={10} />
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
