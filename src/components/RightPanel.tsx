"use client";
import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { createHighlight, deleteHighlight } from '@/lib/data';
import { PanelRightClose, Plus, FileText, Trash2, Layers, Sparkles, Pin, PinOff } from 'lucide-react';
import { format } from 'date-fns';
import { registerDropListener, DragBlockPayload } from '@/hooks/useDragBlock';
import { parseNoteContent, serializeNoteContent } from '@/lib/blocks';
import { PasswordBlockView } from './PasswordBlockView';
import { PingBlockView } from './PingBlockView';
import { JobBlockView } from './JobBlockView';
import { ScheduleBlockView } from './ScheduleBlockView';

export function RightPanel() {
  const { 
    isRightPanelOpen, isRightPanelPinned, toggleRightPanelPin, setRightPanelHovered,
    selectedNoteId, setIsHighlightModalOpen, setActiveHighlightId 
  } = useAppStore();
  const { user } = useAuthStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newHighlightName, setNewHighlightName] = useState('');
  const [activeTab, setActiveTab] = useState<'highlights' | 'blocks'>('highlights');
  const panelRef = useRef<HTMLElement>(null);

  const localNote = useLiveQuery(
    () => selectedNoteId ? db.notes.get(selectedNoteId) : undefined,
    [selectedNoteId]
  );

  const selectedNoteIdRef = useRef(selectedNoteId);
  selectedNoteIdRef.current = selectedNoteId;
  const userRef = useRef(user);
  userRef.current = user;

  // Pointer-based drop listener for dropping blocks into the Highlights panel
  useEffect(() => {
    const unregister = registerDropListener(async (payload: DragBlockPayload, x: number, y: number) => {
      const noteId = selectedNoteIdRef.current;
      const u = userRef.current;
      if (!noteId || !u || !panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

      // Drop happened in this panel! Add block to note blocks
      const note = await db.notes.get(noteId);
      if (!note) return;

      const noteContent = parseNoteContent(note.content);
      const isTemplate = ['template-password', 'template-ping', 'template-job', 'template-schedule'].includes(payload.id);

      // If it's an existing block already in the note, do not duplicate
      if (!isTemplate && noteContent.blocks.some(b => b.id === payload.id)) {
        return;
      }

      const droppedBlock = {
        id: isTemplate ? crypto.randomUUID() : payload.id,
        type: payload.type,
        value: payload.value,
      };

      const newBlocks = [...noteContent.blocks, droppedBlock];

      await db.notes.update(noteId, {
        content: serializeNoteContent(noteContent.text, newBlocks),
        updated_at: Date.now()
      });
      
      // Auto switch to blocks tab
      setActiveTab('blocks');
    });
    return () => unregister();
  }, []);

  const highlights = useLiveQuery(
    async () => {
      if (!selectedNoteId) return [];
      const items = await db.highlights.where('note_id').equals(selectedNoteId).toArray();
      return items.sort((a, b) => b.created_at - a.created_at);
    },
    [selectedNoteId]
  );

  const handleCreateHighlight = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedNoteId || !newHighlightName.trim() || !user) return;
    await createHighlight(user.id, selectedNoteId, newHighlightName.trim());
    setNewHighlightName('');
    setIsCreating(false);
  };

  const handleDeleteHighlight = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    await deleteHighlight(id, user.id);
  };

  const openHighlight = (id: string) => {
    setActiveHighlightId(id);
    setIsHighlightModalOpen(true);
  };

  const updateBlock = async (index: number, val: any) => {
    if (!localNote || !user) return;
    const noteContent = parseNoteContent(localNote.content);
    const newBlocks = [...noteContent.blocks];
    const current = newBlocks[index];
    if (current.type === 'image') {
      newBlocks[index] = { ...current, caption: val };
    } else {
      newBlocks[index] = { ...current, value: val } as any;
    }
    
    await db.notes.update(localNote.id, {
      content: serializeNoteContent(noteContent.text, newBlocks),
      updated_at: Date.now()
    });
  };

  const removeBlock = async (index: number) => {
    if (!localNote || !user) return;
    const noteContent = parseNoteContent(localNote.content);
    const newBlocks = noteContent.blocks.filter((_, i) => i !== index);

    await db.notes.update(localNote.id, {
      content: serializeNoteContent(noteContent.text, newBlocks),
      updated_at: Date.now()
    });
  };

  // Drag and drop reordering for existing blocks in RightPanel
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);

  const handleBlockDragStart = (e: React.DragEvent, index: number) => {
    const b = noteContent.blocks[index];
    const val = 'value' in b ? b.value : '';
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: b.id,
      type: b.type,
      value: val
    }));
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBlockIndex(index);
  };

  const handleBlockDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverBlockIndex !== index) {
      setDragOverBlockIndex(index);
    }
  };

  const handleBlockDragLeave = () => {
    setDragOverBlockIndex(null);
  };

  const handleBlockDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBlockIndex(null);

    if (draggedBlockIndex === null || draggedBlockIndex === targetIndex || !localNote) {
      setDraggedBlockIndex(null);
      return;
    }

    const currentBlocks = [...noteContent.blocks];
    const [movedBlock] = currentBlocks.splice(draggedBlockIndex, 1);
    currentBlocks.splice(targetIndex, 0, movedBlock);

    setDraggedBlockIndex(null);

    await db.notes.update(localNote.id, {
      content: serializeNoteContent(noteContent.text, currentBlocks),
      updated_at: Date.now()
    });
  };

  const noteContent = parseNoteContent(localNote?.content || '');

  return (
    <>
      {/* Backdrop Overlay only for unpinned hover-peek on mobile */}
      {isRightPanelOpen && !isRightPanelPinned && (
        <div 
          onClick={() => {
            setRightPanelHovered(false);
          }}
          className="fixed inset-0 bg-black/20 backdrop-blur-2xs z-35 md:hidden transition-opacity"
        />
      )}

      <aside 
        ref={panelRef}
        onMouseLeave={() => { if (!isRightPanelPinned) setRightPanelHovered(false); }}
        className={`w-72 sm:w-80 md:w-96 max-w-[55vw] sm:max-w-none fixed md:static top-0 right-0 bottom-0 bg-white border-l border-stone-200 h-screen flex flex-col transition-all duration-300 ease-in-out shadow-xl z-40 shrink-0 ${
          isRightPanelOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 md:-ml-80 lg:-ml-96 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-stone-100 flex-shrink-0">
          <span className="text-xs font-heading font-semibold tracking-widest text-stone-500 uppercase">Panel</span>
          <button 
            onClick={toggleRightPanelPin} 
            title={isRightPanelPinned ? "Pin active (click to unpin)" : "Unpinned (click to pin)"}
            className={`p-1.5 rounded-md transition-colors ${isRightPanelPinned ? 'text-stone-500 hover:text-stone-800 hover:bg-stone-100' : 'text-amber-600 bg-amber-100/70 hover:bg-amber-200/80'}`}
          >
            {isRightPanelPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
        </div>

      {/* Tabs bar */}
      <div className="flex border-b border-stone-100 bg-stone-50/50 p-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('highlights')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
            activeTab === 'highlights' 
              ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50' 
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Highlights</span>
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
            activeTab === 'blocks' 
              ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50' 
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Blocks ({noteContent.blocks.length})</span>
        </button>
      </div>

      {!selectedNoteId ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400 text-sm">
          <FileText className="w-10 h-10 mb-4 opacity-20" />
          <p>Select a note to view panel data.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'highlights' ? (
            <>
              {/* Highlights List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {highlights?.map(hl => (
                  <div
                    key={hl.id}
                    onClick={() => openHighlight(hl.id)}
                    className="group cursor-pointer bg-white border border-stone-100 hover:border-stone-300 hover:shadow-sm p-4 rounded-xl transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-stone-800 leading-snug">{hl.name}</h4>
                      <button 
                        onClick={(e) => handleDeleteHighlight(e, hl.id)}
                        className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-opacity p-1 -mr-2 -mt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-stone-400 mt-2 font-medium">{format(hl.created_at, 'MMM d, yyyy')}</p>
                  </div>
                ))}
                
                {highlights?.length === 0 && !isCreating && (
                  <p className="text-center text-stone-400 text-sm py-8 italic">No highlights saved.</p>
                )}
              </div>

              {/* Create Form */}
              <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex-shrink-0">
                {isCreating ? (
                  <div className="space-y-3">
                    <input 
                      autoFocus
                      type="text"
                      value={newHighlightName}
                      onChange={(e) => setNewHighlightName(e.target.value)}
                      placeholder="Name your highlight..."
                      className="w-full text-sm px-3 py-2.5 bg-white border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:shadow-sm transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateHighlight();
                        if (e.key === 'Escape') setIsCreating(false);
                      }}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleCreateHighlight} className="flex-1 bg-stone-900 text-white text-xs py-2.5 rounded-lg font-medium hover:bg-stone-800 transition-colors">Save</button>
                      <button onClick={() => setIsCreating(false)} className="flex-1 bg-white border border-stone-200 text-stone-600 text-xs py-2.5 rounded-lg font-medium hover:bg-stone-50 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 text-stone-600 py-2.5 rounded-lg transition-all text-sm font-medium shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Highlight</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Interactive Blocks list */
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {noteContent.blocks.map((block, index) => {
                const isBeingDragged = draggedBlockIndex === index;
                const isDragOver = dragOverBlockIndex === index;

                return (
                  <div 
                    key={block.id} 
                    draggable
                    onDragStart={(e) => handleBlockDragStart(e, index)}
                    onDragOver={(e) => handleBlockDragOver(e, index)}
                    onDragLeave={handleBlockDragLeave}
                    onDrop={(e) => handleBlockDrop(e, index)}
                    className={`relative bg-white rounded-xl p-1 border transition-all duration-150 cursor-grab active:cursor-grabbing ${
                      isBeingDragged 
                        ? 'opacity-40 scale-95 border-dashed border-stone-400' 
                        : isDragOver
                        ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1 shadow-md -translate-y-0.5'
                        : 'border-stone-100 hover:border-stone-300 shadow-sm'
                    }`}
                  >
                    {block.type === 'password' && (
                      <PasswordBlockView 
                        block={block}
                        onChange={(val) => updateBlock(index, val)}
                        onRemove={() => removeBlock(index)}
                      />
                    )}
                    {block.type === 'ping' && (
                      <PingBlockView 
                        block={block}
                        onChange={(val) => updateBlock(index, val)}
                        onRemove={() => removeBlock(index)}
                      />
                    )}
                    {block.type === 'job' && (
                      <JobBlockView 
                        block={block as any}
                        onChange={(val) => updateBlock(index, val)}
                        onRemove={() => removeBlock(index)}
                      />
                    )}
                    {block.type === 'schedule' && (
                      <ScheduleBlockView 
                        block={block as any}
                        onChange={(val) => updateBlock(index, val)}
                        onRemove={() => removeBlock(index)}
                      />
                    )}
                  </div>
                );
              })}
              
              {noteContent.blocks.length === 0 && (
                <p className="text-center text-stone-400 text-sm py-8 italic">No active blocks. Drag a block here from the toolbar to add it!</p>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
    </>
  );
}
