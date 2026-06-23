'use client';

import { cn } from '@/lib/utils';

interface DiffViewProps {
  oldCode: string;
  newCode: string;
}

export default function DiffView({ oldCode, newCode }: DiffViewProps) {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');

  return (
    <div className="flex flex-col font-mono text-xs overflow-auto max-h-[300px] border border-[#333] rounded bg-[#1e1e1e]">
      <div className="flex border-b border-[#333] bg-[#252526] p-1 px-2 text-[#858585]">
        Diff View
      </div>
      <div className="flex flex-col p-2">
        {oldLines.map((line, i) => (
          <div key={`old-${i}`} className="flex bg-red-900/20 text-red-300 px-2 border-l-2 border-red-500">
            <span className="w-6 opacity-50 select-none">-</span>
            <span className="whitespace-pre">{line || ' '}</span>
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`new-${i}`} className="flex bg-green-900/20 text-green-300 px-2 border-l-2 border-green-500">
            <span className="w-6 opacity-50 select-none">+</span>
            <span className="whitespace-pre">{line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
