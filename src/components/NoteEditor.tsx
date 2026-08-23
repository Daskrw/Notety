"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Snippet } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { updateNote, deleteNote } from '@/lib/data';
import { Star, Trash2, PanelRightOpen, Menu, FileText, Map, ExternalLink, Globe } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { parseNoteContent, serializeNoteContent, EditorBlock, ImageBlock } from '@/lib/blocks';
import { BlocksTab } from './BlocksTab';
import { ImageBlockView } from './ImageBlockView';
import { TripToGoView } from './TripToGoView';
import { isTripToGoContent, parseTripToGoContent, serializeTripToGoContent, TripToGoData } from '@/lib/triptogo';
import { registerDropListener, DragBlockPayload } from '@/hooks/useDragBlock';

// Helper to extract URLs from text
function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map(u => u.startsWith('http') ? u : `https://${u}`)));
}

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

  const [viewMode, setViewMode] = useState<'standard' | 'triptogo'>('standard');

  useEffect(() => {
    if (localNote && isTripToGoContent(localNote.content)) {
      setViewMode('triptogo');
    } else {
      setViewMode('standard');
    }
  }, [localNote?.id]);

  const tripParsed = parseTripToGoContent(localNote?.content || '');
  const noteContent = parseNoteContent(tripParsed.text);
  const detectedLinks = useMemo(() => extractUrls(noteContent.text), [noteContent.text]);

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

  const isTripMode = viewMode === 'triptogo';

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
    const baseContent = serializeNoteContent(newText, noteContent.blocks);
    const serialized = isTripToGoContent(localNote.content) || viewMode === 'triptogo'
      ? serializeTripToGoContent(baseContent, tripParsed.data)
      : baseContent;
      
    setLocalNote({ ...localNote, content: serialized });
  };

  const handleTripDataChange = (newData: TripToGoData) => {
    if (!localNote) return;
    // Always preserve the current note blocks and text
    const baseContent = serializeNoteContent(noteContent.text, noteContent.blocks);
    const serialized = serializeTripToGoContent(baseContent, newData);
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
      {/* Top Toolbar */}
      <div className="min-h-14 sm:h-16 py-2 px-3 sm:px-8 flex items-center justify-between border-b border-stone-100 flex-shrink-0 bg-white/95 backdrop-blur-xs z-10 gap-2">
        <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">
          {!isSidebarPinned && (
            <button
              onMouseEnter={() => setSidebarHovered(true)}
              onMouseDown={handleSidebarMouseDown}
              onMouseUp={handleSidebarMouseUp}
              onClick={toggleSidebarPin}
              title="Toggle notes sidebar"
              className="p-2 sm:p-1.5 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-lg sm:rounded-md transition-all shrink-0 shadow-2xs active:scale-95 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <select
            value={localNote.category_id || 'uncategorized'}
            onChange={(e) => updateCategory(e.target.value)}
            className="text-xs font-medium text-stone-600 bg-stone-50 sm:bg-transparent border sm:border-transparent border-stone-200/70 rounded-md px-1.5 py-1 sm:p-0 outline-none cursor-pointer hover:text-stone-900 transition-colors max-w-[100px] xs:max-w-[130px] sm:max-w-none truncate shrink-0"
          >
            <option value="uncategorized">Uncategorized</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Mode Switcher: Note vs TripToGo */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/60 shrink-0">
            <button
              onClick={() => handleToggleMode('standard')}
              title="Standard Note Mode"
              className={`px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                !isTripMode 
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <FileText size={12} />
              <span className="hidden xs:inline">Note</span>
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

        <div className="flex items-center space-x-1 sm:space-x-3 text-stone-400 shrink-0">
          <button
            onClick={toggleFeatured}
            title="Feature this note"
            className={`p-2 rounded-full transition-colors ${localNote.is_featured ? 'text-amber-500 bg-amber-50' : 'hover:bg-stone-100'}`}
          >
            <Star className={`w-4 h-4 ${localNote.is_featured ? 'fill-amber-500' : ''}`} />
          </button>
          <button
            onClick={handleDeleteNote}
            title="Delete note"
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
              title="Toggle panel"
              className="p-2 sm:p-1.5 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-lg sm:rounded-md transition-all shadow-2xs active:scale-95 cursor-pointer"
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

            {/* Clickable Links Bar (If enabled in settings) */}
            {(userProfile?.enable_clickable_links ?? true) && detectedLinks.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap p-2.5 bg-stone-50 border border-stone-200/80 rounded-xl mb-2">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 uppercase tracking-wider shrink-0 mr-1">
                  <Globe size={13} className="text-stone-400" />
                  <span>Links:</span>
                </div>
                {detectedLinks.map((url, idx) => {
                  let display = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                  if (display.length > 35) display = display.substring(0, 32) + '...';
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 hover:border-stone-400 text-stone-800 text-xs font-medium rounded-lg transition-all shadow-2xs hover:shadow-xs group/link"
                    >
                      <span className="truncate">{display}</span>
                      <ExternalLink size={11} className="text-stone-400 group-hover/link:text-stone-700 shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}

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
