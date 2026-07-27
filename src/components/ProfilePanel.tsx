"use client";
import { useState, useEffect } from 'react';
import { X, User, Calendar, FileText, Clock, LogOut, Edit2, Check } from 'lucide-react';
import { useAppStore, useAuthStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

function Avatar({ seed, size = 48 }: { seed: string; size?: number }) {
  // Generate a deterministic color from the seed string
  const hue = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const initials = seed.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: size, height: size,
        background: `hsl(${hue}, 40%, 85%)`,
        color: `hsl(${hue}, 40%, 35%)`,
        fontSize: size * 0.33,
      }}
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0 select-none"
    >
      {initials}
    </div>
  );
}

export function ProfilePanel() {
  const { isProfilePanelOpen, setIsProfilePanelOpen, userProfile, setUserProfile } = useAppStore();
  const { user } = useAuthStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [activity, setActivity] = useState<{ total_notes_created: number; last_active_at: string } | null>(null);

  const currentNoteCount = useLiveQuery(() => db.notes.count(), []);

  useEffect(() => {
    if (isProfilePanelOpen && user) {
      supabase
        .from('user_activity')
        .select('total_notes_created, last_active_at')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => { if (data) setActivity(data); });
    }
  }, [isProfilePanelOpen, user]);

  const saveDisplayName = async () => {
    if (!user || !editedName.trim() || editedName.trim() === userProfile?.display_name) {
      setIsEditingName(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .update({ display_name: editedName.trim() })
      .eq('id', user.id)
      .select()
      .single();
    if (data) setUserProfile(data);
    setIsEditingName(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!isProfilePanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]"
        onClick={() => setIsProfilePanelOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed left-72 top-0 h-screen w-80 bg-white border-r border-stone-200 z-50 flex flex-col shadow-xl animate-slide-in">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-stone-100">
          <span className="text-sm font-heading font-semibold text-stone-700 uppercase tracking-wider">Profile</span>
          <button onClick={() => setIsProfilePanelOpen(false)} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center text-center gap-3">
            <Avatar seed={userProfile?.avatar_seed || userProfile?.username || 'QN'} size={72} />
            <div className="w-full">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setIsEditingName(false); }}
                    className="flex-1 text-center text-lg font-semibold text-stone-800 border-b border-stone-400 outline-none bg-transparent"
                  />
                  <button onClick={saveDisplayName} className="text-stone-600 hover:text-stone-900">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-semibold text-stone-800">{userProfile?.display_name || '—'}</span>
                  <button
                    onClick={() => { setEditedName(userProfile?.display_name || ''); setIsEditingName(true); }}
                    className="text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-sm text-stone-400 mt-0.5">@{userProfile?.username}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-100" />

          {/* Stats */}
          <div className="space-y-3">
            <h3 className="text-xs font-heading font-semibold text-stone-500 uppercase tracking-wider">Account Info</h3>

            <div className="flex items-center gap-3 text-stone-600">
              <Calendar className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-stone-400">Member since</p>
                <p className="text-sm font-medium">{formatDate(userProfile?.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-stone-600">
              <Clock className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-stone-400">Last active</p>
                <p className="text-sm font-medium">{formatDateTime(activity?.last_active_at)}</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-100" />

          {/* Usage */}
          <div className="space-y-3">
            <h3 className="text-xs font-heading font-semibold text-stone-500 uppercase tracking-wider">Usage</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-stone-800">{activity?.total_notes_created ?? '—'}</p>
                <p className="text-xs text-stone-500 mt-1">Notes Created</p>
              </div>
              <div className="bg-stone-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-stone-800">{currentNoteCount ?? '—'}</p>
                <p className="text-xs text-stone-500 mt-1">Notes Saved</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="p-5 border-t border-stone-100">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 border border-stone-200 hover:border-red-200 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
