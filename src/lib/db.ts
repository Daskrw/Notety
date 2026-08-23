import Dexie, { type EntityTable } from 'dexie';

export interface Category {
  id: string;
  name: string;
  user_id: string;
  sort_order?: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  is_featured: boolean;
  category_id?: string;
  created_at: number;
  updated_at: number;
  user_id: string;
}

export interface Snippet {
  id: string;
  shortcut: string;
  content: string;
  user_id: string;
}

export interface Highlight {
  id: string;
  note_id: string;
  name: string;
  content: string;
  created_at: number;
  user_id: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_seed: string;
  created_at: string;
  shortcut_prefix?: string;
  shortcut_trigger_key?: string;
  enable_clickable_links?: boolean;
}

export interface UserActivity {
  user_id: string;
  total_notes_created: number;
  last_active_at: string;
}

const db = new Dexie('QuietNotesDB') as Dexie & {
  categories: EntityTable<Category, 'id'>;
  notes: EntityTable<Note, 'id'>;
  snippets: EntityTable<Snippet, 'id'>;
  highlights: EntityTable<Highlight, 'id'>;
};

// Versions 1-4 are kept for migration history only.
db.version(1).stores({ notes: 'id, title, isFeatured, updatedAt', templates: 'id, name' });
db.version(2).stores({ categories: 'id, name', notes: 'id, title, isFeatured, categoryId, updatedAt', highlights: 'id, noteId, createdAt' });
db.version(3).stores({ templates: 'id, name' });
db.version(4).stores({ categories: 'id, name, user_id, sync_status', notes: 'id, title, isFeatured, categoryId, updatedAt, user_id, sync_status', highlights: 'id, noteId, createdAt, user_id, sync_status', templates: 'id, name, user_id, sync_status' });

// v5: Remove sync_status — Dexie is now a read cache. Source of truth is Supabase.
db.version(5).stores({
  categories: 'id, name, user_id',
  notes: 'id, title, isFeatured, categoryId, updatedAt, user_id',
  highlights: 'id, noteId, createdAt, user_id',
  templates: 'id, name, user_id',
}).upgrade(tx => {
  return Promise.all([
    tx.table('notes').toCollection().modify((n: any) => { delete n.sync_status; }),
    tx.table('categories').toCollection().modify((c: any) => { delete c.sync_status; }),
    tx.table('templates').toCollection().modify((t: any) => { delete t.sync_status; }),
    tx.table('highlights').toCollection().modify((h: any) => { delete h.sync_status; }),
  ]);
});

// v6: Rename columns to snake_case to match new Supabase schema.
db.version(6).stores({
  categories: 'id, name, user_id',
  notes: 'id, title, is_featured, category_id, updated_at, user_id',
  highlights: 'id, note_id, created_at, user_id',
  templates: 'id, name, user_id',
}).upgrade(tx => {
  return Promise.all([
    tx.table('notes').toCollection().modify((n: any) => {
      if ('isFeatured' in n) { n.is_featured = n.isFeatured; delete n.isFeatured; }
      if ('categoryId' in n) { n.category_id = n.categoryId; delete n.categoryId; }
      if ('createdAt' in n) { n.created_at = n.createdAt; delete n.createdAt; }
      if ('updatedAt' in n) { n.updated_at = n.updatedAt; delete n.updatedAt; }
    }),
    tx.table('highlights').toCollection().modify((h: any) => {
      if ('noteId' in h) { h.note_id = h.noteId; delete h.noteId; }
      if ('createdAt' in h) { h.created_at = h.createdAt; delete h.createdAt; }
    }),
  ]);
});

// v7: Remove templates, add snippets
db.version(7).stores({
  snippets: 'id, shortcut, user_id',
  templates: null, // this deletes the table
}).upgrade(tx => {
  return tx.table('snippets').toCollection().modify((s: any) => { });
});

export { db };
