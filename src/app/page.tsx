"use client";
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useStore';
import { Sidebar } from '@/components/Sidebar';
import { NoteEditor } from '@/components/NoteEditor';
import { Login } from '@/components/Login';
import { RightPanel } from '@/components/RightPanel';
import { HighlightModal } from '@/components/HighlightModal';
import { SettingsModal } from '@/components/SettingsModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EditCategoryModal } from '@/components/EditCategoryModal';
import { ProfilePanel } from '@/components/ProfilePanel';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-stone-50 text-stone-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
          <span className="text-xs font-medium">Loading Notety...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <main className="flex h-screen bg-stone-50 font-sans overflow-hidden">
      <Sidebar />
      <ProfilePanel />
      <NoteEditor />
      <RightPanel />
      <HighlightModal />
      <SettingsModal />
      <ConfirmModal />
      <EditCategoryModal />
    </main>
  );
}
