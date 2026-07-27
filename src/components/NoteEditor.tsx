"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Snippet } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { updateNote, deleteNote } from '@/lib/data';
import { Star, Trash2, PanelRightOpen } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { parseBlocks, serializeBlocks, EditorBlock } from '@/lib/blocks';
import { PasswordBlockView } from './PasswordBlockView';
import { PingBlockView } from './PingBlockView';
import { BlocksTab } from './BlocksTab';
import { registerDropListener, DragBlockPayload } from '@/hooks/useDragBlock';

export function NoteEditor() {
  const { selectedNoteId, setSelectedNoteId, userProfile, isRightPanelOpen, toggleRightPanel } = useAppStore();
  const { user } = useAuthStore();
  const [localNote, setLocalNote] = useState<Note | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const blockRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const dbNote = useLiveQuery(
    () => selectedNoteId ? db.notes.get(selectedNoteId) : undefined,
    [selectedNoteId]
  );

  const categories = useLiveQuery(() => db.categories.toArray());
  const snippets = useLiveQuery(async (): Promise<Snippet[]> => db.snippets.toArray());

  useEffect(() => {
    if (dbNote) setLocalNote(dbNote);
    else setLocalNote(null);
  }, [dbNote]);

  useAutoSave(localNote, 1500);

  // Pointer-based drop: register a global listener that fires when a block is dropped
  const localNoteRef = useRef(localNote);
  localNoteRef.current = localNote;

  useEffect(() => {
    const unregister = registerDropListener((payload: DragBlockPayload, x: number, y: number) => {
      const current = localNoteRef.current;
      if (!current) return;

      const currentBlocks = parseBlocks(current.content);

      // Give the block a fresh UUID when coming from the template
      const droppedBlock: EditorBlock = {
        id: ['template-password', 'template-ping'].includes(payload.id)
          ? crypto.randomUUID()
          : payload.id,
        type: payload.type,
        value: payload.value,
      };

      // Find which block container the drop point falls inside
      let targetIndex = currentBlocks.length - 1;
      if (blockRefsRef.current) {
        for (const [id, el] of blockRefsRef.current.entries()) {
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (y >= rect.top && y <= rect.bottom) {
            const idx = currentBlocks.findIndex(b => b.id === id);
            if (idx !== -1) { targetIndex = idx; break; }
          }
        }
      }

      const newBlocks = [...currentBlocks];
      const existingIndex = newBlocks.findIndex(b => b.id === droppedBlock.id);
      let actualTargetIndex = targetIndex;

      if (existingIndex !== -1) {
        newBlocks.splice(existingIndex, 1);
        if (existingIndex < targetIndex) actualTargetIndex -= 1;
      }

      if (actualTargetIndex < 0) actualTargetIndex = 0;
      const targetBlock = newBlocks[actualTargetIndex];

      if (targetBlock && targetBlock.type === 'text') {
        if (targetBlock.value === '') {
          newBlocks[actualTargetIndex] = droppedBlock;
          newBlocks.splice(actualTargetIndex + 1, 0, { id: crypto.randomUUID(), type: 'text', value: '' });
        } else {
          newBlocks[actualTargetIndex] = { ...targetBlock, value: targetBlock.value };
          newBlocks.splice(
            actualTargetIndex + 1,
            0,
            droppedBlock,
            { id: crypto.randomUUID(), type: 'text', value: '' }
          );
        }
      } else {
        newBlocks.splice(actualTargetIndex + 1, 0, droppedBlock, { id: crypto.randomUUID(), type: 'text', value: '' });
      }

      setLocalNote({ ...current, content: serializeBlocks(newBlocks) });
    });
    return unregister;
  }, []);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, blockIndex: number) => {
    const triggerKey = userProfile?.shortcut_trigger_key || 'Tab';
    const prefix = userProfile?.shortcut_prefix ?? '!';
    
    if (e.key === 'Backspace') {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      if (start === 0 && end === 0) {
        const blocks = parseBlocks(localNote!.content);
        const block = blocks[blockIndex];
        
        if (blockIndex > 0) {
          const prevBlock = blocks[blockIndex - 1];
          if (prevBlock.type === 'text') {
            e.preventDefault();
            const newBlocks = [...blocks];
            const prevTextLength = prevBlock.value.length;
            newBlocks[blockIndex - 1] = { ...prevBlock, value: prevBlock.value + block.value };
            newBlocks.splice(blockIndex, 1);
            setLocalNote({ ...localNote!, content: serializeBlocks(newBlocks) });
            
            setTimeout(() => {
              const prevTextarea = document.getElementById(`block-${prevBlock.id}`) as HTMLTextAreaElement;
              if (prevTextarea) {
                prevTextarea.focus();
                prevTextarea.setSelectionRange(prevTextLength, prevTextLength);
              }
            }, 0);
            return;
          } else if (block.value === '') {
            e.preventDefault();
            const newBlocks = [...blocks];
            newBlocks.splice(blockIndex, 1);
            setLocalNote({ ...localNote!, content: serializeBlocks(newBlocks) });
            return;
          }
        } else if (blockIndex === 0 && block.value === '' && blocks.length > 1) {
          e.preventDefault();
          const newBlocks = [...blocks];
          newBlocks.splice(blockIndex, 1);
          setLocalNote({ ...localNote!, content: serializeBlocks(newBlocks) });
          
          setTimeout(() => {
            const nextBlock = newBlocks[0];
            if (nextBlock.type === 'text') {
              const nextTextarea = document.getElementById(`block-${nextBlock.id}`) as HTMLTextAreaElement;
              if (nextTextarea) {
                nextTextarea.focus();
                nextTextarea.setSelectionRange(0, 0);
              }
            }
          }, 0);
          return;
        }
      }
    }

    if (e.key === 'Delete') {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      const blocks = parseBlocks(localNote!.content);
      const block = blocks[blockIndex];
      
      if (start === block.value.length && end === block.value.length) {
        if (blockIndex < blocks.length - 1) {
          const nextBlock = blocks[blockIndex + 1];
          if (nextBlock.type === 'text') {
            e.preventDefault();
            const newBlocks = [...blocks];
            const currentTextLength = block.value.length;
            newBlocks[blockIndex] = { ...block, value: block.value + nextBlock.value };
            newBlocks.splice(blockIndex + 1, 1);
            setLocalNote({ ...localNote!, content: serializeBlocks(newBlocks) });
            
            setTimeout(() => {
              const currentTextarea = document.getElementById(`block-${block.id}`) as HTMLTextAreaElement;
              if (currentTextarea) {
                currentTextarea.focus();
                currentTextarea.setSelectionRange(currentTextLength, currentTextLength);
              }
            }, 0);
            return;
          }
        }
      }
    }

    if (e.key === triggerKey) {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      // If there's a selection, default behavior
      if (start !== end) return;

      const blocks = parseBlocks(localNote!.content);
      const block = blocks[blockIndex];
      if (block.type !== 'text') return;

      const text = block.value;
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
          const contentBeforeWord = textBeforeCursor.substring(0, textBeforeCursor.length - lastWord.length);
          const prefixIncluded = prefix === '' ? '' : (lastPrefixIndex !== -1 ? lastWord.substring(0, lastPrefixIndex) : '');
          
          const newText = contentBeforeWord + prefixIncluded + snippet.content + text.substring(start);
          
          const newBlocks = [...blocks];
          newBlocks[blockIndex] = { ...block, value: newText };
          setLocalNote({ ...localNote!, content: serializeBlocks(newBlocks) });
          
          setTimeout(() => {
            const newCursorPos = contentBeforeWord.length + prefixIncluded.length + snippet.content.length;
            target.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        }
      }
    }
  };

  const blocks = localNote ? parseBlocks(localNote.content) : [];

  const updateBlock = (index: number, val: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], value: val };
    setLocalNote({ ...localNote!, content: serializeBlocks(newBlocks) });
  };

  const removeBlock = (index: number) => {
    const newBlocks = [...blocks];
    newBlocks.splice(index, 1);
    if (newBlocks.length === 0) {
      newBlocks.push({ id: crypto.randomUUID(), type: 'text', value: '' });
    }
    setLocalNote({ ...localNote!, content: serializeBlocks(newBlocks) });
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
            value={localNote.category_id || 'uncategorized'}
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
          {!isRightPanelOpen && (
            <button
              onClick={toggleRightPanel}
              title="Open highlights panel"
              className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div 
        key={selectedNoteId}
        ref={editorRef}
        className="flex-1 overflow-y-auto px-8 py-12 w-full max-w-5xl mx-auto flex flex-col gap-4 custom-scrollbar"
      >
        <input
          type="text"
          value={localNote.title}
          onChange={(e) => setLocalNote({ ...localNote, title: e.target.value })}
          placeholder="Note Title"
          className="w-full text-4xl font-heading font-semibold text-stone-800 bg-transparent border-none outline-none placeholder:text-stone-300 mb-8"
        />

        <div className="flex-1 min-h-[500px] flex flex-col gap-1 pb-32">
          {blocks.map((block, index) => (
            <div 
              key={block.id}
              ref={(el) => {
                if (el) blockRefsRef.current.set(block.id, el);
                else blockRefsRef.current.delete(block.id);
              }}
            >
              {block.type === 'text' && (
                <TextareaAutosize
                  id={`block-${block.id}`}
                  value={block.value}
                  onChange={(e) => updateBlock(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  placeholder={blocks.length === 1 ? "Start writing..." : ""}
                  className="w-full resize-none bg-transparent border-none outline-none text-stone-700 leading-relaxed font-sans custom-scrollbar"
                  minRows={1}
                />
              )}
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
            </div>
          ))}
        </div>
      </div>
      
      {/* Blocks Toolbar */}
      <BlocksTab />
    </div>
  );
}
