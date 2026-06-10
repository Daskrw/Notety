"use client";
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/store/useStore';
import { X, FileText, Folder, Tag } from 'lucide-react';

export function UseTemplateModal() {
  const { isUseTemplateModalOpen, setIsUseTemplateModalOpen, activeTemplateId, setActiveTemplateId, setSelectedNoteId } = useAppStore();
  
  const template = useLiveQuery(() => activeTemplateId ? db.templates.get(activeTemplateId) : undefined, [activeTemplateId]);
  const categories = useLiveQuery(() => db.categories.toArray());

  const [noteTitle, setNoteTitle] = useState('');

  useEffect(() => {
    if (template) {
      setNoteTitle(template.defaultTitle || '');
    }
  }, [template]);

  const closeModal = () => {
    setIsUseTemplateModalOpen(false);
    setTimeout(() => setActiveTemplateId(null), 200);
    setNoteTitle('');
  };

  const createNote = async () => {
    if (!template || !noteTitle.trim()) return;

    const noteId = crypto.randomUUID();
    
    // Create Note
    await db.notes.add({
      id: noteId,
      title: noteTitle.trim(),
      content: template.content,
      isFeatured: false,
      categoryId: template.categoryId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create Highlights if any
    if (template.defaultHighlights && template.defaultHighlights.length > 0) {
      const highlightPromises = template.defaultHighlights.map(hl => 
        db.highlights.add({
          id: crypto.randomUUID(),
          noteId,
          name: hl.name,
          content: hl.content || '',
          createdAt: Date.now()
        })
      );
      await Promise.all(highlightPromises);
    }

    setSelectedNoteId(noteId);
    closeModal();
  };

  if (!isUseTemplateModalOpen || !template) return null;

  const categoryName = template.categoryId 
    ? categories?.find(c => c.id === template.categoryId)?.name || 'Unknown Folder'
    : 'Uncategorized';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity" onClick={closeModal} />
      
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <h3 className="text-base font-heading font-semibold text-stone-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-stone-500" />
            Use Template: <span className="text-stone-500 font-normal">{template.name}</span>
          </h3>
          <button onClick={closeModal} className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 font-sans space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">New Note Title *</label>
            <input 
              autoFocus
              type="text" 
              value={noteTitle} 
              onChange={e => setNoteTitle(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && noteTitle.trim()) createNote(); }}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all text-sm" 
              placeholder="Enter note title..." 
            />
          </div>
          
          <div className="bg-stone-50 rounded-xl p-4 text-sm text-stone-600 border border-stone-100 space-y-3">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-stone-400" />
              <span><strong>Folder:</strong> {categoryName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-stone-400" />
              <span><strong>Highlights:</strong> {template.defaultHighlights?.length || 0} attached</span>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-stone-100 bg-stone-50/50 flex justify-end gap-3">
          <button onClick={closeModal} className="px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors">Cancel</button>
          <button onClick={createNote} disabled={!noteTitle.trim()} className="px-5 py-2.5 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm">Create Note</button>
        </div>
      </div>
    </div>
  );
}
