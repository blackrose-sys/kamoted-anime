import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  watchlist_privacy: 'public' | 'private';
}

interface AuthContextType {
  user: User | null;
  logout: () => void;
  updateUser: (user: User) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const loadUserProfile = async (sessionUser: any) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('watchlist_privacy')
          .eq('id', sessionUser.id)
          .maybeSingle();

        setUser({
          id: sessionUser.id,
          email: sessionUser.email!,
          username: sessionUser.user_metadata?.username || sessionUser.email!.split('@')[0],
          avatar_url: sessionUser.user_metadata?.avatar_url || null,
          watchlist_privacy: (profile?.watchlist_privacy as 'public' | 'private') || 'public'
        });
      } catch (err) {
        console.error('Failed to load profile details:', err);
        // Fallback with default privacy
        setUser({
          id: sessionUser.id,
          email: sessionUser.email!,
          username: sessionUser.user_metadata?.username || sessionUser.email!.split('@')[0],
          avatar_url: sessionUser.user_metadata?.avatar_url || null,
          watchlist_privacy: 'public'
        });
      }
    };

    try {
      // Get initial session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          await loadUserProfile(session.user);
        }
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });

      // Listen for auth changes
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });
      subscription = data.subscription;
    } catch (err) {
      console.error('Auth init failed:', err);
      setIsLoading(false);
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateUser = async (newUser: User) => {
    // 1. Update auth.users metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        username: newUser.username,
        avatar_url: newUser.avatar_url
      }
    });

    if (authError) {
      throw authError;
    }

    // 2. Explicitly update the public profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        username: newUser.username,
        avatar_url: newUser.avatar_url,
        watchlist_privacy: newUser.watchlist_privacy
      })
      .eq('id', newUser.id);

    if (profileError) {
      throw profileError;
    }

    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
