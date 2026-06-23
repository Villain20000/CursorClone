'use client';

import { useEditorStore } from '@/store/useEditorStore';
import { Sparkles, Check, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIReview() {
  const { activeFileId, files } = useEditorStore();
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviews, setReviews] = useState<{ line: number; message: string }[]>([]);

  const handleReview = () => {
    setIsReviewing(true);
    // Simulate AI analysis
    setTimeout(() => {
      setReviews([
        { line: 2, message: "Consider using a more descriptive variable name here." },
        { line: 5, message: "Potential performance bottleneck: nested loop detected." }
      ]);
      setIsReviewing(false);
    }, 2000);
  };

  if (!activeFileId) return null;

  return (
    <div className="absolute top-4 right-4 z-10">
      <button
        onClick={handleReview}
        disabled={isReviewing}
        className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white px-3 py-1.5 rounded-md text-xs font-medium border border-[#3c3c3c] shadow-lg transition-colors"
      >
        <Sparkles size={14} className="text-purple-400" />
        {isReviewing ? 'Analyzing...' : 'AI Review'}
      </button>

      <AnimatePresence>
        {reviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 w-64 bg-[#252526] border border-purple-500/30 rounded-lg shadow-2xl p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase text-[#858585]">AI Suggestions</span>
              <button onClick={() => setReviews([])} className="text-[#858585] hover:text-white">
                <X size={12} />
              </button>
            </div>
            <div className="space-y-3">
              {reviews.map((rev, i) => (
                <div key={i} className="text-xs border-l-2 border-purple-500 pl-2 py-1">
                  <div className="text-[10px] text-purple-400 mb-0.5">Line {rev.line}</div>
                  <div className="text-[#d4d4d4] leading-relaxed">{rev.message}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
