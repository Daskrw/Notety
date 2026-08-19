"use client";
import { useAppStore, useAuthStore } from '@/store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { updateHighlight } from '@/lib/data';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useEffect } from 'react';
export function HighlightModal() {
  const { isHighlightModalOpen, setIsHighlightModalOpen, activeHighlightId, setActiveHighlightId } = useAppStore();
  const { user } = useAuthStore();
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
    if (highlight && user && editContent !== highlight.content) {
      await updateHighlight(highlight.id, user.id, editContent);
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
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] border border-stone-100">
        <div className="flex items-center justify-between px-8 py-5 border-b border-stone-100 bg-stone-50/70">
          <h3 className="text-xl font-heading font-semibold text-stone-800 tracking-tight">
            {highlight?.name || 'Important Highlight'}
          </h3>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <button onClick={saveContent} className="text-xs font-semibold bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors shadow-xs">
                Save Changes
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)} className="text-xs font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-100 px-3.5 py-1.5 rounded-lg transition-colors shadow-2xs">
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
        
        <div className="p-8 sm:p-10 overflow-y-auto flex-1 font-sans custom-scrollbar">
          {isEditing ? (
            <textarea
              autoFocus
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full min-h-[420px] resize-none border-none outline-none text-stone-800 text-base leading-relaxed bg-transparent font-sans"
              placeholder="Write your highlight content here in markdown..."
            />
          ) : (
            <div className="prose prose-stone prose-base max-w-none text-stone-800 leading-relaxed">
              {highlight?.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {highlight.content}
                </ReactMarkdown>
              ) : (
                <p className="text-stone-400 italic text-base">No content saved for this highlight. Click Edit to add some.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
