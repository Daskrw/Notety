"use client";
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/store/useStore';
import { Plus, Star, Menu, Settings, Search, Folder, ChevronDown, ChevronRight, LayoutTemplate, Trash2, Edit2 } from 'lucide-react';

export function Sidebar() {
  const { 
    isSidebarOpen, toggleSidebar, 
    selectedNoteId, setSelectedNoteId, 
    searchQuery, setSearchQuery, 
    setIsTemplateModalOpen, setEditingTemplateId, 
    setIsUseTemplateModalOpen, setActiveTemplateId,
    setIsEditCategoryModalOpen, setEditingCategoryId,
    setConfirmConfig
  } = useAppStore();
  
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Template Search state
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const templates = useLiveQuery(() => db.templates.toArray());

  // Template filter
  const filteredTemplates = templates?.filter(t => t.name.toLowerCase().includes(templateSearchQuery.toLowerCase())) || [];

  // Search filter
  const filteredNotes = notes?.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  const favoriteNotes = filteredNotes.filter(n => n.isFeatured);

  // Group by category
  const groupedNotes = filteredNotes.reduce((acc, note) => {
    const catId = note.categoryId || 'uncategorized';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(note);
    return acc;
  }, {} as Record<string, typeof filteredNotes>);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const createNote = async (categoryId?: string) => {
    const id = crypto.randomUUID();
    await db.notes.add({
      id,
      title: '',
      content: '',
      isFeatured: false,
      categoryId: categoryId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setSelectedNoteId(id);
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    await db.categories.add({
      id: crypto.randomUUID(),
      name: newCategoryName.trim()
    });
    setNewCategoryName('');
    setIsCreatingCategory(false);
  };

  const deleteCategory = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete the folder "${name}"? Notes inside will be safely moved to Uncategorized.`,
      onConfirm: async () => {
        await db.notes.where('categoryId').equals(id).modify({ categoryId: undefined });
        await db.categories.delete(id);
      }
    });
  };

  const editCategory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingCategoryId(id);
    setIsEditCategoryModalOpen(true);
  };

  const deleteTemplate = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Template',
      message: `Are you sure you want to delete the template "${name}"? This action cannot be undone.`,
      onConfirm: async () => {
        await db.templates.delete(id);
      }
    });
  };

  const editTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingTemplateId(id);
    setIsTemplateModalOpen(true);
  };

  if (!isSidebarOpen) {
    return (
      <button onClick={toggleSidebar} className="p-4 fixed top-0 left-0 hover:bg-stone-100 rounded-br-lg transition-colors z-50 group">
        <Menu className="w-5 h-5 text-stone-400 group-hover:text-stone-700" />
      </button>
    );
  }

  return (
    <aside className="w-72 bg-stone-50 border-r border-stone-200 h-screen flex flex-col transition-all duration-300 shrink-0">
      {/* Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200 bg-stone-100/50">
        <div className="flex items-center space-x-2 text-stone-700">
          <Settings className="w-4 h-4 cursor-pointer hover:text-stone-900 transition-colors" />
          <span className="text-sm font-heading font-medium tracking-wide">WORKSPACE</span>
        </div>
        <button onClick={toggleSidebar} className="text-stone-400 hover:text-stone-700 transition-colors">
          <Menu className="w-4 h-4" />
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
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200
                      ${selectedNoteId === note.id ? 'bg-stone-200/70 shadow-sm text-stone-900' : 'hover:bg-stone-200/40 text-stone-500 hover:text-stone-800'}
                    `}
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
              onKeyDown={(e) => { if (e.key === 'Enter') createCategory(); if (e.key === 'Escape') setIsCreatingCategory(false); }}
              className="w-full text-sm px-3 py-1.5 bg-white border border-stone-200 rounded outline-none focus:border-stone-400 shadow-sm"
            />
          </div>
        )}

        {/* Categories & Notes List */}
        <div className="space-y-4">
          {[{ id: 'uncategorized', name: 'Uncategorized' }, ...(categories || [])].map(category => {
            const categoryNotes = groupedNotes[category.id] || [];
            if (category.id === 'uncategorized' && categoryNotes.length === 0 && categories?.length !== 0) return null;
            
            const isExpanded = expandedCategories[category.id] !== false; // Default true
            const isCustom = category.id !== 'uncategorized';

            return (
              <div key={category.id} className="space-y-1">
                <div 
                  className="flex items-center justify-between px-2 py-1.5 cursor-pointer group rounded-md hover:bg-stone-200/50 transition-colors"
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
                        <button onClick={(e) => editCategory(e, category.id)} className="p-1.5 text-stone-400 hover:text-stone-800 transition-colors">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => deleteCategory(e, category.id, category.name)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); createNote(isCustom ? category.id : undefined); }}
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
                        onClick={() => setSelectedNoteId(note.id)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200 flex flex-col gap-0.5
                          ${selectedNoteId === note.id ? 'bg-stone-200/70 shadow-sm text-stone-900' : 'hover:bg-stone-200/40 text-stone-500 hover:text-stone-800'}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm truncate font-medium">
                            {note.title || 'Untitled Note'}
                          </span>
                          {note.isFeatured && <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0 ml-2" />}
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

      {/* Templates Section (Bottom) */}
      <div className="border-t border-stone-200 bg-stone-100/30">
        <div className="p-4 pb-2 flex items-center justify-between">
          <span className="text-xs font-heading font-semibold tracking-widest text-stone-500 uppercase">Templates</span>
          <button onClick={() => setIsTemplateModalOpen(true)} className="text-stone-400 hover:text-stone-800 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {(templates && templates.length > 0) ? (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input 
                type="text" 
                placeholder="Find template..." 
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-md outline-none focus:border-stone-400 transition-all placeholder:text-stone-400 shadow-sm"
              />
            </div>
          </div>
        ) : null}

        <div className="px-2 pb-4 space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              onClick={() => { setActiveTemplateId(template.id); setIsUseTemplateModalOpen(true); }}
              className="w-full flex items-center justify-between px-3 py-2 group cursor-pointer hover:bg-stone-200/60 rounded-md transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <LayoutTemplate className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                <span className="text-sm text-stone-600 group-hover:text-stone-900 truncate font-medium">{template.name}</span>
              </div>
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => editTemplate(e, template.id)} 
                  className="p-1.5 text-stone-400 hover:text-stone-800 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => deleteTemplate(e, template.id, template.name)} 
                  className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {templates?.length === 0 && (
            <div className="px-3 py-2 text-xs text-stone-400 italic">No templates</div>
          )}
          {templates && templates.length > 0 && filteredTemplates.length === 0 && (
            <div className="px-3 py-2 text-xs text-stone-400 italic">No matches found</div>
          )}
        </div>
      </div>
    </aside>
  );
}
