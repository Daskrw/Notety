import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Snippet } from '@/lib/db';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { createSnippet, updateSnippet, deleteSnippet } from '@/lib/data';
import { Settings, X, Plus, Trash2, Edit2, Check, Save } from 'lucide-react';

export function SettingsModal() {
  const { isSettingsModalOpen, setIsSettingsModalOpen, userProfile, setUserProfile } = useAppStore();
  const { user } = useAuthStore();
  
  const snippets = useLiveQuery(async (): Promise<Snippet[]> => db.snippets.toArray());
  
  const [newShortcut, setNewShortcut] = useState('');
  const [newContent, setNewContent] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShortcut, setEditShortcut] = useState('');
  const [editContent, setEditContent] = useState('');

  const [prefix, setPrefix] = useState(userProfile?.shortcut_prefix ?? '!');
  const [triggerKey, setTriggerKey] = useState(userProfile?.shortcut_trigger_key ?? 'Tab');
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  if (!isSettingsModalOpen) return null;

  const handleSavePreferences = async () => {
    if (!user) return;
    setIsSavingPrefs(true);
    
    // If prefix is literally empty, we allow it. (Null or undefined from DB is handled differently, but here state is string)
    const finalPrefix = prefix;
    const finalTrigger = triggerKey || 'Tab';
    
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        shortcut_prefix: finalPrefix,
        shortcut_trigger_key: finalTrigger
      })
      .eq('id', user.id)
      .select()
      .single();
      
    if (error) {
      setErrorMsg(`Database error: ${error.message} (Did you run the SQL schema?)`);
    } else if (data) {
      setUserProfile(data);
      setPrefix(data.shortcut_prefix);
      setTriggerKey(data.shortcut_trigger_key);
    }
    
    setIsSavingPrefs(false);
  };

  const handleCreateSnippet = async () => {
    if (!user || !newShortcut.trim() || !newContent.trim()) return;
    setErrorMsg(null);
    
    // Ensure shortcut is just one word, no spaces
    const cleanShortcut = newShortcut.trim().split(' ')[0];
    
    try {
      await createSnippet(user.id, {
        shortcut: cleanShortcut,
        content: newContent.trim()
      });
      setNewShortcut('');
      setNewContent('');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleStartEdit = (snippet: Snippet) => {
    setEditingId(snippet.id);
    setEditShortcut(snippet.shortcut);
    setEditContent(snippet.content);
  };

  const handleSaveEdit = async () => {
    if (!user || !editingId || !editShortcut.trim() || !editContent.trim()) return;
    
    const cleanShortcut = editShortcut.trim().split(' ')[0];
    await updateSnippet(editingId, user.id, {
      shortcut: cleanShortcut,
      content: editContent.trim()
    });
    
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (confirm("Delete this snippet?")) {
      await deleteSnippet(id, user.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3 text-stone-800">
            <div className="p-2 bg-stone-100 rounded-lg">
              <Settings className="w-5 h-5 text-stone-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">Paragraph Settings</h2>
              <p className="text-sm text-stone-500">Manage text snippets & shortcuts</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSettingsModalOpen(false)}
            className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
          
          <div className="bg-white border border-stone-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-stone-800">Trigger Preferences</h3>
              <button
                onClick={handleSavePreferences}
                disabled={isSavingPrefs || (prefix === (userProfile?.shortcut_prefix ?? '!') && triggerKey === (userProfile?.shortcut_trigger_key ?? 'Tab'))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Prefix Character</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPrefix(val.length > 0 ? val.charAt(val.length - 1) : '');
                  }}
                  placeholder="None"
                  maxLength={1}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 transition-all text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Trigger Key</label>
                <select
                  value={triggerKey}
                  onChange={(e) => setTriggerKey(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 transition-all text-sm"
                >
                  <option value="Tab">Tab Key</option>
                  <option value=" ">Spacebar</option>
                  <option value="Enter">Enter Key</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-5 mb-8 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-800 mb-4">Create New Shortcut</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Shortcut Word</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-mono">{userProfile?.shortcut_prefix || '!'}</span>
                  <input
                    type="text"
                    placeholder="brb"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value.replace(/\s/g, ''))} // No spaces
                    className="w-full pl-6 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 transition-all text-sm font-mono"
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1.5 leading-tight">
                  Will expand if you type `{userProfile?.shortcut_prefix ?? '!'}{newShortcut || 'word'}` and press {userProfile?.shortcut_trigger_key === ' ' ? 'Space' : (userProfile?.shortcut_trigger_key || 'Tab')}.
                </p>
              </div>
              <div className="col-span-2 flex flex-col">
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Expanded Text</label>
                <textarea
                  placeholder="Be right back!"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full flex-1 min-h-[80px] p-2.5 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 transition-all text-sm resize-none custom-scrollbar"
                />
              </div>
            </div>
            
            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-start gap-2">
                <span className="font-semibold shrink-0">Error:</span>
                <span>{errorMsg}</span>
              </div>
            )}
            
            <div className="flex justify-end mt-4">
              <button
                onClick={handleCreateSnippet}
                disabled={!newShortcut.trim() || !newContent.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Shortcut
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-stone-800 mb-3">Your Shortcuts</h3>
            
            {(!snippets || snippets.length === 0) ? (
              <div className="text-center py-10 bg-white border border-stone-100 rounded-xl">
                <p className="text-stone-400 text-sm">No shortcuts added yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {snippets.map(snippet => (
                  <div key={snippet.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center group transition-all hover:border-stone-300">
                    
                    {editingId === snippet.id ? (
                      <div className="w-full flex items-center gap-3">
                        <div className="w-1/3 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-mono">{userProfile?.shortcut_prefix ?? '!'}</span>
                          <input
                            type="text"
                            value={editShortcut}
                            onChange={(e) => setEditShortcut(e.target.value.replace(/\s/g, ''))}
                            className="w-full pl-6 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md outline-none focus:border-stone-400 text-sm font-mono"
                          />
                        </div>
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md outline-none focus:border-stone-400 text-sm"
                        />
                        <button onClick={handleSaveEdit} className="p-1.5 bg-stone-800 text-white rounded hover:bg-stone-900 transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-stone-200 text-stone-600 rounded hover:bg-stone-300 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="md:w-1/3 flex items-center gap-2 font-mono text-sm bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg shrink-0 overflow-hidden text-ellipsis">
                          <span className="text-stone-400">!</span>{snippet.shortcut}
                        </div>
                        
                        <div className="flex-1 text-sm text-stone-600 line-clamp-2 leading-relaxed">
                          {snippet.content}
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button 
                            onClick={() => handleStartEdit(snippet)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(snippet.id)}
                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
