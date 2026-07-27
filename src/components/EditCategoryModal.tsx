"use client";
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { updateCategory } from '@/lib/data';
import { X } from 'lucide-react';

export function EditCategoryModal() {
  const { isEditCategoryModalOpen, setIsEditCategoryModalOpen, editingCategoryId, setEditingCategoryId } = useAppStore();
  const { user } = useAuthStore();
  
  const category = useLiveQuery(
    () => editingCategoryId ? db.categories.get(editingCategoryId) : undefined,
    [editingCategoryId]
  );

  const [name, setName] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name);
    }
  }, [category]);

  const closeModal = () => {
    setIsEditCategoryModalOpen(false);
    setTimeout(() => {
      setEditingCategoryId(null);
      setName('');
    }, 200);
  };

  const saveCategory = async () => {
    if (!category || !name.trim() || !user) return;
    await updateCategory(category.id, user.id, name.trim());
    closeModal();
  };

  if (!isEditCategoryModalOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity" onClick={closeModal} />
      
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <h3 className="text-base font-heading font-semibold text-stone-800">Rename Folder</h3>
          <button onClick={closeModal} className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 font-sans space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Folder Name</label>
            <input 
              autoFocus
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) saveCategory(); }}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all text-sm" 
            />
          </div>
        </div>

        <div className="p-5 border-t border-stone-100 bg-stone-50/50 flex justify-end gap-3">
          <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={saveCategory} disabled={!name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm">Save</button>
        </div>
      </div>
    </div>
  );
}
