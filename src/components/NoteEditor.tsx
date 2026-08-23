"use client";
import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Snippet } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { updateNote, deleteNote } from '@/lib/data';
import { Star, Trash2, PanelRightOpen, Menu, FileText, Map } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { parseNoteContent, serializeNoteContent, EditorBlock, ImageBlock } from '@/lib/blocks';
import { BlocksTab } from './BlocksTab';
import { ImageBlockView } from './ImageBlockView';
import { TripToGoView } from './TripToGoView';
import { isTripToGoContent, parseTripToGoContent, serializeTripToGoContent, TripToGoData } from '@/lib/triptogo';
import { registerDropListener, DragBlockPayload } from '@/hooks/useDragBlock';

export function NoteEditor() {
  const { 
    selectedNoteId, setSelectedNoteId, userProfile, 
    isRightPanelOpen, isRightPanelPinned, toggleRightPanelPin, setRightPanelHovered, toggleRightPanel,
    isSidebarOpen, isSidebarPinned, toggleSidebarPin, setSidebarHovered, toggleSidebar
  } = useAppStore();
  const { user } = useAuthStore();
  const [localNote, setLocalNote] = useState<Note | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dbNote = useLiveQuery(
    () => selectedNoteId ? db.notes.get(selectedNoteId) : undefined,
    [selectedNoteId]
  );

  const categories = useLiveQuery(() => db.categories.toArray());
  const snippets = useLiveQuery(async (): Promise<Snippet[]> => db.snippets.toArray());

  useEffect(() => {
    if (!selectedNoteId) {
      setLocalNote(null);
    } else if (dbNote) {
      if (dbNote.id !== localNote?.id) {
        setLocalNote(dbNote);
      }
    }
  }, [selectedNoteId, dbNote?.id]); // Only switch when note ID changes, avoiding clobbering active edits

  useAutoSave(localNote, 400); // Responsive debounce save (400ms)

  const localNoteRef = useRef(localNote);
  localNoteRef.current = localNote;

  useEffect(() => {
    const unregister = registerDropListener((payload: DragBlockPayload, x: number, y: number) => {
      const current = localNoteRef.current;
      if (!current || !editorRef.current) return;

      const rect = editorRef.current.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

      const parsed = parseNoteContent(current.content);
      const droppedBlock: EditorBlock = {
        id: ['template-password', 'template-ping', 'template-job', 'template-schedule'].includes(payload.id)
          ? crypto.randomUUID()
          : payload.id,
        type: payload.type,
        value: payload.value,
      };

      const newBlocks = [...parsed.blocks, droppedBlock];
      setLocalNote({
        ...current,
        content: serializeNoteContent(parsed.text, newBlocks),
      });
      if (!isRightPanelOpen) {
        toggleRightPanel();
      }
    });

    return () => unregister();
  }, [isRightPanelOpen, toggleRightPanel]);

  const updateCategory = async (categoryId: string) => {
    if (!localNote || !user) return;
    const catId = categoryId === 'uncategorized' ? undefined : categoryId;
    const updated = { ...localNote, category_id: catId };
    setLocalNote(updated);
    await updateNote(localNote.id, user.id, { category_id: catId });
  };

  const toggleFeatured = async () => {
    if (!localNote || !user) return;
    const updated = { ...localNote, is_featured: !localNote.is_featured };
    setLocalNote(updated);
    await updateNote(localNote.id, user.id, { is_featured: updated.is_featured });
  };

  const handleDeleteNote = async () => {
    if (!localNote || !user) return;
    await deleteNote(localNote.id, user.id);
    setSelectedNoteId(null);
  };

  const updateImageCaption = (id: string, caption: string) => {
    if (!localNote) return;
    const content = parseNoteContent(localNote.content);
    const newBlocks = content.blocks.map(b => {
      if (b.id === id && b.type === 'image') {
        return { ...b, caption };
      }
      return b;
    });
    setLocalNote({
      ...localNote,
      content: serializeNoteContent(content.text, newBlocks)
    });
  };

  const removeImageBlock = (id: string) => {
    if (!localNote) return;
    const content = parseNoteContent(localNote.content);
    const newBlocks = content.blocks.filter(b => b.id !== id);
    setLocalNote({
      ...localNote,
      content: serializeNoteContent(content.text, newBlocks)
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === (userProfile?.shortcut_trigger_key || ' ') || e.key === 'Tab') {
      const textarea = e.currentTarget;
      const text = textarea.value;
      const cursor = textarea.selectionStart;
      const prefix = userProfile?.shortcut_prefix || '::';

      const match = text.slice(0, cursor).match(new RegExp(`${prefix}(\\w+)$`));

      if (match) {
        const keyword = match[1];
        const snippet = snippets?.find(s => s.shortcut === keyword);

        if (snippet) {
          e.preventDefault();
          const start = cursor - match[0].length;
          const newText = text.slice(0, start) + snippet.content + text.slice(cursor);
          const parsed = parseNoteContent(localNote?.content || '');
          setLocalNote({ ...localNote!, content: serializeNoteContent(newText, parsed.blocks) });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + snippet.content.length;
          }, 0);
        }
      }
    }
  };

  const handlePasteImage = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || !localNote) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) {
              const content = parseNoteContent(localNote.content);
              const newImage: ImageBlock = {
                id: crypto.randomUUID(),
                type: 'image',
                url: dataUrl,
                caption: ''
              };
              setLocalNote({
                ...localNote,
                content: serializeNoteContent(content.text, [...content.blocks, newImage])
              });
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== textareaRef.current && (e.target as HTMLElement).tagName !== 'INPUT') {
      textareaRef.current?.focus();
    }
  };

  const allNotes = useLiveQuery(() => db.notes.toArray());
  useEffect(() => {
    if (!selectedNoteId && allNotes && allNotes.length > 0) {
      const sorted = [...allNotes].sort((a, b) => b.updated_at - a.updated_at);
      setSelectedNoteId(sorted[0].id);
    }
  }, [selectedNoteId, allNotes, setSelectedNoteId]);

  if (!selectedNoteId || !localNote) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-white">
        <div className="h-16 flex items-center justify-between px-4 border-b border-stone-100 flex-shrink-0">
          <button onClick={toggleSidebarPin} className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium">
            <Menu className="w-4 h-4" />
            <span>Open Notes</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3">
          <p className="text-sm font-medium tracking-wide">Select a note to start writing</p>
        </div>
      </div>
    );
  }

  // Check if current view mode is TripToGo
  // We track user mode choice in state or derive from content
  const [viewMode, setViewMode] = useState<'standard' | 'triptogo'>('standard');

  useEffect(() => {
    if (localNote && isTripToGoContent(localNote.content)) {
      setViewMode('triptogo');
    }
  }, [localNote?.id]);

  const isTripMode = viewMode === 'triptogo';
  const tripParsed = parseTripToGoContent(localNote.content);
  const noteContent = parseNoteContent(tripParsed.text);

  const handleToggleMode = async (mode: 'standard' | 'triptogo') => {
    setViewMode(mode);
    if (!localNote) return;
    
    // Ensure content always has serialized trip data preserved
    if (mode === 'triptogo' && !isTripToGoContent(localNote.content)) {
      const serialized = serializeTripToGoContent(noteContent.text, tripParsed.data);
      const updated = { ...localNote, content: serialized };
      setLocalNote(updated);
      if (user) await updateNote(localNote.id, user.id, { content: serialized });
    }
  };

  const handleNoteTextChange = (newText: string) => {
    if (!localNote) return;
    // If note has TripToGo data, preserve it at the end of the text
    const serialized = isTripToGoContent(localNote.content) || viewMode === 'triptogo'
      ? serializeTripToGoContent(newText, tripParsed.data)
      : serializeNoteContent(newText, noteContent.blocks);
      
    setLocalNote({ ...localNote, content: serialized });
  };

  const handleTripDataChange = (newData: TripToGoData) => {
    if (!localNote) return;
    const serialized = serializeTripToGoContent(tripParsed.text, newData);
    const updated = { ...localNote, content: serialized };
    setLocalNote(updated);
    if (user) {
      updateNote(localNote.id, user.id, { content: serialized }).catch(console.error);
    }
  };

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !isSidebarPinned) setSidebarHovered(true);
  };

  const handleSidebarMouseUp = () => {
    if (!isSidebarPinned) setSidebarHovered(false);
  };

  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !isRightPanelPinned) setRightPanelHovered(true);
  };

  const handleRightPanelMouseUp = () => {
    if (!isRightPanelPinned) setRightPanelHovered(false);
  };

  return (
    <div className="relative flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <div className="h-16 flex items-center justify-between px-3 sm:px-8 border-b border-stone-100 flex-shrink-0">
        <div className="flex items-center space-x-2">
          {!isSidebarPinned && (
            <button
              onMouseEnter={() => setSidebarHovered(true)}
              onMouseDown={handleSidebarMouseDown}
              onMouseUp={handleSidebarMouseUp}
              onClick={toggleSidebarPin}
              className="p-1.5 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-md transition-all mr-1 shadow-xs active:scale-95 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <select
            value={localNote.category_id || 'uncategorized'}
            onChange={(e) => updateCategory(e.target.value)}
            className="text-xs font-medium text-stone-500 bg-transparent outline-none cursor-pointer hover:text-stone-800 transition-colors max-w-[120px] sm:max-w-none truncate"
          >
            <option value="uncategorized">Uncategorized</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/60 ml-2">
            <button
              onClick={() => handleToggleMode('standard')}
              title="Standard Note Mode"
              className={`px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                !isTripMode 
                  ? 'bg-white text-stone-900 shadow-2xs' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <FileText size={12} />
              <span className="hidden sm:inline">Note</span>
            </button>
            <button
              onClick={() => handleToggleMode('triptogo')}
              title="TripToGo Flowchart Mode"
              className={`px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                isTripMode 
                  ? 'bg-amber-500 text-white shadow-2xs font-semibold' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Map size={12} />
              <span>TripToGo</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 text-stone-400">
          <button
            onClick={toggleFeatured}
            className={`p-2 rounded-full transition-colors ${localNote.is_featured ? 'text-amber-500 bg-amber-50' : 'hover:bg-stone-100'}`}
          >
            <Star className={`w-4 h-4 ${localNote.is_featured ? 'fill-amber-500' : ''}`} />
          </button>
          <button
            onClick={handleDeleteNote}
            className="p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {!isRightPanelPinned && (
            <button
              onMouseEnter={() => setRightPanelHovered(true)}
              onMouseDown={handleRightPanelMouseDown}
              onMouseUp={handleRightPanelMouseUp}
              onClick={toggleRightPanelPin}
              className="p-1.5 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-md transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isTripMode ? (
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-stone-50/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-6">
            <input
              type="text"
              value={localNote.title}
              onChange={(e) => setLocalNote({ ...localNote, title: e.target.value })}
              placeholder="Trip Title (e.g. Tokyo 5 Days Itinerary)"
              className="w-full text-2xl sm:text-3xl font-heading font-bold text-stone-900 bg-transparent border-none outline-none placeholder:text-stone-300 mb-2 cursor-text"
            />
          </div>
          <TripToGoView
            data={tripParsed.data}
            onChange={handleTripDataChange}
          />
        </div>
      ) : (
        <div 
          key={selectedNoteId}
          ref={editorRef}
          className="flex-1 overflow-y-auto w-full custom-scrollbar cursor-text"
          onClick={handleContainerClick}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-12 flex flex-col gap-4">
            <input
              type="text"
              value={localNote.title}
              onChange={(e) => setLocalNote({ ...localNote, title: e.target.value })}
              placeholder="Note Title"
              className="w-full text-2xl sm:text-4xl font-heading font-semibold text-stone-800 bg-transparent border-none outline-none placeholder:text-stone-300 mb-4 sm:mb-8 cursor-text"
            />

            <div className="flex-1 min-h-[500px] flex flex-col pb-32">
              <TextareaAutosize
                ref={textareaRef}
                value={noteContent.text}
                onChange={(e) => handleNoteTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePasteImage}
                placeholder="Start writing..."
                className="w-full min-h-[300px] resize-none overflow-hidden bg-transparent border-none outline-none text-stone-700 leading-relaxed font-sans"
                minRows={10}
              />

              {noteContent.blocks.filter(b => b.type === 'image').map((block) => {
                const imgBlock = block as ImageBlock;
                return (
                  <ImageBlockView
                    key={imgBlock.id}
                    block={imgBlock}
                    onChange={(caption) => updateImageCaption(imgBlock.id, caption)}
                    onRemove={() => removeImageBlock(imgBlock.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {!isTripMode && <BlocksTab />}
    </div>
  );
}
