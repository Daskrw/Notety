"use client";
import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Category } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { createNote, createCategory, deleteCategory, updateCategoryOrder } from '@/lib/data';
import { Plus, Star, Settings, Search, Folder, ChevronDown, ChevronRight, ChevronUp, Trash2, Edit2, Pin, PinOff, FileText, Globe, Code2 } from 'lucide-react';

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
    appMode, setAppMode,
  } = useAppStore();
  const { user } = useAuthStore();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('quietnotes_folder_expansion_preferences');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {};
  });

  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('quietnotes_favorites_expanded_preference');
        if (saved !== null) return JSON.parse(saved);
      } catch {}
    }
    return true;
  });

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Persistent note ordering map: { [categoryIdOrUncategorized]: string[] }
  const [noteOrderMap, setNoteOrderMap] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('quietnotes_note_order_preferences');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {};
  });

  const saveNoteOrderMap = (updater: (prev: Record<string, string[]>) => Record<string, string[]>) => {
    setNoteOrderMap(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem('quietnotes_note_order_preferences', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem('quietnotes_folder_expansion_preferences', JSON.stringify(expandedCategories));
    } catch {}
  }, [expandedCategories]);

  useEffect(() => {
    try {
      localStorage.setItem('quietnotes_favorites_expanded_preference', JSON.stringify(isFavoritesExpanded));
    } catch {}
  }, [isFavoritesExpanded]);

  // Read notes WITHOUT sorting by updated_at!
  // This guarantees editing or auto-save never alters the list position.
  const notes = useLiveQuery(async (): Promise<Note[]> => {
    return await db.notes.toArray();
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

  // Deterministic, stable ordering for notes in any category
  const sortNotesForCategory = (catId: string, noteList: Note[]): Note[] => {
    const orderList = noteOrderMap[catId] || [];
    return [...noteList].sort((a, b) => {
      const idxA = orderList.indexOf(a.id);
      const idxB = orderList.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      // Stable fallback: created_at descending (so new notes appear at top, but typing/updated_at never moves them)
      return (b.created_at || 0) - (a.created_at || 0);
    });
  };

  const groupedNotes = useMemo(() => {
    const rawGroups = filteredNotes.reduce((acc: Record<string, Note[]>, note: Note) => {
      const catId = note.category_id || 'uncategorized';
      if (!acc[catId]) acc[catId] = [];
      acc[catId].push(note);
      return acc;
    }, {});

    const sortedGroups: Record<string, Note[]> = {};
    for (const [catId, noteList] of Object.entries(rawGroups)) {
      sortedGroups[catId] = sortNotesForCategory(catId, noteList);
    }
    return sortedGroups;
  }, [filteredNotes, noteOrderMap]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = {
        ...prev,
        [id]: prev[id] === undefined ? false : !prev[id]
      };
      try {
        localStorage.setItem('quietnotes_folder_expansion_preferences', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleCreateNote = async (categoryId?: string) => {
    if (!user) return;
    setAppMode('notes');
    const newId = await createNote(user.id, { category_id: categoryId });
    setSelectedNoteId(newId);
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

  // Move Folder Up/Down
  const handleMoveCategory = async (e: React.MouseEvent, categoryId: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    if (!categories || !user) return;
    const index = categories.findIndex(c => c.id === categoryId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    for (let i = 0; i < reordered.length; i++) {
      const cat = reordered[i];
      if (cat.sort_order !== i) {
        await updateCategoryOrder(cat.id, user.id, i);
      }
    }
  };

  // Move Note Up/Down within its folder or list
  const handleMoveNote = (e: React.MouseEvent, noteId: string, catKey: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    const currentList = catKey === 'favorites' ? favoriteNotes : (groupedNotes[catKey] || []);
    const index = currentList.findIndex(n => n.id === noteId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const reordered = [...currentList];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const newOrderIds = reordered.map(n => n.id);
    saveNoteOrderMap(prev => ({
      ...prev,
      [catKey]: newOrderIds
    }));
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

        {/* Workspace Mode Switcher: Notes vs Devtool */}
        <div className="px-3 py-2 bg-stone-100/70 border-b border-stone-200 flex items-center gap-1 shrink-0">
          <button
            onClick={() => setAppMode('notes')}
            title="Notes"
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              appMode === 'notes'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>
          <button
            onClick={() => setAppMode('browser')}
            title="Devtool"
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              appMode === 'browser'
                ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Devtool</span>
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
                  {favoriteNotes.map((note, favIndex) => {
                    const isSelected = selectedNoteId === note.id;
                    const canMoveUp = favIndex > 0;
                    const canMoveDown = favIndex < favoriteNotes.length - 1;

                    return (
                      <div
                        key={note.id}
                        onClick={() => {
                          setAppMode('notes');
                          setSelectedNoteId(note.id);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md transition-all duration-150 flex items-center justify-between gap-1 group/note cursor-pointer ${
                          isSelected
                            ? 'bg-stone-200/70 shadow-xs text-stone-900 font-medium'
                            : 'hover:bg-stone-200/40 text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <span className="text-sm truncate flex-1 min-w-0 font-medium">{note.title || 'Untitled Note'}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 mr-1" />
                          <div className="flex items-center opacity-0 group-hover/note:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleMoveNote(e, note.id, 'favorites', 'up')}
                              disabled={!canMoveUp}
                              title="Move up"
                              aria-label="Move up"
                              className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-300/60 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleMoveNote(e, note.id, 'favorites', 'down')}
                              disabled={!canMoveDown}
                              title="Move down"
                              aria-label="Move down"
                              className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-300/60 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Folders Header */}
          <div className="px-2 pt-5 pb-2 flex items-center justify-between">
            <span className="text-xs font-heading font-semibold tracking-widest text-stone-500 uppercase">Folders</span>
            <button onClick={() => setIsCreatingCategory(!isCreatingCategory)} className="text-stone-400 hover:text-stone-800 transition-colors" title="Create new folder" aria-label="Create new folder">
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
              const isCustom = category.id !== 'uncategorized';
              const isExpanded = expandedCategories[category.id] !== false;

              // Index among custom categories for boundary check
              const catIndex = (categories || []).findIndex(c => c.id === category.id);
              const totalCustomCats = (categories || []).length;
              const canCatMoveUp = isCustom && catIndex > 0;
              const canCatMoveDown = isCustom && catIndex !== -1 && catIndex < totalCustomCats - 1;

              return (
                <div key={category.id} className="space-y-1 relative">
                  <div
                    className="flex items-center justify-between px-2 py-1.5 cursor-pointer group rounded-md hover:bg-stone-200/50 transition-all duration-150"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center gap-2 text-stone-600 group-hover:text-stone-900 transition-colors flex-1 min-w-0">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                      <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{category.name}</span>
                      <span className="text-xs text-stone-400 font-normal">({categoryNotes.length})</span>
                    </div>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity gap-0.5">
                      {isCustom && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleMoveCategory(e, category.id, 'up')}
                            disabled={!canCatMoveUp}
                            title="Move folder up"
                            aria-label="Move folder up"
                            className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200/80 rounded transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleMoveCategory(e, category.id, 'down')}
                            disabled={!canCatMoveDown}
                            title="Move folder down"
                            aria-label="Move folder down"
                            className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200/80 rounded transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleEditCategory(e, category.id)}
                            title="Rename folder"
                            aria-label="Rename folder"
                            className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200/80 rounded transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCategory(e, category.id, category.name)}
                            title="Delete folder"
                            aria-label="Delete folder"
                            className="p-1 text-stone-400 hover:text-red-500 hover:bg-stone-200/80 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCreateNote(isCustom ? category.id : undefined); }}
                        className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200/80 rounded transition-colors ml-0.5"
                        title="New note in folder"
                        aria-label="New note in folder"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-0.5 ml-3.5 pl-3 border-l border-stone-200/80 min-h-[20px] py-0.5">
                      {categoryNotes.map((note, noteIndex) => {
                        const isSelected = selectedNoteId === note.id;
                        const canMoveUp = noteIndex > 0;
                        const canMoveDown = noteIndex < categoryNotes.length - 1;

                        return (
                          <div
                            key={note.id}
                            onClick={() => {
                              setAppMode('notes');
                              setSelectedNoteId(note.id);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md transition-all duration-150 flex items-center justify-between gap-1 group/note cursor-pointer ${
                              isSelected 
                                ? 'bg-stone-200/70 shadow-xs text-stone-900 font-medium' 
                                : 'hover:bg-stone-200/40 text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <span className="text-sm truncate flex-1 min-w-0">{note.title || 'Untitled Note'}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {note.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 mr-1" />}
                              <div className="flex items-center opacity-0 group-hover/note:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => handleMoveNote(e, note.id, category.id, 'up')}
                                  disabled={!canMoveUp}
                                  title="Move up"
                                  aria-label="Move up"
                                  className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-300/60 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleMoveNote(e, note.id, category.id, 'down')}
                                  disabled={!canMoveDown}
                                  title="Move down"
                                  aria-label="Move down"
                                  className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-300/60 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {categoryNotes.length === 0 && (
                        <div className="px-3 py-1.5 text-xs text-stone-400 italic">
                          Empty folder
                        </div>
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
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
