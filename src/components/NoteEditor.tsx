"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Snippet } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { updateNote, deleteNote } from '@/lib/data';
import { Star, Trash2, PanelRightOpen, Menu, FileText, Map, Fuel, Globe, Image as ImageIcon, Loader2, Code2 } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { parseNoteContent, serializeNoteContent, EditorBlock, ImageBlock } from '@/lib/blocks';
import { BlocksTab } from './BlocksTab';
import { ImageBlockView } from './ImageBlockView';
import { TripToGoView } from './TripToGoView';
import { isTripToGoContent, parseTripToGoContent, serializeTripToGoContent, TripToGoData } from '@/lib/triptogo';
import { OilTravelView } from './OilTravelView';
import { isOilTravelContent, parseOilTravelContent, serializeOilTravelContent, OilTravelData } from '@/lib/oiltravel';
import { registerDropListener, DragBlockPayload } from '@/hooks/useDragBlock';
import { DocumentImageView } from './DocumentImageView';
import { BrowserModeView } from './BrowserModeView';
import { nativeHideAll, loadSavedBrowserState, nativePauseMedia } from '@/lib/browser';
import { 
  saveImageAsset, 
  validateImageFile, 
  formatImageMarkdown, 
  splitTextIntoSegments, 
  reconstructTextFromSegments, 
  deleteAssetIfOrphaned,
  ParsedImageToken, 
  DocumentSegment 
} from '@/lib/assets';

// Types for inline link tokenization
export interface TextToken {
  type: 'text';
  value: string;
  start: number;
  end: number;
}

export interface LinkToken {
  type: 'link';
  text: string;
  url: string;
  raw: string;
  start: number;
  end: number;
}

export type InlineToken = TextToken | LinkToken;

// Helper to separate trailing sentence punctuation from URLs
function cleanUrlAndTrailingPunctuation(rawUrl: string): { url: string; trailing: string } {
  const trailingPunctuationRegex = /[.,!?:;)\]}’"'>]+$/;
  const match = rawUrl.match(trailingPunctuationRegex);
  if (match) {
    const trailing = match[0];
    const url = rawUrl.slice(0, rawUrl.length - trailing.length);
    return { url, trailing };
  }
  return { url: rawUrl, trailing: '' };
}

// Tokenize text into regular text and inline hyperlinks (markdown [text](url) and bare URLs)
export function tokenizeInlineLinks(text: string): InlineToken[] {
  if (!text) return [];

  const regex = /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^\s\)]+|[^\s\)]+)\)|((?:https?:\/\/|www\.)[^\s<>"'()]+)/gi;
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: text.slice(lastIndex, match.index),
        start: lastIndex,
        end: match.index,
      });
    }

    if (match[1] && match[2]) {
      const linkText = match[1];
      let url = match[2].trim();
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
        url = 'https://' + url;
      }
      tokens.push({
        type: 'link',
        text: linkText,
        url,
        raw: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
      lastIndex = regex.lastIndex;
    } else if (match[3]) {
      const rawUrl = match[3];
      const { url: cleanedUrl } = cleanUrlAndTrailingPunctuation(rawUrl);
      
      let finalUrl = cleanedUrl;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }

      tokens.push({
        type: 'link',
        text: cleanedUrl,
        url: finalUrl,
        raw: cleanedUrl,
        start: match.index,
        end: match.index + cleanedUrl.length,
      });

      lastIndex = match.index + cleanedUrl.length;
      regex.lastIndex = lastIndex;
    }
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      value: text.slice(lastIndex),
      start: lastIndex,
      end: text.length,
    });
  }

  return tokens;
}

// Safely open URL in Tauri desktop or web browser via operating system default browser
export async function openExternalUrl(url: string, e?: React.MouseEvent) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  let cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl) && !cleanUrl.startsWith('/')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  // Validate protocol to prevent dangerous URI schemes
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return;
  }
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (isTauri()) {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      // Delegated to operating system default URL handler (Edge, Chrome, etc.)
      await openUrl(cleanUrl);
      return;
    }
  } catch (err) {
    console.warn('Tauri openUrl error, falling back to window.open:', err);
  }
  window.open(cleanUrl, '_blank', 'noopener,noreferrer');
}

// Subcomponent for the live formatted text overlay
function LiveFormattedOverlay({ text, isFirstAndEmpty }: { text: string; isFirstAndEmpty?: boolean }) {
  const inlineTokens = useMemo(() => tokenizeInlineLinks(text), [text]);

  return (
    <div 
      aria-hidden="true" 
      className="absolute inset-0 w-full h-full text-stone-700 leading-relaxed font-sans text-base font-normal whitespace-pre-wrap break-words pointer-events-none p-0 m-0 border-none outline-none select-none"
      style={{ 
        wordBreak: 'break-word', 
        overflowWrap: 'break-word',
        letterSpacing: 'normal',
        boxSizing: 'border-box',
        fontVariantLigatures: 'none',
      }}
    >
      {inlineTokens.length > 0 ? (
        inlineTokens.map((token, idx) => {
          if (token.type === 'text') {
            return <span key={idx}>{token.value}</span>;
          }
          return (
            <a
              key={idx}
              href={token.url}
              onClick={(e) => {
                openExternalUrl(token.url, e);
              }}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${token.url}`}
              className="pointer-events-auto text-blue-600 hover:text-blue-800 underline underline-offset-2 font-normal cursor-pointer transition-colors inline"
            >
              {token.text}
            </a>
          );
        })
      ) : isFirstAndEmpty ? (
        <span className="text-stone-300">Start writing...</span>
      ) : null}
      {text.endsWith('\n') ? ' ' : ''}
    </div>
  );
}

export function NoteEditor() {
  const { 
    selectedNoteId, setSelectedNoteId, userProfile, 
    isRightPanelOpen, isRightPanelPinned, toggleRightPanelPin, setRightPanelHovered, toggleRightPanel,
    isSidebarOpen, isSidebarPinned, toggleSidebarPin, setSidebarHovered, toggleSidebar,
    appMode, setAppMode,
  } = useAppStore();
  const { user } = useAuthStore();
  const [localNote, setLocalNote] = useState<Note | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarFileInputRef = useRef<HTMLInputElement>(null);

  // Track active cursor position for image insertion
  const activeCursorRef = useRef<{ segmentIndex: number; cursor: number }>({ segmentIndex: 0, cursor: 0 });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragOverEditor, setIsDragOverEditor] = useState(false);

  const dbNote = useLiveQuery(
    () => selectedNoteId ? db.notes.get(selectedNoteId) : undefined,
    [selectedNoteId]
  );

  const categories = useLiveQuery(() => db.categories.toArray());
  const snippets = useLiveQuery(async (): Promise<Snippet[]> => db.snippets.toArray());

  useEffect(() => {
    if (!selectedNoteId) {
      setLocalNote(null);
      return;
    }
    if (!dbNote) return;

    // First load or note switch — take dbNote wholesale
    if (dbNote.id !== localNote?.id) {
      setLocalNote(dbNote);
      return;
    }

    // Same note — check if blocks were modified externally (by RightPanel/BlocksTab)
    if (localNote && dbNote.content !== localNote.content) {
      const dbTripParsed = parseTripToGoContent(dbNote.content);
      const dbOilParsed = parseOilTravelContent(dbTripParsed.text);
      const dbParsed = parseNoteContent(dbOilParsed.text);

      const localTripParsed = parseTripToGoContent(localNote.content);
      const localOilParsed = parseOilTravelContent(localTripParsed.text);
      const localParsed = parseNoteContent(localOilParsed.text);

      const dbBlocksJson = JSON.stringify(dbParsed.blocks);
      const localBlocksJson = JSON.stringify(localParsed.blocks);
      
      if (dbBlocksJson !== localBlocksJson) {
        const mergedBase = serializeNoteContent(localParsed.text, dbParsed.blocks);
        let mergedContent = isOilTravelContent(localNote.content)
          ? serializeOilTravelContent(mergedBase, localOilParsed.data)
          : mergedBase;
        if (isTripToGoContent(localNote.content)) {
          mergedContent = serializeTripToGoContent(mergedContent, localTripParsed.data);
        }
        setLocalNote({ ...localNote, content: mergedContent });
      }
    }
  }, [selectedNoteId, dbNote]);

  useAutoSave(localNote, 400); // Responsive debounce save (400ms)

  const localNoteRef = useRef(localNote);
  localNoteRef.current = localNote;

  useEffect(() => {
    const unregister = registerDropListener((payload: DragBlockPayload, x: number, y: number) => {
      const current = localNoteRef.current;
      if (!current || !editorRef.current) return;

      const rect = editorRef.current.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

      const tripParsed = parseTripToGoContent(current.content);
      const oilParsed = parseOilTravelContent(tripParsed.text);
      const parsed = parseNoteContent(oilParsed.text);

      const isTemplate = ['template-password', 'template-ping', 'template-job', 'template-schedule', 'template-testtem'].includes(payload.id);
      if (!isTemplate && parsed.blocks.some(b => b.id === payload.id)) {
        return;
      }

      const droppedBlock: EditorBlock = {
        id: isTemplate ? crypto.randomUUID() : payload.id,
        type: payload.type,
        value: payload.value,
      };

      const newBlocks = [...parsed.blocks, droppedBlock];
      const baseContent = serializeNoteContent(parsed.text, newBlocks);
      let finalContent = isOilTravelContent(current.content)
        ? serializeOilTravelContent(baseContent, oilParsed.data)
        : baseContent;
      if (isTripToGoContent(current.content)) {
        finalContent = serializeTripToGoContent(finalContent, tripParsed.data);
      }

      setLocalNote({
        ...current,
        content: finalContent,
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
    const tripParsed = parseTripToGoContent(localNote.content);
    const oilParsed = parseOilTravelContent(tripParsed.text);
    const content = parseNoteContent(oilParsed.text);
    const newBlocks = content.blocks.map(b => {
      if (b.id === id && b.type === 'image') {
        return { ...b, caption };
      }
      return b;
    });
    const baseContent = serializeNoteContent(content.text, newBlocks);
    let finalContent = isOilTravelContent(localNote.content)
      ? serializeOilTravelContent(baseContent, oilParsed.data)
      : baseContent;
    if (isTripToGoContent(localNote.content)) {
      finalContent = serializeTripToGoContent(finalContent, tripParsed.data);
    }
    setLocalNote({
      ...localNote,
      content: finalContent
    });
  };

  const removeImageBlock = (id: string) => {
    if (!localNote) return;
    const tripParsed = parseTripToGoContent(localNote.content);
    const oilParsed = parseOilTravelContent(tripParsed.text);
    const content = parseNoteContent(oilParsed.text);
    const newBlocks = content.blocks.filter(b => b.id !== id);
    const baseContent = serializeNoteContent(content.text, newBlocks);
    let finalContent = isOilTravelContent(localNote.content)
      ? serializeOilTravelContent(baseContent, oilParsed.data)
      : baseContent;
    if (isTripToGoContent(localNote.content)) {
      finalContent = serializeTripToGoContent(finalContent, tripParsed.data);
    }
    setLocalNote({
      ...localNote,
      content: finalContent
    });
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      const firstTextarea = editorRef.current?.querySelector('textarea');
      firstTextarea?.focus();
    }
  };

  const allNotes = useLiveQuery(() => db.notes.toArray());
  useEffect(() => {
    if (!selectedNoteId && allNotes && allNotes.length > 0) {
      const sorted = [...allNotes].sort((a, b) => b.updated_at - a.updated_at);
      setSelectedNoteId(sorted[0].id);
    }
  }, [selectedNoteId, allNotes, setSelectedNoteId]);

  const [viewMode, setViewMode] = useState<'standard' | 'triptogo' | 'oiltravel' | 'browser'>('standard');

  // When switching notes, always open in standard Notes mode by default
  useEffect(() => {
    setViewMode('standard');
  }, [localNote?.id]);



  // Sync viewMode when appMode is switched back to notes
  useEffect(() => {
    if (appMode === 'notes' && viewMode === 'browser') {
      setViewMode('standard');
      try {
        const saved = loadSavedBrowserState();
        nativeHideAll(saved.tabs.map(t => t.id));
      } catch {}
    }
  }, [appMode, viewMode]);

  const tripParsed = parseTripToGoContent(localNote?.content || '');
  const oilParsed = parseOilTravelContent(tripParsed.text);
  const noteContent = parseNoteContent(oilParsed.text);

  // Split document into alternating text and document-style image segments
  const documentSegments = useMemo(() => splitTextIntoSegments(noteContent.text), [noteContent.text]);

  const handleToggleMode = async (mode: 'standard' | 'triptogo' | 'oiltravel' | 'browser') => {
    if (mode === 'browser') {
      setAppMode('browser');
    } else {
      setAppMode('notes');
    }
    setViewMode(mode);
    if (mode !== 'browser') {
      const saved = loadSavedBrowserState();
      nativeHideAll(saved.tabs.map(t => t.id));
    }
    if (!localNote) return;
    
    if (mode === 'triptogo' && !isTripToGoContent(localNote.content)) {
      const baseContent = serializeNoteContent(noteContent.text, noteContent.blocks);
      let contentWithOil = isOilTravelContent(localNote.content)
        ? serializeOilTravelContent(baseContent, oilParsed.data)
        : baseContent;
      const serialized = serializeTripToGoContent(contentWithOil, tripParsed.data);
      const updated = { ...localNote, content: serialized };
      setLocalNote(updated);
      if (user) await updateNote(localNote.id, user.id, { content: serialized });
    } else if (mode === 'oiltravel' && !isOilTravelContent(localNote.content)) {
      const baseContent = serializeNoteContent(noteContent.text, noteContent.blocks);
      let serialized = serializeOilTravelContent(baseContent, oilParsed.data);
      if (isTripToGoContent(localNote.content)) {
        serialized = serializeTripToGoContent(serialized, tripParsed.data);
      }
      const updated = { ...localNote, content: serialized };
      setLocalNote(updated);
      if (user) await updateNote(localNote.id, user.id, { content: serialized });
    }
  };

  const handleNoteTextChange = (newText: string) => {
    if (!localNote) return;
    const baseContent = serializeNoteContent(newText, noteContent.blocks);
    let serialized = isOilTravelContent(localNote.content) || viewMode === 'oiltravel'
      ? serializeOilTravelContent(baseContent, oilParsed.data)
      : baseContent;
    if (isTripToGoContent(localNote.content) || viewMode === 'triptogo') {
      serialized = serializeTripToGoContent(serialized, tripParsed.data);
    }
      
    setLocalNote({ ...localNote, content: serialized });
  };

  // Updates text within a specific document segment
  const handleSegmentTextChange = (segIdx: number, newSegmentText: string) => {
    const nextSegments = [...documentSegments];
    if (nextSegments[segIdx]?.type === 'text') {
      nextSegments[segIdx] = { ...nextSegments[segIdx], text: newSegmentText };
      const reconstructed = reconstructTextFromSegments(nextSegments);
      handleNoteTextChange(reconstructed);
    }
  };

  // Updates an image token (width, align, caption) within a document segment
  const handleUpdateImageSegment = (segIdx: number, updated: Partial<ParsedImageToken>) => {
    const nextSegments = [...documentSegments];
    const target = nextSegments[segIdx];
    if (target?.type === 'image') {
      nextSegments[segIdx] = {
        ...target,
        token: { ...target.token, ...updated }
      };
      const reconstructed = reconstructTextFromSegments(nextSegments);
      handleNoteTextChange(reconstructed);
    }
  };

  // Deletes an image segment, preserving all surrounding text
  const handleDeleteImageSegment = (segIdx: number) => {
    const target = documentSegments[segIdx];
    const assetId = target?.type === 'image' ? target.token.assetId : undefined;
    const nextSegments = [...documentSegments];
    nextSegments.splice(segIdx, 1);
    const reconstructed = reconstructTextFromSegments(nextSegments);
    handleNoteTextChange(reconstructed);
    if (assetId) {
      deleteAssetIfOrphaned(assetId, user?.id).catch((err) => console.warn('Clean asset error:', err));
    }
  };

  // Replaces an image file in-place within a document segment
  const handleReplaceImageSegment = async (segIdx: number, file: File) => {
    setIsUploadingImage(true);
    try {
      const oldTarget = documentSegments[segIdx];
      const oldAssetId = oldTarget?.type === 'image' ? oldTarget.token.assetId : undefined;
      const newAssetId = await saveImageAsset(file, user?.id);
      const nextSegments = [...documentSegments];
      const target = nextSegments[segIdx];
      if (target?.type === 'image') {
        nextSegments[segIdx] = {
          ...target,
          token: { ...target.token, assetId: newAssetId }
        };
        const reconstructed = reconstructTextFromSegments(nextSegments);
        handleNoteTextChange(reconstructed);
        if (oldAssetId && oldAssetId !== newAssetId) {
          deleteAssetIfOrphaned(oldAssetId, user?.id).catch((err) => console.warn('Clean asset error:', err));
        }
      }
    } catch (err: any) {
      alert(err?.message || 'ไม่สามารถเปลี่ยนรูปภาพได้');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Core handler: inserts an image file at the exact cursor position or target segment
  const handleInsertImageFile = async (
    file: File | Blob, 
    cursorTarget?: { segmentIndex: number; cursor: number }
  ) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setIsUploadingImage(true);
    try {
      const assetId = await saveImageAsset(file, user?.id);
      const imgMarkdown = `\n\n${formatImageMarkdown(assetId, '', 540, 'center')}\n\n`;

      const currentSegments = splitTextIntoSegments(noteContent.text);
      const targetIdx = cursorTarget?.segmentIndex ?? Math.max(0, currentSegments.length - 1);
      const targetSeg = currentSegments[targetIdx];

      if (targetSeg && targetSeg.type === 'text') {
        const cursor = Math.max(0, Math.min(targetSeg.text.length, cursorTarget?.cursor ?? targetSeg.text.length));
        const before = targetSeg.text.slice(0, cursor);
        const after = targetSeg.text.slice(cursor);
        targetSeg.text = before + imgMarkdown + after;
      } else {
        // Fallback: append image to the document
        const lastSeg = currentSegments[currentSegments.length - 1];
        if (lastSeg && lastSeg.type === 'text') {
          lastSeg.text += imgMarkdown;
        } else {
          currentSegments.push({
            type: 'text',
            text: imgMarkdown,
            id: `seg-append-${Date.now()}`
          });
        }
      }

      const reconstructed = reconstructTextFromSegments(currentSegments);
      handleNoteTextChange(reconstructed);
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการแทรกรูปภาพ');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Toolbar button triggers file picker
  const handleToolbarInsertImage = () => {
    toolbarFileInputRef.current?.click();
  };

  const handleToolbarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleInsertImageFile(file, activeCursorRef.current);
      // Reset input value so the same file can be chosen again if needed
      e.target.value = '';
    }
  };

  // Clipboard paste: handles pasting screenshot or copied image file directly into note at cursor
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>, segIdx: number) => {
    const items = e.clipboardData?.items;
    if (!items || !localNote) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const cursor = e.currentTarget.selectionStart;
          await handleInsertImageFile(file, { segmentIndex: segIdx, cursor });
          return;
        }
      }
    }
  };

  // Drag and Drop: handles dropping image files from Windows File Explorer onto the editor
  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOverEditor(false);

    // If dragging blocks internally, let registerDropListener handle it
    if (e.dataTransfer.types.includes('application/x-quietnotes-block')) {
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          await handleInsertImageFile(file, activeCursorRef.current);
          break;
        }
      }
    }
  };

  const handleEditorDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOverEditor(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, segIdx: number) => {
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
          handleSegmentTextChange(segIdx, newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + snippet.content.length;
          }, 0);
        }
      }
    }
  };

  const handleTripDataChange = (newData: TripToGoData) => {
    if (!localNote) return;
    let baseContent = serializeNoteContent(noteContent.text, noteContent.blocks);
    if (isOilTravelContent(localNote.content)) {
      baseContent = serializeOilTravelContent(baseContent, oilParsed.data);
    }
    const serialized = serializeTripToGoContent(baseContent, newData);
    const updated = { ...localNote, content: serialized };
    setLocalNote(updated);
    if (user) {
      updateNote(localNote.id, user.id, { content: serialized }).catch(console.error);
    }
  };

  const handleOilTravelDataChange = (newData: OilTravelData) => {
    if (!localNote) return;
    const baseContent = serializeNoteContent(noteContent.text, noteContent.blocks);
    let serialized = serializeOilTravelContent(baseContent, newData);
    if (isTripToGoContent(localNote.content)) {
      serialized = serializeTripToGoContent(serialized, tripParsed.data);
    }
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

  const isTripMode = viewMode === 'triptogo';
  const isOilMode = viewMode === 'oiltravel';
  const isDevtoolActive = appMode === 'browser' || viewMode === 'browser';

  return (
    <>
      {/* Devtool View - Kept permanently mounted to preserve tabs, alive WebView instances, and playback position */}
      <div className={isDevtoolActive ? "relative flex-1 flex flex-col h-screen overflow-hidden bg-white" : "hidden"}>
        <div className="min-h-14 sm:h-16 py-2 px-3 sm:px-6 lg:px-8 flex items-center justify-between border-b border-stone-100 flex-shrink-0 bg-white/95 backdrop-blur-xs z-10 gap-1.5 sm:gap-3 flex-wrap">
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0 flex-1 flex-wrap py-0.5">
            {!isSidebarPinned && (
              <button onClick={toggleSidebarPin} title="Toggle notes sidebar" className="p-1.5 sm:p-2 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-lg transition-all shrink-0 shadow-2xs active:scale-95 cursor-pointer">
                <Menu className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/60 shrink-0">
              <button
                onClick={() => handleToggleMode('standard')}
                title="Standard Note Mode"
                className="px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all text-stone-500 hover:text-stone-800"
              >
                <FileText size={12} />
                <span className="inline">Note</span>
              </button>
              <button
                onClick={() => handleToggleMode('triptogo')}
                title="TripToGo Flowchart Mode"
                className="px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all text-stone-500 hover:text-stone-800"
              >
                <Map size={12} />
                <span className="inline">TripToGo</span>
              </button>
              <button
                onClick={() => handleToggleMode('oiltravel')}
                title="Oil Travel Mode"
                className="px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all text-stone-500 hover:text-stone-800"
              >
                <Fuel size={12} />
                <span className="inline">Oil Travel</span>
              </button>
              <button
                onClick={() => handleToggleMode('browser')}
                title="Multi-Tab Devtool Mode"
                className="px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all bg-blue-600 text-white shadow-2xs font-semibold"
              >
                <Code2 size={12} />
                <span className="inline">Devtool</span>
              </button>
            </div>
          </div>
        </div>
        <BrowserModeView isActive={isDevtoolActive} />
      </div>

      {/* Notes View - Shown when not in Devtool */}
      <div className={!isDevtoolActive ? "relative flex-1 flex flex-col h-screen overflow-hidden bg-white" : "hidden"}>
        {!selectedNoteId || !localNote ? (
          <div className="flex-1 flex flex-col h-screen bg-white">
            <div className="h-16 flex items-center justify-between px-4 border-b border-stone-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button onClick={toggleSidebarPin} className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium">
                  <Menu className="w-4 h-4" />
                  <span>Open Notes</span>
                </button>
              </div>
              <button 
                onClick={() => handleToggleMode('browser')} 
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Open Devtool Mode</span>
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3">
              <p className="text-sm font-medium tracking-wide">Select a note to start writing</p>
              <button 
                onClick={() => handleToggleMode('browser')}
                className="mt-2 px-4 py-2 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-xl text-xs font-medium flex items-center gap-2 transition-all hover:shadow-xs"
              >
                <Code2 className="w-4 h-4 text-blue-500" />
                <span>Launch Devtool</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 flex flex-col h-screen overflow-hidden bg-white">
            {/* Top Toolbar - Fully Responsive */}
      <div className="min-h-14 sm:h-16 py-2 px-3 sm:px-6 lg:px-8 flex items-center justify-between border-b border-stone-100 flex-shrink-0 bg-white/95 backdrop-blur-xs z-10 gap-1.5 sm:gap-3 flex-wrap">
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0 flex-1 flex-wrap py-0.5">
          {!isSidebarPinned && (
            <button
              onMouseEnter={() => setSidebarHovered(true)}
              onMouseDown={handleSidebarMouseDown}
              onMouseUp={handleSidebarMouseUp}
              onClick={toggleSidebarPin}
              title="Toggle notes sidebar"
              className="p-1.5 sm:p-2 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-lg transition-all shrink-0 shadow-2xs active:scale-95 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <select
            value={localNote.category_id || 'uncategorized'}
            onChange={(e) => updateCategory(e.target.value)}
            className="text-xs font-medium text-stone-600 bg-stone-50 sm:bg-transparent border sm:border-transparent border-stone-200/70 rounded-lg px-2 py-1 sm:p-0 outline-none cursor-pointer hover:text-stone-900 transition-colors max-w-[110px] sm:max-w-[150px] md:max-w-none truncate shrink-0"
          >
            <option value="uncategorized">Uncategorized</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Mode Switcher: Note vs TripToGo vs Oil Travel */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/60 shrink-0">
            <button
              onClick={() => handleToggleMode('standard')}
              title="Standard Note Mode"
              className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                viewMode === 'standard'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <FileText size={12} />
              <span className="inline">Note</span>
            </button>
            <button
              onClick={() => handleToggleMode('triptogo')}
              title="TripToGo Flowchart Mode"
              className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                viewMode === 'triptogo' 
                  ? 'bg-amber-500 text-white shadow-2xs font-semibold' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Map size={12} />
              <span className="inline">TripToGo</span>
            </button>
            <button
              onClick={() => handleToggleMode('oiltravel')}
              title="Oil Travel Mode"
              className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                viewMode === 'oiltravel'
                  ? 'bg-orange-500 text-white shadow-2xs font-semibold' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Fuel size={12} />
              <span className="inline">Oil Travel</span>
            </button>
            <button
              onClick={() => handleToggleMode('browser')}
              title="Multi-Tab Devtool Mode"
              className="px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all text-stone-500 hover:text-stone-800"
            >
              <Code2 size={12} />
              <span className="inline">Devtool</span>
            </button>
          </div>

          {/* Document Image Insertion Toolbar Button */}
          {viewMode === 'standard' && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleToolbarInsertImage}
                disabled={isUploadingImage}
                title="Insert image at cursor position (แทรกรูปภาพที่ตำแหน่งเคอร์เซอร์)"
                className="px-2 sm:px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-200/80 bg-stone-50 hover:bg-stone-100 hover:text-stone-900 text-stone-700 transition-all flex items-center gap-1.5 shrink-0 shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isUploadingImage ? (
                  <Loader2 size={13} className="animate-spin text-blue-600" />
                ) : (
                  <ImageIcon size={13} className="text-stone-600" />
                )}
                <span className="hidden sm:inline">{isUploadingImage ? 'Inserting...' : 'Image'}</span>
              </button>
              <input
                ref={toolbarFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleToolbarFileSelected}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 text-stone-400 shrink-0">
          <button
            onClick={toggleFeatured}
            title="Feature this note"
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${localNote.is_featured ? 'text-amber-500 bg-amber-50' : 'hover:bg-stone-100'}`}
          >
            <Star className={`w-4 h-4 ${localNote.is_featured ? 'fill-amber-500' : ''}`} />
          </button>
          <button
            onClick={handleDeleteNote}
            title="Delete note"
            className="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
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
              className="p-1.5 sm:p-2 text-stone-500 hover:text-stone-900 bg-stone-100/80 hover:bg-stone-200/80 border border-stone-200/60 rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isOilMode ? (
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-stone-50/40">
          <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
            <input
              type="text"
              value={localNote.title}
              onChange={(e) => setLocalNote({ ...localNote, title: e.target.value })}
              placeholder="Fuel Log Title (e.g. 2026 Vehicle Refill Log)"
              className="w-full text-xl sm:text-2xl md:text-3xl font-heading font-bold text-stone-900 bg-transparent border-none outline-none placeholder:text-stone-300 mb-2 cursor-text"
            />
          </div>
          <OilTravelView
            data={oilParsed.data}
            onChange={handleOilTravelDataChange}
          />
        </div>
      ) : isTripMode ? (
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-stone-50/40">
          <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
            <input
              type="text"
              value={localNote.title}
              onChange={(e) => setLocalNote({ ...localNote, title: e.target.value })}
              placeholder="Trip Title (e.g. Tokyo 5 Days Itinerary)"
              className="w-full text-xl sm:text-2xl md:text-3xl font-heading font-bold text-stone-900 bg-transparent border-none outline-none placeholder:text-stone-300 mb-2 cursor-text"
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
          onDrop={handleEditorDrop}
          onDragOver={handleEditorDragOver}
          onDragLeave={() => setIsDragOverEditor(false)}
          className={`flex-1 overflow-y-auto w-full custom-scrollbar cursor-text transition-all ${
            isDragOverEditor ? 'bg-blue-50/30 ring-2 ring-blue-400 ring-inset' : ''
          }`}
          onClick={handleContainerClick}
        >
          <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 flex flex-col gap-4">
            <input
              type="text"
              value={localNote.title}
              onChange={(e) => setLocalNote({ ...localNote, title: e.target.value })}
              placeholder="Note Title"
              className="w-full text-2xl sm:text-3xl md:text-4xl font-heading font-semibold text-stone-800 bg-transparent border-none outline-none placeholder:text-stone-300 mb-2 sm:mb-6 cursor-text"
            />

            <div className="flex-1 min-h-[500px] flex flex-col pb-32">
              {/* Document Flow: Render Text & In-Place Document Images */}
              {documentSegments.map((segment, segIdx) => {
                if (segment.type === 'text') {
                  const isFirstAndEmpty = segIdx === 0 && documentSegments.length === 1 && !segment.text;
                  return (
                    <div key={segment.id} className="relative w-full min-h-[40px] my-1">
                      {/* Layer 1: Native Textarea (receives all normal typing and clicks) */}
                      <TextareaAutosize
                        value={segment.text}
                        onChange={(e) => handleSegmentTextChange(segIdx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, segIdx)}
                        onPaste={(e) => handlePaste(e, segIdx)}
                        onSelect={(e) => {
                          activeCursorRef.current = { segmentIndex: segIdx, cursor: e.currentTarget.selectionStart };
                        }}
                        onClick={(e) => {
                          activeCursorRef.current = { segmentIndex: segIdx, cursor: e.currentTarget.selectionStart };
                        }}
                        className="w-full resize-none overflow-hidden bg-transparent border-none outline-none text-transparent caret-stone-800 leading-relaxed font-sans text-base font-normal whitespace-pre-wrap break-words p-0 m-0 selection:bg-blue-200/40 selection:text-transparent"
                        style={{ 
                          wordBreak: 'break-word', 
                          overflowWrap: 'break-word',
                          letterSpacing: 'normal',
                          boxSizing: 'border-box',
                          fontVariantLigatures: 'none',
                        }}
                        minRows={segIdx === 0 && documentSegments.length === 1 ? 10 : 2}
                      />

                      {/* Layer 2: Live Synchronized Formatted Overlay */}
                      <LiveFormattedOverlay 
                        text={segment.text} 
                        isFirstAndEmpty={isFirstAndEmpty} 
                      />
                    </div>
                  );
                } else {
                  return (
                    <DocumentImageView
                      key={segment.id}
                      token={segment.token}
                      userId={user?.id}
                      onUpdate={(updated) => handleUpdateImageSegment(segIdx, updated)}
                      onDelete={() => handleDeleteImageSegment(segIdx)}
                      onReplace={(file) => handleReplaceImageSegment(segIdx, file)}
                    />
                  );
                }
              })}

              {/* Legacy blocks image support */}
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
        )}
      </div>
    </>
  );
}
