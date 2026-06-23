'use client';

import { useEditorStore } from '@/store/useEditorStore';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export default function TabBar() {
  const { openFileIds, activeFileId, files, openFile, closeFile } = useEditorStore();

  if (openFileIds.length === 0) return null;

  return (
    <div className="flex bg-[#252526] overflow-x-auto no-scrollbar border-b border-[#1e1e1e]">
      {openFileIds.map((id) => {
        const file = files[id];
        if (!file) return null;
        const isActive = activeFileId === id;

        return (
          <div
            key={id}
            className={cn(
              "group flex items-center min-w-[120px] max-w-[200px] px-3 py-2 cursor-pointer border-r border-[#1e1e1e] text-sm transition-colors",
              isActive ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#858585] hover:bg-[#2a2d2e]"
            )}
            onClick={() => openFile(id)}
          >
            <span className="truncate flex-1">{file.name}</span>
            <button
              className={cn(
                "ml-2 p-0.5 rounded-sm hover:bg-[#454545] opacity-0 group-hover:opacity-100 transition-opacity",
                isActive && "opacity-100"
              )}
              onClick={(e) => {
                e.stopPropagation();
                closeFile(id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
