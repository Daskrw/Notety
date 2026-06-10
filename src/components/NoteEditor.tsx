"use client";
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note } from '@/lib/db';
import { useAppStore } from '@/store/useStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Star, Trash2 } from 'lucide-react';

export function NoteEditor() {
  const { selectedNoteId, setSelectedNoteId } = useAppStore();
  const [localNote, setLocalNote] = useState<Note | null>(null);

  const dbNote = useLiveQuery(
    () => selectedNoteId ? db.notes.get(selectedNoteId) : undefined,
    [selectedNoteId]
  );

  const categories = useLiveQuery(() => db.categories.toArray());

  useEffect(() => {
    if (dbNote) {
      setLocalNote(dbNote);
    } else {
      setLocalNote(null);
    }
  }, [dbNote]);

  useAutoSave(localNote, 1500);

  const toggleFeatured = async () => {
    if (localNote) {
      const updated = { ...localNote, isFeatured: !localNote.isFeatured };
      setLocalNote(updated);
      await db.notes.update(localNote.id, { isFeatured: updated.isFeatured });
    }
  };

  const updateCategory = async (catId: string) => {
    if (localNote) {
      const newCatId = catId === 'uncategorized' ? undefined : catId;
      const updated = { ...localNote, categoryId: newCatId };
      setLocalNote(updated);
      await db.notes.update(localNote.id, { categoryId: newCatId });
    }
  };

  const deleteNote = async () => {
    if (localNote) {
      await db.notes.delete(localNote.id);
      setSelectedNoteId(null);
    }
  };

  if (!selectedNoteId || !localNote) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400 bg-white">
        <p className="text-sm font-medium tracking-wide">Select a note to start writing</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      {/* Top Toolbar */}
      <div className="h-16 flex items-center justify-between px-8 border-b border-stone-100 flex-shrink-0">
        <div className="flex items-center">
          <select 
            value={localNote.categoryId || 'uncategorized'} 
            onChange={(e) => updateCategory(e.target.value)}
            className="text-xs font-medium text-stone-500 bg-transparent outline-none cursor-pointer hover:text-stone-800 transition-colors"
          >
            <option value="uncategorized">Uncategorized</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-4 text-stone-400">
          <button 
            onClick={toggleFeatured}
            title="Feature this note"
            className={`p-2 rounded-full transition-colors ${localNote.isFeatured ? 'text-amber-500 bg-amber-50' : 'hover:bg-stone-100'}`}
          >
            <Star className={`w-4 h-4 ${localNote.isFeatured ? 'fill-amber-500' : ''}`} />
          </button>
          <button 
            onClick={deleteNote}
            title="Delete note"
            className="p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto px-8 py-12 w-full max-w-5xl mx-auto flex flex-col gap-8 custom-scrollbar">
        <input
          type="text"
          value={localNote.title}
          onChange={(e) => setLocalNote({ ...localNote, title: e.target.value })}
          placeholder="Note Title"
          className="w-full text-4xl font-heading font-semibold text-stone-800 bg-transparent border-none outline-none placeholder:text-stone-300"
        />
        
        <div className="flex-1 min-h-[500px]">
          <textarea
            value={localNote.content}
            onChange={(e) => setLocalNote({ ...localNote, content: e.target.value })}
            placeholder="Start writing..."
            className="w-full resize-none bg-transparent border-none outline-none text-stone-700 leading-relaxed font-sans h-full custom-scrollbar"
          />
        </div>
      </div>
    </div>
  );
}
