"use client";
import { useAuthStore } from '@/store/useStore';
import { Sidebar } from '@/components/Sidebar';
import { NoteEditor } from '@/components/NoteEditor';
import { Login } from '@/components/Login';
import { RightPanel } from '@/components/RightPanel';
import { HighlightModal } from '@/components/HighlightModal';
import { UseTemplateModal } from '@/components/UseTemplateModal';
import { TemplateModal } from '@/components/TemplateModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EditCategoryModal } from '@/components/EditCategoryModal';

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <main className="flex h-screen bg-stone-50 font-sans overflow-hidden">
      <Sidebar />
      <NoteEditor />
      <RightPanel />
      <HighlightModal />
      <TemplateModal />
      <UseTemplateModal />
      <ConfirmModal />
      <EditCategoryModal />
    </main>
  );
}
