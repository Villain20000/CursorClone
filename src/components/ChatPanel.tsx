'use client';

import { useChat } from '@ai-sdk/react';
import { useEditorStore } from '@/store/useEditorStore';
import { useCodebaseContext } from '@/hooks/useCodebaseContext';
import { useCollaborationStore } from '@/store/useCollaborationStore';
import { Send, X, Bot, User, Sparkles, Paperclip, AtSign, BookMarked } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useEffect, useState } from 'react';

export default function ChatPanel() {
  const { getFullContext } = useCodebaseContext();
  const { sharedPrompts } = useCollaborationStore();
  const [showSharedPrompts, setShowSharedPrompts] = useState(false);
  // @ts-ignore
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [
      { id: 'welcome', role: 'assistant', content: 'How can I help you with your code today?' }
    ],
    body: {
      context: getFullContext()
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="w-80 h-full bg-[#1e1e1e] border-l border-[#333] flex flex-col text-[#cccccc]">
      <div className="p-3 border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} className="text-purple-400" />
          AI CHAT
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={cn(
            "flex flex-col gap-1",
            m.role === 'user' ? "items-end" : "items-start"
          )}>
            <div className="flex items-center gap-1.5 text-[10px] text-[#858585] mb-1 uppercase font-bold tracking-tight">
              {m.role === 'user' ? <User size={10} /> : <Bot size={10} />}
              {m.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className={cn(
              "max-w-[90%] rounded-lg p-2.5 text-sm leading-relaxed",
              m.role === 'user'
                ? "bg-[#2d2d2d] text-white"
                : "bg-[#252526] border border-[#333] text-[#d4d4d4]"
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[#858585] animate-pulse">
            <Bot size={14} />
            AI is thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[#333]">
        <div className="relative bg-[#2d2d2d] rounded-md border border-[#3c3c3c] focus-within:ring-1 focus-within:ring-purple-500 overflow-hidden">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything... (@ to mention)"
            className="w-full bg-transparent text-sm text-white pl-3 pr-10 pt-2.5 pb-10 focus:outline-none resize-none"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          {showSharedPrompts && (
            <div className="absolute bottom-24 left-2 right-2 bg-[#252526] border border-[#333] rounded shadow-2xl z-50 p-1">
              <div className="text-[10px] font-bold text-[#858585] px-2 py-1 uppercase">Shared Team Prompts</div>
              {sharedPrompts.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    handleInputChange({ target: { value: p.content } } as any);
                    setShowSharedPrompts(false);
                  }}
                  className="p-2 hover:bg-[#2a2d2e] rounded cursor-pointer text-xs flex flex-col"
                >
                  <span className="text-white font-medium">{p.name}</span>
                  <span className="text-[10px] text-[#858585]">by {p.author}</span>
                </div>
              ))}
            </div>
          )}
          <div className="absolute left-2 bottom-2 flex items-center gap-1">
            <button type="button" className="p-1.5 text-[#858585] hover:text-white transition-colors">
              <Paperclip size={14} />
            </button>
            <button type="button" className="p-1.5 text-[#858585] hover:text-white transition-colors">
              <AtSign size={14} />
            </button>
            <button
              type="button"
              onClick={() => setShowSharedPrompts(!showSharedPrompts)}
              className={cn("p-1.5 transition-colors", showSharedPrompts ? "text-purple-400" : "text-[#858585] hover:text-white")}
            >
              <BookMarked size={14} />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading || !(input || '').trim()}
            className="absolute right-2 bottom-2 p-1.5 bg-[#4c4c4c] hover:bg-[#5a5a5a] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
