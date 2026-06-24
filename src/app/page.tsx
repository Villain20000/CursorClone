'use client';

import MainLayout from "@/components/MainLayout";
import TabBar from "@/components/TabBar";
import Editor from "@/components/Editor";
import Composer from "@/components/Composer";
import QuickOpen from "@/components/QuickOpen";
import InlineChat from "@/components/InlineChat";
import AdminDashboard from "@/components/AdminDashboard";
import { useEditorStore } from "@/store/useEditorStore";
import { useState } from "react";

export default function Home() {
  const { activeFileId } = useEditorStore();
  const [view, setView] = useState<'editor' | 'admin'>('editor');

  return (
    <MainLayout setView={setView}>
      <Composer />
      <QuickOpen />
      <InlineChat />
      {view === 'admin' ? (
        <AdminDashboard />
      ) : (
        <>
          <TabBar />
          <div className="flex-1 flex flex-col min-h-0">
            {activeFileId ? (
              <Editor />
            ) : (
          <div className="flex items-center justify-center h-full text-[#858585]">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4 text-white">Cursor Clone</h1>
              <p>Welcome to the AI-powered IDE</p>
              <div className="mt-8 space-y-2 text-sm">
                <p>Cmd + L: Chat</p>
                <p>Cmd + I: Composer</p>
              </div>
            </div>
          </div>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}
