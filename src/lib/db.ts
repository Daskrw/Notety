import Dexie, { type EntityTable } from 'dexie';

export interface Category {
  id: string;
  name: string;
}

export interface Note {
  id: string; // uuid
  title: string;
  content: string; // Markdown content
  isFeatured: boolean;
  categoryId?: string; // Optional for "Uncategorized"
  createdAt: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  defaultTitle?: string;
  categoryId?: string;
  defaultHighlights?: { name: string; content?: string }[];
}

export interface Highlight {
  id: string;
  noteId: string;
  name: string;
  content: string;
  createdAt: number;
}

const db = new Dexie('QuietNotesDB') as Dexie & {
  categories: EntityTable<Category, 'id'>;
  notes: EntityTable<Note, 'id'>;
  templates: EntityTable<Template, 'id'>;
  highlights: EntityTable<Highlight, 'id'>;
};

// Schema declaration
db.version(1).stores({
  notes: 'id, title, isFeatured, updatedAt', // Primary key and indexed props
  templates: 'id, name'
});

db.version(2).stores({
  categories: 'id, name',
  notes: 'id, title, isFeatured, categoryId, updatedAt',
  highlights: 'id, noteId, createdAt'
});

db.version(3).stores({
  templates: 'id, name' // No index changes needed, just a schema bump to ensure smooth hydration of new fields
});

export { db };
