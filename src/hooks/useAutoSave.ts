import { useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { Note } from '@/lib/db';
import { updateNote } from '@/lib/data';
import { useAuthStore } from '@/store/useStore';

/**
 * Hook to automatically save note changes to Supabase (via data.ts)
 * using a debounce strategy to avoid excessive writes.
 */
export function useAutoSave(note: Note | null, delay = 300) {
  const { user } = useAuthStore();
  
  // Track baselines (last saved state) and latest typed state by ID
  const baselinesRef = useRef<Record<string, Note>>({});
  const latestStatesRef = useRef<Record<string, Note>>({});
  const activeNoteIdRef = useRef<string | undefined>(note?.id);

  if (note) {
    if (!baselinesRef.current[note.id]) {
      baselinesRef.current[note.id] = { ...note };
    }
    latestStatesRef.current[note.id] = note;
    activeNoteIdRef.current = note.id;
  }

  // Extract flush logic to a stable, reusable function
  const flushNote = (idToFlush: string) => {
    const lastNote = latestStatesRef.current[idToFlush];
    const lastSaved = baselinesRef.current[idToFlush];
    
    if (lastNote && user && lastSaved) {
      if (
        lastNote.title !== lastSaved.title ||
        lastNote.content !== lastSaved.content ||
        lastNote.is_featured !== lastSaved.is_featured ||
        lastNote.category_id !== lastSaved.category_id
      ) {
        updateNote(lastNote.id, user.id, {
          title: lastNote.title,
          content: lastNote.content,
          is_featured: lastNote.is_featured,
          category_id: lastNote.category_id,
        }).catch(err => console.error('Flush save failed:', err));
        
        // Immediately update our prev tracker so we don't double-save
        baselinesRef.current[idToFlush] = { ...lastNote };
      }
    }
  };

  // Flush unsaved changes immediately when the user switches notes or closes the editor
  useEffect(() => {
    const id = note?.id;
    return () => {
      if (id) flushNote(id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, user]);

  // Flush unsaved changes if the user alt-tabs or minimizes the app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeNoteIdRef.current) {
        flushNote(activeNoteIdRef.current);
      }
    };
    const handleBlur = () => {
      if (activeNoteIdRef.current) {
        flushNote(activeNoteIdRef.current);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [debouncedNote] = useDebounce(note, delay, {
    equalityFn: (prev, next) => {
      if (!prev || !next) return prev === next;
      return prev.content === next.content && prev.title === next.title && prev.is_featured === next.is_featured && prev.id === next.id;
    }
  });

  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    if (debouncedNote && user) {
      flushNote(debouncedNote.id);
    }
  }, [debouncedNote, user]);
}
