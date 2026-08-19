"use client";
import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Snippet } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { updateNote, deleteNote } from '@/lib/data';
import { Star, Trash2, PanelRightOpen, Menu } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { parseNoteContent, serializeNoteContent, EditorBlock, ImageBlock } from '@/lib/blocks';
import { BlocksTab } from './BlocksTab';
import { ImageBlockView } from './ImageBlockView';
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
      } else {
        const localParsed = parseNoteContent(localNote.content);
        const dbParsed = parseNoteContent(dbNote.content);
        if (JSON.stringify(localParsed.blocks) !== JSON.stringify(dbParsed.blocks)) {
          setLocalNote(prev => prev ? {
            ...prev,
            content: serializeNoteContent(localParsed.text, dbParsed.blocks)
          } : null);
        }
      }
    }
  }, [selectedNoteId, dbNote, localNote]);

  useAutoSave(localNote, 1500);

  const localNoteRef = useRef(localNote);
  localNoteRef.current = localNote;

  // Pointer-based drop: register a global listener that fires when a block is dropped
  useEffect(() => {
    const unregister = registerDropListener((payload: DragBlockPayload, x: number, y: number) => {
      const current = localNoteRef.current;
      if (!current) return;

      const noteContent = parseNoteContent(current.content);

      // Give the block a fresh UUID when coming from the template
      const droppedBlock: EditorBlock = {
        id: ['template-password', 'template-ping'].includes(payload.id)
          ? crypto.randomUUID()
          : payload.id,
        type: payload.type,
        value: payload.value,
      };

      const newBlocks = [...noteContent.blocks];
      const existingIndex = newBlocks.findIndex(b => b.id === droppedBlock.id);

      if (existingIndex !== -1) {
        newBlocks[existingIndex] = droppedBlock;
      } else {
        newBlocks.push(droppedBlock);
      }

      setLocalNote({
        ...current,
        content: serializeNoteContent(noteContent.text, newBlocks)
      });
      // Automatically open side panel so user sees the block was added
      if (!isRightPanelOpen) {
        toggleRightPanel();
      }
    });
    return unregister;
  }, [isRightPanelOpen, toggleRightPanel]);

  const toggleFeatured = async () => {
    if (!localNote || !user) return;
    const updated = { ...localNote, is_featured: !localNote.is_featured };
    setLocalNote(updated);
    await updateNote(localNote.id, user.id, { is_featured: updated.is_featured });
  };

  const updateCategory = async (catId: string) => {
    if (!localNote || !user) return;
    const newCatId = catId === 'uncategorized' ? undefined : catId;
    const updated = { ...localNote, category_id: newCatId };
    setLocalNote(updated);
    await updateNote(localNote.id, user.id, { category_id: newCatId });
  };

  const handleDeleteNote = async () => {
    if (!localNote || !user) return;
    await deleteNote(localNote.id, user.id);
    setSelectedNoteId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const triggerKey = userProfile?.shortcut_trigger_key || 'Tab';
    const prefix = userProfile?.shortcut_prefix ?? '!';
    
    if (e.key === triggerKey) {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      // If there's a selection, default behavior
      if (start !== end) return;

      const noteContent = parseNoteContent(localNote!.content);
      const text = noteContent.text;
      const textBeforeCursor = text.substring(0, start);
      
      const words = textBeforeCursor.split(/\s+/);
      const lastWord = words[words.length - 1];

      if (lastWord) {
        let potentialShortcut = lastWord;
        let lastPrefixIndex = prefix ? lastWord.lastIndexOf(prefix) : 0;
        
        if (prefix === '') {
          potentialShortcut = lastWord;
        } else if (lastPrefixIndex !== -1) {
          potentialShortcut = lastWord.substring(lastPrefixIndex + prefix.length);
        } else {
          return;
        }
        
        const snippet = snippets?.find(s => s.shortcut === potentialShortcut);
        
        if (snippet) {
          e.preventDefault();
          const prefixIncluded = prefix + potentialShortcut;
          const contentBeforeWord = textBeforeCursor.substring(0, textBeforeCursor.length - prefixIncluded.length);
          const textAfterCursor = text.substring(start);
          const newText = contentBeforeWord + snippet.content + textAfterCursor;
          
          setLocalNote({ ...localNote!, content: serializeNoteContent(newText, noteContent.blocks) });
          
          setTimeout(() => {
            const newCursorPos = contentBeforeWord.length + snippet.content.length;
            target.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        }
      }
    }
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
    setLocalNote({ ...localNote, content: serializeNoteContent(content.text, newBlocks) });
  };

  const removeImageBlock = (id: string) => {
    if (!localNote) return;
    const content = parseNoteContent(localNote.content);
    const newBlocks = content.blocks.filter(b => b.id !== id);
    setLocalNote({ ...localNote, content: serializeNoteContent(content.text, newBlocks) });
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file && localNote) {
          e.preventDefault();
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
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Auto select first note if none selected
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
          <button
            onClick={toggleSidebarPin}
            title="Open Sidebar"
            className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
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

  const noteContent = parseNoteContent(localNote.content);

  // Mouse hold handlers for sidebar toggle
  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    if (!isSidebarPinned) {
      setSidebarHovered(true);
    }
  };

  const handleSidebarMouseUp = () => {
    if (!isSidebarPinned) {
      setSidebarHovered(false);
    }
  };

  // Mouse hold handlers for right panel toggle
  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!isRightPanelPinned) {
      setRightPanelHovered(true);
    }
  };

  const handleRightPanelMouseUp = () => {
    if (!isRightPanelPinned) {
      setRightPanelHovered(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col h-screen overflow-hidden bg-white">
      {/* Top Toolbar */}
      <div className="h-16 flex items-center justify-between px-3 sm:px-8 border-b border-stone-100 flex-shrink-0">
        <div className="flex items-center space-x-2">
          {!isSidebarPinned && (
            <button
              onMouseEnter={() => setSidebarHovered(true)}
              onMouseDown={handleSidebarMouseDown}
              onMouseUp={handleSidebarMouseUp}
              onClick={toggleSidebarPin}
              title="Hover/hold to preview, click to pin sidebar"
              className="p-1.5 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-md transition-all mr-1 shadow-xs active:scale-95 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <select
            value={localNote.category_id || 'uncategorized'}
            onChange={(e) => updateCategory(e.target.value)}
            className="text-xs font-medium text-stone-500 bg-transparent outline-none cursor-pointer hover:text-stone-800 transition-colors max-w-[140px] sm:max-w-none truncate"
          >
            <option value="uncategorized">Uncategorized</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 text-stone-400">
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
              title="Hover/hold to preview, click to pin right panel"
              className="p-1.5 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-md transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Content Scroll Container */}
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
              onChange={(e) => {
                setLocalNote({ ...localNote!, content: serializeNoteContent(e.target.value, noteContent.blocks) });
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePasteImage}
              placeholder="Start writing..."
              className="w-full min-h-[300px] resize-none overflow-hidden bg-transparent border-none outline-none text-stone-700 leading-relaxed font-sans"
              minRows={10}
            />

            {/* Centered Image Blocks (MS Word Style) */}
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
      
      {/* Blocks Toolbar */}
      <BlocksTab />
    </div>
  );
}
