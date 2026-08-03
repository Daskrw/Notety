/**
 * data.ts — Centralized, Resilient Local-First Data Layer.
 *
 * All writes update Dexie IndexedDB FIRST (0ms latency, 100% offline persistence).
 * Background async sync sends updates to Supabase without blocking the UI or throwing
 * unhandled exceptions when network or database is slow/offline.
 */
import { supabase } from './supabase';
import { db, Note, Category, Snippet, Highlight } from './db';

// Helper for safe background Supabase sync
async function safeSupabaseSync(fn: () => PromiseLike<any>, label: string) {
  try {
    const res = await fn();
    if (res && res.error) {
      console.warn(`Supabase ${label} warning:`, res.error.message);
    }
  } catch (err) {
    console.warn(`Supabase ${label} network offline:`, err);
  }
}

// ─────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────

export async function createNote(userId: string, data?: Partial<Note>): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const note: Note = {
    id,
    title: '',
    content: '',
    is_featured: false,
    created_at: now,
    updated_at: now,
    user_id: userId,
    ...data,
  };

  // 1. Save to local Dexie immediately (guaranteed 0ms local storage)
  await db.notes.put(note);

  // 2. Sync to Supabase in background
  safeSupabaseSync(
    () => supabase.from('notes').insert({
      id: note.id,
      title: note.title,
      content: note.content,
      is_featured: note.is_featured,
      category_id: note.category_id ?? null,
      created_at: note.created_at,
      updated_at: note.updated_at,
      user_id: userId,
    }),
    'createNote'
  );

  return id;
}

export async function updateNote(id: string, userId: string, changes: Partial<Note>): Promise<void> {
  const now = Date.now();

  // 1. Save to local Dexie immediately
  await db.notes.update(id, { ...changes, updated_at: now });

  // 2. Sync payload to Supabase in background
  const payload: Record<string, unknown> = {
    updated_at: now,
  };

  if ('title' in changes) payload.title = changes.title;
  if ('content' in changes) payload.content = changes.content;
  if ('is_featured' in changes) payload.is_featured = changes.is_featured;
  if ('category_id' in changes) payload.category_id = changes.category_id ?? null;

  safeSupabaseSync(
    () => supabase.from('notes').update(payload).eq('id', id).eq('user_id', userId),
    'updateNote'
  );
}

export async function deleteNote(id: string, userId: string): Promise<void> {
  // 1. Delete from local Dexie immediately
  await db.highlights.where('note_id').equals(id).delete();
  await db.notes.delete(id);

  // 2. Sync deletion to Supabase in background
  safeSupabaseSync(() => supabase.from('highlights').delete().eq('note_id', id).eq('user_id', userId), 'deleteHighlights');
  safeSupabaseSync(() => supabase.from('notes').delete().eq('id', id).eq('user_id', userId), 'deleteNote');
}

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────

export async function createCategory(userId: string, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const sort_order = await db.categories.count();
  const category: Category = { id, name, user_id: userId, sort_order };

  await db.categories.put(category);

  safeSupabaseSync(
    () => supabase.from('categories').insert({ id, name, user_id: userId, sort_order }),
    'createCategory'
  );

  return id;
}

export async function updateCategoryOrder(id: string, userId: string, sort_order: number): Promise<void> {
  await db.categories.update(id, { sort_order });
  safeSupabaseSync(
    () => supabase.from('categories').update({ sort_order }).eq('id', id).eq('user_id', userId),
    'updateCategoryOrder'
  );
}

export async function updateCategory(id: string, userId: string, name: string): Promise<void> {
  await db.categories.update(id, { name });
  safeSupabaseSync(
    () => supabase.from('categories').update({ name }).eq('id', id).eq('user_id', userId),
    'updateCategory'
  );
}

export async function deleteCategory(id: string, userId: string): Promise<void> {
  await db.notes.where('category_id').equals(id).modify({ category_id: undefined });
  await db.categories.delete(id);

  safeSupabaseSync(() => supabase.from('notes').update({ category_id: null }).eq('category_id', id).eq('user_id', userId), 'unlinkCategoryNotes');
  safeSupabaseSync(() => supabase.from('categories').delete().eq('id', id).eq('user_id', userId), 'deleteCategory');
}

// ─────────────────────────────────────────────
// SNIPPETS (Paragraph Settings)
// ─────────────────────────────────────────────

export async function createSnippet(userId: string, data: Omit<Snippet, 'id' | 'user_id'>): Promise<string> {
  const id = crypto.randomUUID();
  const snippet: Snippet = { id, user_id: userId, ...data };

  await db.snippets.put(snippet);

  safeSupabaseSync(
    () => supabase.from('snippets').insert({
      id,
      shortcut: data.shortcut,
      content: data.content,
      user_id: userId,
    }),
    'createSnippet'
  );

  return id;
}

export async function updateSnippet(id: string, userId: string, data: Partial<Snippet>): Promise<void> {
  await db.snippets.update(id, data);

  safeSupabaseSync(
    () => supabase.from('snippets').update({
      shortcut: data.shortcut,
      content: data.content,
    }).eq('id', id).eq('user_id', userId),
    'updateSnippet'
  );
}

export async function deleteSnippet(id: string, userId: string): Promise<void> {
  await db.snippets.delete(id);
  safeSupabaseSync(() => supabase.from('snippets').delete().eq('id', id).eq('user_id', userId), 'deleteSnippet');
}

// ─────────────────────────────────────────────
// HIGHLIGHTS
// ─────────────────────────────────────────────

export async function createHighlight(userId: string, noteId: string, name: string, content: string = ''): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const highlight: Highlight = { id, note_id: noteId, name, content, created_at: now, user_id: userId };

  await db.highlights.put(highlight);

  safeSupabaseSync(
    () => supabase.from('highlights').insert({
      id, note_id: noteId, name, content, created_at: now, user_id: userId,
    }),
    'createHighlight'
  );

  return id;
}

export async function updateHighlight(id: string, userId: string, content: string): Promise<void> {
  await db.highlights.update(id, { content });

  safeSupabaseSync(
    () => supabase.from('highlights').update({ content }).eq('id', id).eq('user_id', userId),
    'updateHighlight'
  );
}

export async function deleteHighlight(id: string, userId: string): Promise<void> {
  await db.highlights.delete(id);
  safeSupabaseSync(() => supabase.from('highlights').delete().eq('id', id).eq('user_id', userId), 'deleteHighlight');
}

// ─────────────────────────────────────────────
// SMART MERGE LOAD — Syncs Supabase data into Dexie without destructive clear()
// ─────────────────────────────────────────────

export async function loadUserData(userId: string): Promise<void> {
  try {
    const [notesRes, categoriesRes, snippetsRes, highlightsRes] = await Promise.all([
      supabase.from('notes').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
      supabase.from('snippets').select('*').eq('user_id', userId),
      supabase.from('highlights').select('*').eq('user_id', userId),
    ]);

    // 1. Smart Merge Notes
    if (notesRes.data) {
      for (const n of notesRes.data) {
        const local = await db.notes.get(n.id);
        const remoteNote: Note = {
          id: n.id,
          title: n.title || '',
          content: n.content || '',
          is_featured: !!n.is_featured,
          category_id: n.category_id ?? undefined,
          created_at: n.created_at || Date.now(),
          updated_at: n.updated_at || Date.now(),
          user_id: n.user_id,
        };

        if (!local || remoteNote.updated_at > local.updated_at) {
          await db.notes.put(remoteNote);
        } else if (local && local.updated_at > remoteNote.updated_at) {
          // Push newer local note to Supabase
          updateNote(local.id, userId, local).catch(() => {});
        }
      }
    }

    // 2. Smart Merge Categories
    if (categoriesRes.data) {
      for (const c of categoriesRes.data) {
        await db.categories.put({
          id: c.id,
          name: c.name,
          user_id: c.user_id,
          sort_order: c.sort_order ?? 0,
        });
      }
    }

    // 3. Smart Merge Snippets
    if (snippetsRes.data) {
      for (const s of snippetsRes.data) {
        await db.snippets.put({
          id: s.id,
          shortcut: s.shortcut,
          content: s.content,
          user_id: s.user_id,
        });
      }
    }

    // 4. Smart Merge Highlights
    if (highlightsRes.data) {
      for (const h of highlightsRes.data) {
        await db.highlights.put({
          id: h.id,
          note_id: h.note_id,
          name: h.name,
          content: h.content || '',
          created_at: h.created_at || Date.now(),
          user_id: h.user_id,
        });
      }
    }
  } catch (err) {
    console.warn('Network offline or error loading remote user data:', err);
  }
}
