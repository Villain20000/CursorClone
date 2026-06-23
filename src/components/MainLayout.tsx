'use client';

import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/ChatPanel';
import ActivityBar from '@/components/ActivityBar';
import TerminalPanel from '@/components/TerminalPanel';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
      <ActivityBar />
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
        <TerminalPanel />
      </main>
      <ChatPanel />
    </div>
  );
}
