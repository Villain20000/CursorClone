'use client';

import { Files, Search as SearchIcon, Code2, MessageSquare, Terminal, UserCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ActivityBar() {
  const items = [
    { icon: Files, label: 'Explorer', active: true },
    { icon: SearchIcon, label: 'Search' },
    { icon: Code2, label: 'Source Control' },
    { icon: MessageSquare, label: 'AI Chat' },
    { icon: Terminal, label: 'Terminal' },
  ];

  return (
    <div className="w-12 h-full bg-[#333333] flex flex-col items-center py-4 gap-4 border-r border-[#1e1e1e]">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "p-2 cursor-pointer transition-colors relative group",
            item.active ? "text-white" : "text-[#858585] hover:text-white"
          )}
        >
          <item.icon size={24} strokeWidth={1.5} />
          {item.active && (
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white" />
          )}
        </div>
      ))}
      <div className="mt-auto flex flex-col items-center gap-4">
        <UserCircle size={24} className="text-[#858585] hover:text-white cursor-pointer" strokeWidth={1.5} />
        <Settings size={24} className="text-[#858585] hover:text-white cursor-pointer" strokeWidth={1.5} />
      </div>
    </div>
  );
}
