'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore, useAppStore } from '../store/useStore';
import { loadUserData } from '../lib/data';
import { db } from '../lib/db';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setUserProfile = useAppStore((state) => state.setUserProfile);

  const hasLoadedData = useRef(false);

  useEffect(() => {
    // Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && !hasLoadedData.current) {
        hasLoadedData.current = true;
        loadUserData(session.user.id);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        if (!hasLoadedData.current) {
          hasLoadedData.current = true;
          await loadUserData(session.user.id);
          await fetchProfile(session.user.id);
        }
      }

      if (event === 'SIGNED_OUT') {
        hasLoadedData.current = false;
        setUser(null);
        setUserProfile(null);
        // Clear local cache on sign out
        try {
          await Promise.all([
            db.notes.clear(),
            db.categories.clear(),
            db.snippets.clear(),
            db.highlights.clear(),
          ]);
        } catch (err) {
          console.error('Failed to clear local DB on sign out:', err);
        }
      }

      if (event === 'USER_UPDATED' && session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setUserProfile(data);
  }

  return <>{children}</>;
}
