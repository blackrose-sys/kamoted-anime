import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Cached profile entry — keeps username + avatar_url fresh via real-time subscription.
 */
interface CachedProfile {
  username: string;
  avatar_url: string | null;
}

// ── Module-level singleton cache ──
// Shared across all components that import this hook.
const profileCache = new Map<string, CachedProfile>();
const listeners = new Set<() => void>();
let realtimeChannel: any = null;
let subscriberCount = 0;

function notifyListeners() {
  listeners.forEach(fn => fn());
}

/**
 * Start the global real-time subscription for the profiles table.
 * Only one subscription exists, even if multiple components use the hook.
 */
function startGlobalSubscription() {
  if (realtimeChannel) return;

  realtimeChannel = supabase
    .channel('profiles-realtime-cache')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles' },
      (payload) => {
        const updated = payload.new as { id: string; username: string; avatar_url: string | null };
        if (updated.id) {
          profileCache.set(updated.id, {
            username: updated.username,
            avatar_url: updated.avatar_url ?? null,
          });
          notifyListeners();
        }
      }
    )
    .subscribe();
}

function stopGlobalSubscription() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

/**
 * Bulk-fetch profiles by user IDs (only ones not already cached).
 */
async function fetchProfiles(userIds: string[]) {
  const toFetch = userIds.filter(id => !profileCache.has(id));
  if (toFetch.length === 0) return;

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', toFetch);

    if (data) {
      for (const p of data) {
        profileCache.set(p.id, {
          username: p.username,
          avatar_url: p.avatar_url ?? null,
        });
      }
      notifyListeners();
    }
  } catch (err) {
    console.error('[ProfileCache] Failed to fetch profiles:', err);
  }
}

/**
 * Hook: useProfileCache
 *
 * Given a list of user IDs, returns a map of userId → { username, avatar_url }.
 * The map is always up to date — if any user changes their profile picture or
 * username, this hook re-renders with the new data.
 *
 * Usage:
 *   const profiles = useProfileCache(messages.map(m => m.user_id));
 *   const avatar = profiles.get(msg.user_id)?.avatar_url;
 */
export function useProfileCache(userIds: string[]): Map<string, CachedProfile> {
  const [, setTick] = useState(0);
  const prevIdsRef = useRef<string>('');

  // Subscribe to cache updates
  useEffect(() => {
    subscriberCount++;
    startGlobalSubscription();

    const listener = () => setTick(t => t + 1);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      subscriberCount--;
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        stopGlobalSubscription();
      }
    };
  }, []);

  // Bulk-fetch any missing profiles
  const idsKey = userIds.filter(Boolean).sort().join(',');
  useEffect(() => {
    if (idsKey === prevIdsRef.current) return;
    prevIdsRef.current = idsKey;

    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length > 0) {
      fetchProfiles(unique);
    }
  }, [idsKey, userIds]);

  // Return a snapshot of the cache for requested IDs
  const snapshot = new Map<string, CachedProfile>();
  for (const id of userIds) {
    const cached = profileCache.get(id);
    if (cached) {
      snapshot.set(id, cached);
    }
  }

  return snapshot;
}

/**
 * Helper: resolve the display username for a given user.
 * Falls back to the stored/fallback value if cache miss.
 */
export function resolveUsername(
  profiles: Map<string, CachedProfile>,
  userId: string,
  fallback: string
): string {
  return profiles.get(userId)?.username || fallback;
}

/**
 * Helper: resolve the display avatar for a given user.
 * Falls back to the stored/fallback value if cache miss.
 */
export function resolveAvatar(
  profiles: Map<string, CachedProfile>,
  userId: string,
  fallback: string | null
): string | null {
  const cached = profiles.get(userId);
  return cached ? cached.avatar_url : fallback;
}
