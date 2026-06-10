"use client";
import { useAppStore } from '@/store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useEffect } from 'react';
import { useAutoSave } from 'use-debounce'; // Wait, I'll just write custom save logic or use onBlur

export function HighlightModal() {
  const { isHighlightModalOpen, setIsHighlightModalOpen, activeHighlightId, setActiveHighlightId } = useAppStore();
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const highlight = useLiveQuery(
    () => activeHighlightId ? db.highlights.get(activeHighlightId) : undefined,
    [activeHighlightId]
  );

  useEffect(() => {
    if (highlight) {
      setEditContent(highlight.content);
    }
  }, [highlight]);

  const closeModal = () => {
    setIsHighlightModalOpen(false);
    setIsEditing(false);
    setTimeout(() => setActiveHighlightId(null), 200); // Wait for fade transition
  };

  const saveContent = async () => {
    if (highlight && editContent !== highlight.content) {
      await db.highlights.update(highlight.id, { content: editContent });
    }
    setIsEditing(false);
  };

  if (!isHighlightModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity"
        onClick={closeModal}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-8 py-5 border-b border-stone-100 bg-stone-50/50">
          <h3 className="text-lg font-heading font-semibold text-stone-800">
            {highlight?.name || 'Important Highlight'}
          </h3>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <button onClick={saveContent} className="text-xs font-medium bg-stone-900 text-white px-3 py-1.5 rounded hover:bg-stone-800 transition-colors">
                Save
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)} className="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors">
                Edit
              </button>
            )}
            <button 
              onClick={closeModal}
              className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1 font-sans">
          {isEditing ? (
            <textarea
              autoFocus
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full min-h-[300px] resize-none border-none outline-none text-stone-700 leading-relaxed bg-transparent"
              placeholder="Write your highlight content here in markdown..."
            />
          ) : (
            <div className="prose prose-stone max-w-none text-stone-700">
              {highlight?.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {highlight.content}
                </ReactMarkdown>
              ) : (
                <p className="text-stone-400 italic">No content saved for this highlight. Click Edit to add some.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
