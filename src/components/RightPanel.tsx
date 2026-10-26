"use client";
import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { createHighlight, deleteHighlight } from '@/lib/data';
import { PanelRightClose, Plus, FileText, Trash2, Layers, Sparkles, Pin, PinOff, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { registerDropListener, DragBlockPayload } from '@/hooks/useDragBlock';
import { parseNoteContent, serializeNoteContent } from '@/lib/blocks';
import { isTripToGoContent, parseTripToGoContent, serializeTripToGoContent } from '@/lib/triptogo';
import { isOilTravelContent, parseOilTravelContent, serializeOilTravelContent } from '@/lib/oiltravel';
import { PasswordBlockView } from './PasswordBlockView';
import { PingBlockView } from './PingBlockView';
import { JobBlockView } from './JobBlockView';
import { ScheduleBlockView } from './ScheduleBlockView';
import { TestTemBlockView } from './TestTemBlockView';

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

      const tripParsed = parseTripToGoContent(note.content);
      const oilParsed = parseOilTravelContent(tripParsed.text);
      const noteContent = parseNoteContent(oilParsed.text);
      const isTemplate = ['template-password', 'template-ping', 'template-job', 'template-schedule', 'template-testtem'].includes(payload.id);

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
      const baseContent = serializeNoteContent(noteContent.text, newBlocks);
      let finalContent = isOilTravelContent(note.content)
        ? serializeOilTravelContent(baseContent, oilParsed.data)
        : baseContent;
      if (isTripToGoContent(note.content)) {
        finalContent = serializeTripToGoContent(finalContent, tripParsed.data);
      }

      await db.notes.update(noteId, {
        content: finalContent,
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
      return db.highlights
        .where('note_id')
        .equals(selectedNoteId)
        .reverse()
        .sortBy('created_at');
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
    const tripParsed = parseTripToGoContent(localNote.content);
    const oilParsed = parseOilTravelContent(tripParsed.text);
    const noteContent = parseNoteContent(oilParsed.text);
    const newBlocks = [...noteContent.blocks];
    const current = newBlocks[index];
    if (!current) return;

    if (current.type === 'image') {
      newBlocks[index] = { ...current, caption: val };
    } else {
      newBlocks[index] = { ...current, value: val } as any;
    }
    
    const baseContent = serializeNoteContent(noteContent.text, newBlocks);
    let finalContent = isOilTravelContent(localNote.content)
      ? serializeOilTravelContent(baseContent, oilParsed.data)
      : baseContent;
    if (isTripToGoContent(localNote.content)) {
      finalContent = serializeTripToGoContent(finalContent, tripParsed.data);
    }

    await db.notes.update(localNote.id, {
      content: finalContent,
      updated_at: Date.now()
    });
  };

  const removeBlock = async (index: number) => {
    if (!localNote || !user) return;
    const tripParsed = parseTripToGoContent(localNote.content);
    const oilParsed = parseOilTravelContent(tripParsed.text);
    const noteContent = parseNoteContent(oilParsed.text);
    const newBlocks = noteContent.blocks.filter((_, i) => i !== index);

    const baseContent = serializeNoteContent(noteContent.text, newBlocks);
    let finalContent = isOilTravelContent(localNote.content)
      ? serializeOilTravelContent(baseContent, oilParsed.data)
      : baseContent;
    if (isTripToGoContent(localNote.content)) {
      finalContent = serializeTripToGoContent(finalContent, tripParsed.data);
    }

    await db.notes.update(localNote.id, {
      content: finalContent,
      updated_at: Date.now()
    });
  };

  // Explicit block reordering: Move Up / Move Down
  const moveBlock = async (fromIndex: number, toIndex: number) => {
    if (!localNote || fromIndex === toIndex) return;
    const currentBlocks = [...noteContent.blocks];
    if (fromIndex < 0 || fromIndex >= currentBlocks.length || toIndex < 0 || toIndex >= currentBlocks.length) return;

    const [movedBlock] = currentBlocks.splice(fromIndex, 1);
    currentBlocks.splice(toIndex, 0, movedBlock);

    const baseContent = serializeNoteContent(noteContent.text, currentBlocks);
    let serialized = isOilTravelContent(localNote.content)
      ? serializeOilTravelContent(baseContent, oilParsed.data)
      : baseContent;
    if (isTripToGoContent(localNote.content)) {
      serialized = serializeTripToGoContent(serialized, tripParsed.data);
    }

    await db.notes.update(localNote.id, {
      content: serialized,
      updated_at: Date.now()
    });
  };

  const tripParsed = parseTripToGoContent(localNote?.content || '');
  const oilParsed = parseOilTravelContent(tripParsed.text);
  const noteContent = parseNoteContent(oilParsed.text);

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
        className={`w-72 sm:w-80 md:w-88 lg:w-96 max-w-[85vw] sm:max-w-none fixed md:static top-0 right-0 bottom-0 bg-white border-l border-stone-200 h-screen flex flex-col transition-all duration-300 ease-in-out shadow-xl z-40 shrink-0 ${
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
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
              {noteContent.blocks.map((block, index) => {
                const canMoveUp = index > 0;
                const canMoveDown = index < noteContent.blocks.length - 1;

                const getBlockLabel = (type: string) => {
                  switch (type) {
                    case 'password': return 'Password Box';
                    case 'ping': return 'Ping Signal';
                    case 'job': return 'Job Progress';
                    case 'schedule': return 'Work Schedule';
                    case 'testtem': return 'TestTem Template';
                    default: return 'Block';
                  }
                };

                return (
                  <div 
                    key={block.id} 
                    className="relative bg-white rounded-xl border border-stone-200/90 shadow-xs hover:border-stone-300 transition-all flex flex-col group/card overflow-hidden"
                  >
                    {/* Block Order Controls Bar */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-stone-50/90 border-b border-stone-200/60 text-xs">
                      <div className="flex items-center gap-1.5 text-stone-600 font-medium text-[11px] uppercase tracking-wider">
                        <span className="font-semibold text-stone-800">{getBlockLabel(block.type)}</span>
                        <span className="text-stone-400 font-mono text-[10px]">#{index + 1}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canMoveUp) moveBlock(index, index - 1);
                          }}
                          disabled={!canMoveUp}
                          title="Move up"
                          aria-label="Move up"
                          className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-200/80 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canMoveDown) moveBlock(index, index + 1);
                          }}
                          disabled={!canMoveDown}
                          title="Move down"
                          aria-label="Move down"
                          className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-200/80 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBlock(index);
                          }}
                          title="Delete block"
                          aria-label="Delete block"
                          className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="p-1">
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
                      {block.type === 'testtem' && (
                        <TestTemBlockView 
                          block={block as any}
                          onChange={(val) => updateBlock(index, val)}
                          onRemove={() => removeBlock(index)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              
              {noteContent.blocks.length === 0 && (
                <p className="text-center text-stone-400 text-sm py-8 italic">No active blocks. Click a block in the toolbar to add it!</p>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
    </>
  );
}
