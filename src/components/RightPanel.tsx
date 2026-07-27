"use client";
import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { createHighlight, deleteHighlight } from '@/lib/data';
import { PanelRightClose, PanelRightOpen, Plus, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { registerDropListener, DragBlockPayload } from '@/hooks/useDragBlock';

export function RightPanel() {
  const { isRightPanelOpen, toggleRightPanel, selectedNoteId, setIsHighlightModalOpen, setActiveHighlightId } = useAppStore();
  const { user } = useAuthStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newHighlightName, setNewHighlightName] = useState('');
  const panelRef = useRef<HTMLElement>(null);

  // Pointer-based drop listener for dropping blocks into the Highlights panel
  const selectedNoteIdRef = useRef(selectedNoteId);
  selectedNoteIdRef.current = selectedNoteId;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const unregister = registerDropListener(async (payload: DragBlockPayload, x: number, y: number) => {
      const noteId = selectedNoteIdRef.current;
      const u = userRef.current;
      if (!noteId || !u || !panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

      const name = payload.type === 'password' ? 'Dropped Password' : 'Dropped Ping';
      let content = '';
      if (payload.type === 'password') {
        content = `**Password Box**\n\nPassword: \`${payload.value || 'N/A'}\``;
      } else if (payload.type === 'ping') {
        const val = String(payload.value || '');
        let ipStr = 'Awaiting 5 digits...';
        if (val.length >= 5) {
          const clean = val.replace(/\D/g, '').substring(0, 5);
          if (clean.length === 5) {
            const a = clean[0] === '0' ? '7' : clean[0];
            ipStr = `11${a}.1${clean[1]}${clean[2]}.1${clean[3]}${clean[4]}.xxx`;
          }
        }
        content = `**Ping Box**\n\nInput: ${val}\nSignal: \`${ipStr}\``;
      }

      await createHighlight(u.id, noteId, name, content);
    });
    return unregister;
  }, []);

  const highlights = useLiveQuery(
    async () => {
      if (!selectedNoteId) return [];
      const items = await db.highlights.where('note_id').equals(selectedNoteId).toArray();
      return items.sort((a, b) => b.created_at - a.created_at);
    },
    [selectedNoteId]
  );

  const handleCreateHighlight = async () => {
    if (!selectedNoteId || !newHighlightName.trim() || !user) return;
    await createHighlight(user.id, selectedNoteId, newHighlightName.trim());
    setNewHighlightName('');
    setIsCreating(false);
  };

  const handleDeleteHighlight = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    await deleteHighlight(id, user.id);
  };

  const openHighlight = (id: string) => {
    setActiveHighlightId(id);
    setIsHighlightModalOpen(true);
  };


  if (!isRightPanelOpen) {
    return null;
  }

  return (
    <aside 
      ref={panelRef}
      className="w-72 bg-white border-l border-stone-200 h-screen flex flex-col transition-all duration-300 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] shrink-0"
    >
      <div className="h-16 px-5 flex items-center justify-between border-b border-stone-100">
        <span className="text-xs font-heading font-semibold tracking-widest text-stone-500 uppercase">Highlights</span>
        <button onClick={toggleRightPanel} className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-50 rounded-md transition-colors">
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {!selectedNoteId ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400 text-sm">
          <FileText className="w-10 h-10 mb-4 opacity-20" />
          <p>Select a note to view its highlights.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {highlights?.map(hl => (
              <div
                key={hl.id}
                onClick={() => openHighlight(hl.id)}
                className="group cursor-pointer bg-white border border-stone-100 hover:border-stone-300 hover:shadow-sm p-4 rounded-xl transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-stone-800 leading-snug">{hl.name}</h4>
                  <button 
                    onClick={(e) => handleDeleteHighlight(e, hl.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-opacity p-1 -mr-2 -mt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-stone-400 mt-2 font-medium">{format(hl.created_at, 'MMM d, yyyy')}</p>
              </div>
            ))}
            
            {highlights?.length === 0 && !isCreating && (
              <p className="text-center text-stone-400 text-sm py-8 italic">No highlights saved.</p>
            )}
          </div>

          {/* Create Form */}
          <div className="p-4 border-t border-stone-100 bg-stone-50/50">
            {isCreating ? (
              <div className="space-y-3">
                <input 
                  autoFocus
                  type="text"
                  value={newHighlightName}
                  onChange={(e) => setNewHighlightName(e.target.value)}
                  placeholder="Name your highlight..."
                  className="w-full text-sm px-3 py-2.5 bg-white border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:shadow-sm transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateHighlight();
                    if (e.key === 'Escape') setIsCreating(false);
                  }}
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateHighlight} className="flex-1 bg-stone-900 text-white text-xs py-2.5 rounded-lg font-medium hover:bg-stone-800 transition-colors">Save</button>
                  <button onClick={() => setIsCreating(false)} className="flex-1 bg-white border border-stone-200 text-stone-600 text-xs py-2.5 rounded-lg font-medium hover:bg-stone-50 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center gap-2 bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 text-stone-600 py-2.5 rounded-lg transition-all text-sm font-medium shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Highlight</span>
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
