'use client';

import { useEditorStore } from '@/store/useEditorStore';
import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InlineChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { activeFileId } = useEditorStore();
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen || !activeFileId) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/10">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg bg-[#252526] border border-purple-500/50 rounded-lg shadow-2xl overflow-hidden p-3"
      >
        <div className="flex items-center gap-3 bg-[#2d2d2d] rounded px-3 py-2 border border-[#3c3c3c] focus-within:ring-1 focus-within:ring-purple-500">
          <Sparkles size={16} className="text-purple-400" />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Edit with AI (Cmd + K)"
            className="flex-1 bg-transparent text-sm text-white outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Logic to apply edit would go here
                setIsOpen(false);
                setInput('');
              }
            }}
          />
          <button onClick={() => setIsOpen(false)} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="text-[10px] text-[#858585]">
            AI will modify the selected block
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] bg-[#333] px-1.5 py-0.5 rounded text-[#858585]">Enter to apply</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
