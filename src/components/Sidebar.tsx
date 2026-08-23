"use client";
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Category } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { createNote, createCategory, deleteCategory, updateCategoryOrder, updateNote } from '@/lib/data';
import { Plus, Star, Menu, Settings, Search, Folder, ChevronDown, ChevronRight, Trash2, Edit2, Pin, PinOff } from 'lucide-react';

function Avatar({ seed, size = 32 }: { seed: string; size?: number }) {
  const hue = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const initials = seed.slice(0, 2).toUpperCase();
  return (
    <div
      style={{ width: size, height: size, background: `hsl(${hue}, 40%, 85%)`, color: `hsl(${hue}, 40%, 35%)`, fontSize: size * 0.36 }}
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0 select-none"
    >
      {initials}
    </div>
  );
}

export function Sidebar() {
  const {
    isSidebarOpen, isSidebarPinned, toggleSidebarPin, setSidebarHovered,
    selectedNoteId, setSelectedNoteId,
    searchQuery, setSearchQuery,
    setIsEditCategoryModalOpen, setEditingCategoryId,
    setConfirmConfig,
    setIsProfilePanelOpen, userProfile,
    setIsSettingsModalOpen,
  } = useAppStore();
  const { user } = useAuthStore();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);

  const notes = useLiveQuery(async (): Promise<Note[]> => {
    const all = await db.notes.toArray();
    return all.sort((a, b) => b.updated_at - a.updated_at);
  });
  const categories = useLiveQuery(async (): Promise<Category[]> => {
    const list = await db.categories.toArray();
    return list.sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  });

  const filteredNotes = notes?.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  const favoriteNotes = filteredNotes.filter(n => n.is_featured);

  const groupedNotes = filteredNotes.reduce((acc: Record<string, Note[]>, note: Note) => {
    const catId = note.category_id || 'uncategorized';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(note);
    return acc;
  }, {} as Record<string, typeof filteredNotes>);

  const toggleCategory = (id: string) => setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));

  const handleCreateNote = async (category_id?: string) => {
    if (!user) return;
    const id = await createNote(user.id, { category_id });
    setSelectedNoteId(id);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !user) return;
    await createCategory(user.id, newCategoryName.trim());
    setNewCategoryName('');
    setIsCreatingCategory(false);
  };

  const handleDeleteCategory = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete the folder "${name}"? Notes inside will be safely moved to Uncategorized.`,
      onConfirm: async () => {
        if (!user) return;
        await deleteCategory(id, user.id);
      },
    });
  };


  const handleEditCategory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingCategoryId(id);
    setIsEditCategoryModalOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedCategoryId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleNoteDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('note_id', id);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDraggedCategoryId(null);
    if (!categories || !user) return;

    // Check if dropping a note
    const noteId = e.dataTransfer.getData('note_id');
    if (noteId) {
      const note = notes?.find(n => n.id === noteId);
      if (note && note.category_id !== targetId) {
        await updateNote(noteId, user.id, { category_id: targetId === 'uncategorized' ? undefined : targetId });
      }
      return;
    }

    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    const sourceIndex = categories.findIndex(c => c.id === sourceId);
    const targetIndex = categories.findIndex(c => c.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...categories];
    const [dragged] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, dragged);

    // Save the new sort_orders
    for (let i = 0; i < reordered.length; i++) {
      const cat = reordered[i];
      if (cat.sort_order !== i) {
        await updateCategoryOrder(cat.id, user.id, i);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedCategoryId(null);
  };

  return (
    <>
      {/* Backdrop Overlay only for unpinned hover-peek on mobile */}
      {isSidebarOpen && !isSidebarPinned && (
        <div 
          onClick={() => {
            setSidebarHovered(false);
          }}
          className="fixed inset-0 bg-black/20 backdrop-blur-2xs z-35 md:hidden transition-opacity"
        />
      )}

      <aside 
        onMouseLeave={() => { if (!isSidebarPinned) setSidebarHovered(false); }}
        className={`w-64 sm:w-72 max-w-[85vw] sm:max-w-none fixed md:static top-0 left-0 bottom-0 bg-stone-50 border-r border-stone-200 h-screen flex flex-col transition-all duration-300 ease-in-out shrink-0 shadow-lg z-40 ${
          isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 md:-mr-64 lg:-mr-72 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200 bg-stone-100/50">
          <div className="flex items-center space-x-2 text-stone-700">
            <Settings className="w-4 h-4 cursor-pointer hover:text-stone-900 transition-colors" />
            <span className="text-sm font-heading font-medium tracking-wide">WORKSPACE</span>
          </div>
          <button 
            onClick={toggleSidebarPin} 
            title={isSidebarPinned ? "Pin active (click to unpin)" : "Unpinned (click to pin)"}
            className={`p-1.5 rounded-md transition-colors ${isSidebarPinned ? 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/60' : 'text-amber-600 bg-amber-100/70 hover:bg-amber-200/80'}`}
          >
            {isSidebarPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
        </div>

      {/* Search */}
      <div className="p-4 border-b border-stone-200 bg-white">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all placeholder:text-stone-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
        {/* Favorites Section */}
        {favoriteNotes.length > 0 && (
          <div className="mt-4 mb-2">
            <div
              className="flex items-center justify-between px-2 py-1.5 cursor-pointer group rounded-md hover:bg-stone-200/50 transition-colors"
              onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)}
            >
              <div className="flex items-center gap-2 text-stone-600 group-hover:text-stone-900 transition-colors">
                {isFavoritesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span className="text-sm font-medium">Favorites</span>
              </div>
            </div>
            {isFavoritesExpanded && (
              <div className="space-y-0.5 ml-3.5 pl-3 border-l border-stone-200/80 mt-1">
                {favoriteNotes.map(note => (
                  <button
                    key={note.id}
                    draggable
                    onDragStart={(e) => handleNoteDragStart(e, note.id)}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200 ${selectedNoteId === note.id ? 'bg-stone-200/70 shadow-sm text-stone-900' : 'hover:bg-stone-200/40 text-stone-500 hover:text-stone-800'}`}
                  >
                    <span className="text-sm truncate font-medium block">{note.title || 'Untitled Note'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Folders Header */}
        <div className="px-2 pt-5 pb-2 flex items-center justify-between">
          <span className="text-xs font-heading font-semibold tracking-widest text-stone-500 uppercase">Folders</span>
          <button onClick={() => setIsCreatingCategory(!isCreatingCategory)} className="text-stone-400 hover:text-stone-800 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isCreatingCategory && (
          <div className="px-2 pb-2">
            <input
              autoFocus
              type="text"
              placeholder="Folder name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setIsCreatingCategory(false); }}
              className="w-full text-sm px-3 py-1.5 bg-white border border-stone-200 rounded outline-none focus:border-stone-400 shadow-sm"
            />
          </div>
        )}

        {/* Categories & Notes List */}
        <div className="space-y-4">
          {[{ id: 'uncategorized', name: 'Uncategorized' }, ...(categories || [])].map(category => {
            const categoryNotes = groupedNotes[category.id] || [];
            if (category.id === 'uncategorized' && categoryNotes.length === 0 && categories?.length !== 0) return null;
            const isExpanded = expandedCategories[category.id] !== false;
            const isCustom = category.id !== 'uncategorized';

            return (
              <div key={category.id} className="space-y-1">
                <div
                  draggable={isCustom}
                  onDragStart={(e) => isCustom && handleDragStart(e, category.id)}
                  onDragOver={(e) => {
                    // Allow dropping notes even on Uncategorized
                    e.preventDefault();
                  }}
                  onDrop={(e) => handleDrop(e, category.id)}
                  onDragEnd={() => isCustom && handleDragEnd()}
                  className={`flex items-center justify-between px-2 py-1.5 cursor-pointer group rounded-md hover:bg-stone-200/50 transition-all duration-200 ${draggedCategoryId === category.id ? 'opacity-40 scale-[0.98] bg-stone-100' : ''}`}
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-center gap-2 text-stone-600 group-hover:text-stone-900 transition-colors flex-1 min-w-0">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{category.name}</span>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isCustom && (
                      <>
                        <button onClick={(e) => handleEditCategory(e, category.id)} className="p-1.5 text-stone-400 hover:text-stone-800 transition-colors">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => handleDeleteCategory(e, category.id, category.name)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCreateNote(isCustom ? category.id : undefined); }}
                      className="p-1.5 text-stone-400 hover:text-stone-800 transition-colors ml-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-0.5 ml-3.5 pl-3 border-l border-stone-200/80">
                    {categoryNotes.map(note => (
                      <button
                        key={note.id}
                        draggable
                        onDragStart={(e) => handleNoteDragStart(e, note.id)}
                        onClick={() => setSelectedNoteId(note.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-md transition-all duration-200 flex items-center gap-2 ${selectedNoteId === note.id ? 'bg-stone-200/70 shadow-sm text-stone-900' : 'hover:bg-stone-200/40 text-stone-500 hover:text-stone-800'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm truncate font-medium">{note.title || 'Untitled Note'}</span>
                          {note.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0 ml-2" />}
                        </div>
                      </button>
                    ))}
                    {categoryNotes.length === 0 && (
                      <div className="px-3 py-2 text-xs text-stone-400 italic">Empty folder</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>



      {/* Profile Footer */}
      <div className="border-t border-stone-200 bg-stone-100/50 p-3">
        <div className="flex items-center w-full group">
          <button
            onClick={() => setIsProfilePanelOpen(true)}
            className="flex-1 flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <Avatar seed={userProfile?.avatar_seed || userProfile?.username || 'QN'} size={32} />
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-stone-800 truncate">{userProfile?.display_name || '...'}</p>
              <p className="text-xs text-stone-400 truncate">@{userProfile?.username || '...'}</p>
            </div>
          </button>
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 ml-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200/60 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
