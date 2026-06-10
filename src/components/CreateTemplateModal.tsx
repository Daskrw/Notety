"use client";
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/store/useStore';
import { X, Plus, Trash2 } from 'lucide-react';

export function CreateTemplateModal() {
  const { isCreateTemplateModalOpen, setIsCreateTemplateModalOpen } = useAppStore();
  const categories = useLiveQuery(() => db.categories.toArray());

  const [name, setName] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [categoryId, setCategoryId] = useState('uncategorized');
  const [content, setContent] = useState('');
  const [highlights, setHighlights] = useState<{name: string, content?: string}[]>([]);

  const addHighlight = () => setHighlights([...highlights, { name: '', content: '' }]);
  const updateHighlight = (index: number, field: 'name' | 'content', val: string) => {
    const newHl = [...highlights];
    newHl[index][field] = val;
    setHighlights(newHl);
  };
  const removeHighlight = (index: number) => setHighlights(highlights.filter((_, i) => i !== index));

  const closeModal = () => {
    setIsCreateTemplateModalOpen(false);
    // Reset state after transition
    setTimeout(() => {
      setName('');
      setDefaultTitle('');
      setCategoryId('uncategorized');
      setContent('');
      setHighlights([]);
    }, 200);
  };

  const saveTemplate = async () => {
    if (!name.trim()) return;
    
    // Filter out highlights without names
    const validHighlights = highlights.filter(h => h.name.trim() !== '');

    await db.templates.add({
      id: crypto.randomUUID(),
      name: name.trim(),
      defaultTitle: defaultTitle.trim() || undefined,
      categoryId: categoryId === 'uncategorized' ? undefined : categoryId,
      content: content,
      defaultHighlights: validHighlights.length > 0 ? validHighlights : undefined
    });
    
    closeModal();
  };

  if (!isCreateTemplateModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity" onClick={closeModal} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-8 py-5 border-b border-stone-100 bg-stone-50/50">
          <h3 className="text-lg font-heading font-semibold text-stone-800">Create Template</h3>
          <button onClick={closeModal} className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1 font-sans space-y-6 custom-scrollbar">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Template Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all text-sm" placeholder="e.g. Daily Standup" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Default Folder</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all text-sm">
                <option value="uncategorized">Uncategorized</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Default Note Title</label>
            <input type="text" value={defaultTitle} onChange={e => setDefaultTitle(e.target.value)} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all text-sm" placeholder="Optional pre-filled title" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Default Highlights</label>
              <button onClick={addHighlight} className="text-xs flex items-center gap-1 text-stone-500 hover:text-stone-900 transition-colors"><Plus className="w-3 h-3"/> Add</button>
            </div>
            {highlights.map((hl, i) => (
              <div key={i} className="flex gap-2 items-start bg-stone-50 p-4 rounded-xl border border-stone-100">
                <div className="flex-1 space-y-3">
                  <input type="text" value={hl.name} onChange={e => updateHighlight(i, 'name', e.target.value)} placeholder="Highlight Name (Required)" className="w-full p-2.5 text-sm bg-white border border-stone-200 rounded-lg outline-none focus:border-stone-400" />
                  <textarea value={hl.content} onChange={e => updateHighlight(i, 'content', e.target.value)} placeholder="Optional pre-filled content..." className="w-full p-2.5 text-sm bg-white border border-stone-200 rounded-lg outline-none focus:border-stone-400 resize-none h-20 custom-scrollbar" />
                </div>
                <button onClick={() => removeHighlight(i)} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {highlights.length === 0 && (
              <div className="text-sm text-stone-400 italic">No default highlights. Click 'Add' to attach one.</div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Template Content (Markdown)</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-400 focus:bg-white min-h-[250px] resize-y font-mono text-sm leading-relaxed custom-scrollbar transition-all" placeholder="Write the default body content here..." />
          </div>
        </div>

        <div className="p-5 border-t border-stone-100 bg-stone-50/50 flex justify-end gap-3">
          <button onClick={closeModal} className="px-6 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors">Cancel</button>
          <button onClick={saveTemplate} disabled={!name.trim()} className="px-6 py-2.5 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm">Save Template</button>
        </div>
      </div>
    </div>
  );
}
