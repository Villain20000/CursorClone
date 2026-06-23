'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { Search, FileCode, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuickOpen() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { files, openFile } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredFiles = Object.values(files)
    .filter(f => f.type === 'file' && f.name.toLowerCase().includes(query.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/40 backdrop-blur-[1px]">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-xl bg-[#252526] border border-[#333] rounded-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center p-3 gap-3 border-b border-[#333]">
          <Search size={18} className="text-[#858585]" />
          <input
            autoFocus
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-white outline-none text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredFiles.length > 0) {
                openFile(filteredFiles[0].id);
                setIsOpen(false);
              }
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {filteredFiles.map(file => (
            <div
              key={file.id}
              onClick={() => {
                openFile(file.id);
                setIsOpen(false);
              }}
              className="flex items-center gap-3 p-2 hover:bg-[#2a2d2e] rounded cursor-pointer transition-colors"
            >
              <FileCode size={16} className="text-[#858585]" />
              <div className="flex flex-col">
                <span className="text-sm text-white">{file.name}</span>
                <span className="text-[10px] text-[#858585]">{file.parentId === 'root' ? '/' : file.parentId}</span>
              </div>
            </div>
          ))}
          {filteredFiles.length === 0 && (
            <div className="p-8 text-center text-sm text-[#858585]">No files found</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
