"use client";
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
  const { isAuthenticated } = useAuthStore();

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
