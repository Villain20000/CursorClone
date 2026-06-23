'use client';

import { useEditorStore } from '@/store/useEditorStore';
import { cn } from '@/lib/utils';
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function Sidebar() {
  const { files, openFile } = useEditorStore();
  const rootFolder = files['root'];

  return (
    <div className="w-64 h-full bg-[#1e1e1e] border-r border-[#333] flex flex-col text-[#cccccc] select-none">
      <div className="p-3 text-xs font-semibold uppercase tracking-wider text-[#858585]">
        Explorer
      </div>
      <div className="flex-1 overflow-y-auto">
        {rootFolder?.children?.map((childId) => (
          <FileItem key={childId} id={childId} depth={0} />
        ))}
      </div>
    </div>
  );
}

function FileItem({ id, depth }: { id: string; depth: number }) {
  const { files, openFile, activeFileId } = useEditorStore();
  const [isOpen, setIsOpen] = useState(true);
  const file = files[id];

  if (!file) return null;

  const isFolder = file.type === 'folder';
  const isActive = activeFileId === id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-1 px-2 cursor-pointer hover:bg-[#2a2d2e] text-sm",
          isActive && "bg-[#37373d] text-white"
        )}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        onClick={() => {
          if (isFolder) {
            setIsOpen(!isOpen);
          } else {
            openFile(id);
          }
        }}
      >
        <span className="mr-1.5">
          {isFolder ? (
            isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <File size={16} className="text-[#858585]" />
          )}
        </span>
        <span className="truncate">{file.name}</span>
      </div>
      {isFolder && isOpen && file.children?.map((childId) => (
        <FileItem key={childId} id={childId} depth={depth + 1} />
      ))}
    </div>
  );
}
