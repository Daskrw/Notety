/**
 * data.ts — Centralized data mutation layer.
 *
 * Every write goes to Supabase first. On success, the local Dexie cache
 * is updated so useLiveQuery hooks re-render instantly.
 *
 * Column names are all snake_case to match the Supabase schema.
 */
import { supabase } from './supabase';
import { db, Note, Category, Snippet, Highlight } from './db';

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

  const { error } = await supabase.from('notes').insert({
    id: note.id,
    title: note.title,
    content: note.content,
    is_featured: note.is_featured,
    category_id: note.category_id ?? null,
    created_at: note.created_at,
    updated_at: note.updated_at,
    user_id: userId,
  });

  if (error) throw new Error(`Failed to create note: ${error.message}`);
  await db.notes.put(note);
  return id;
}

export async function updateNote(id: string, userId: string, changes: Partial<Note>): Promise<void> {
  const now = Date.now();
  const payload: Record<string, unknown> = {
    updated_at: now,
  };

  if ('title' in changes) payload.title = changes.title;
  if ('content' in changes) payload.content = changes.content;
  if ('is_featured' in changes) payload.is_featured = changes.is_featured;
  if ('category_id' in changes) payload.category_id = changes.category_id ?? null;

  const { error } = await supabase.from('notes').update(payload).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to update note: ${error.message}`);
  await db.notes.update(id, { ...changes, updated_at: now });
}

export async function deleteNote(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to delete note: ${error.message}`);
  
  // Delete associated highlights to prevent orphans
  await supabase.from('highlights').delete().eq('note_id', id).eq('user_id', userId);
  await db.highlights.where('note_id').equals(id).delete();
  
  await db.notes.delete(id);
}

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────

export async function createCategory(userId: string, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const sort_order = await db.categories.count();
  const { error } = await supabase.from('categories').insert({ id, name, user_id: userId, sort_order });
  if (error) throw new Error(`Failed to create category: ${error.message}`);
  await db.categories.put({ id, name, user_id: userId, sort_order });
  return id;
}

export async function updateCategoryOrder(id: string, userId: string, sort_order: number): Promise<void> {
  const { error } = await supabase.from('categories').update({ sort_order }).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to update category order: ${error.message}`);
  await db.categories.update(id, { sort_order });
}

export async function updateCategory(id: string, userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ name }).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to update category: ${error.message}`);
  await db.categories.update(id, { name });
}

export async function deleteCategory(id: string, userId: string): Promise<void> {
  // Unlink notes from this category first
  await supabase.from('notes').update({ category_id: null }).eq('category_id', id).eq('user_id', userId);
  await db.notes.where('category_id').equals(id).modify({ category_id: undefined });

  const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to delete category: ${error.message}`);
  await db.categories.delete(id);
}

// ─────────────────────────────────────────────
// SNIPPETS (Paragraph Settings)
// ─────────────────────────────────────────────

export async function createSnippet(userId: string, data: Omit<Snippet, 'id' | 'user_id'>): Promise<string> {
  const id = crypto.randomUUID();
  const snippet: Snippet = { id, user_id: userId, ...data };
  const { error } = await supabase.from('snippets').insert({
    id,
    shortcut: data.shortcut,
    content: data.content,
    user_id: userId,
  });
  if (error) throw new Error(`Failed to create snippet: ${error.message}`);
  await db.snippets.put(snippet);
  return id;
}

export async function updateSnippet(id: string, userId: string, data: Partial<Snippet>): Promise<void> {
  const { error } = await supabase.from('snippets').update({
    shortcut: data.shortcut,
    content: data.content,
  }).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to update snippet: ${error.message}`);
  await db.snippets.update(id, data);
}

export async function deleteSnippet(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('snippets').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to delete snippet: ${error.message}`);
  await db.snippets.delete(id);
}

// ─────────────────────────────────────────────
// HIGHLIGHTS
// ─────────────────────────────────────────────

export async function createHighlight(userId: string, noteId: string, name: string, content: string = ''): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const highlight: Highlight = { id, note_id: noteId, name, content, created_at: now, user_id: userId };
  const { error } = await supabase.from('highlights').insert({
    id, note_id: noteId, name, content, created_at: now, user_id: userId,
  });
  if (error) throw new Error(`Failed to create highlight: ${error.message}`);
  await db.highlights.put(highlight);
  return id;
}

export async function updateHighlight(id: string, userId: string, content: string): Promise<void> {
  const { error } = await supabase.from('highlights').update({ content }).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to update highlight: ${error.message}`);
  await db.highlights.update(id, { content });
}

export async function deleteHighlight(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('highlights').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Failed to delete highlight: ${error.message}`);
  await db.highlights.delete(id);
}

// ─────────────────────────────────────────────
// INITIAL LOAD — fetch all user data from Supabase into Dexie cache
// ─────────────────────────────────────────────

export async function loadUserData(userId: string): Promise<void> {
  const [notesRes, categoriesRes, snippetsRes, highlightsRes] = await Promise.all([
    supabase.from('notes').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('snippets').select('*').eq('user_id', userId),
    supabase.from('highlights').select('*').eq('user_id', userId),
  ]);

  if (notesRes.data) {
    await db.notes.clear();
    await db.notes.bulkPut(notesRes.data.map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      is_featured: n.is_featured,
      category_id: n.category_id ?? undefined,
      created_at: n.created_at,
      updated_at: n.updated_at,
      user_id: n.user_id,
    })));
  }

  if (categoriesRes.data) {
    await db.categories.clear();
    await db.categories.bulkPut(categoriesRes.data.map((c: any) => ({
      id: c.id, name: c.name, user_id: c.user_id,
    })));
  }

  if (snippetsRes.data) {
    await db.snippets.clear();
    await db.snippets.bulkPut(snippetsRes.data.map((s: any) => ({
      id: s.id, shortcut: s.shortcut, content: s.content, user_id: s.user_id,
    })));
  }

  if (highlightsRes.data) {
    await db.highlights.clear();
    await db.highlights.bulkPut(highlightsRes.data.map((h: any) => ({
      id: h.id, note_id: h.note_id, name: h.name, content: h.content,
      created_at: h.created_at, user_id: h.user_id,
    })));
  }
}
