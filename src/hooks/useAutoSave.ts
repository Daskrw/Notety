import { useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { db, Note } from '@/lib/db';

/**
 * Hook to automatically save note changes to the local Dexie database
 * using a debounce strategy to avoid excessive writes.
 */
export function useAutoSave(note: Note | null, delay = 1500) {
  const [debouncedNote] = useDebounce(note, delay, {
    equalityFn: (prev, next) => {
      if (!prev || !next) return prev === next;
      // Deep compare could be used, but for simplicity we compare stringified content and title
      return prev.content === next.content && prev.title === next.title && prev.isFeatured === next.isFeatured;
    }
  });
  
  const initialMount = useRef(true);

  useEffect(() => {
    // Prevent saving on initial mount
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    if (debouncedNote) {
      const saveNote = async () => {
        try {
          await db.notes.put({
            ...debouncedNote,
            updatedAt: Date.now(), // update the timestamp on save
          });
          console.log(`Auto-saved note: ${debouncedNote.title}`);
        } catch (error) {
          console.error('Failed to auto-save note:', error);
        }
      };
      
      saveNote();
    }
  }, [debouncedNote]);
}
