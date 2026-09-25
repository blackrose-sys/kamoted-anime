import { supabase } from './supabase';

// ============================================================
// OWNER / ADMIN CONFIGURATION
// ============================================================
// The owner's username — only this account gets admin powers
const OWNER_USERNAMES = ['fckitscott'];
const OWNER_EMAILS = ['yukitrevor54@gmail.com'];

/**
 * Check if a given user is the site owner/admin.
 */
export function isOwner(user: { username?: string; email?: string } | null): boolean {
  if (!user) return false;
  return (
    OWNER_USERNAMES.includes(user.username?.toLowerCase() || '') ||
    OWNER_EMAILS.includes(user.email?.toLowerCase() || '')
  );
}

// ============================================================
// BAN SYSTEM
// ============================================================
// We use the Supabase `banned_users` table.
// Schema: id (uuid), user_id (uuid), username (text), reason (text),
//         banned_by (uuid), banned_at (timestamptz), expires_at (timestamptz nullable)

export interface BannedUser {
  id: string;
  user_id: string;
  username: string;
  reason: string;
  banned_by: string;
  banned_at: string;
  expires_at: string | null;
}

/**
 * Check if a user is currently banned.
 */
export async function checkBanStatus(userId: string): Promise<{ banned: boolean; reason: string; expires_at: string | null }> {
  try {
    const { data, error } = await supabase
      .from('banned_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return { banned: false, reason: '', expires_at: null };
    }

    // Check if ban has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Auto-remove expired ban
      await supabase.from('banned_users').delete().eq('id', data.id);
      return { banned: false, reason: '', expires_at: null };
    }

    return { banned: true, reason: data.reason || 'You have been banned.', expires_at: data.expires_at };
  } catch {
    return { banned: false, reason: '', expires_at: null };
  }
}

/**
 * Ban a user (owner only).
 */
export async function banUser(
  targetUserId: string,
  targetUsername: string,
  reason: string,
  bannedByUserId: string,
  expiresAt?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('banned_users')
      .upsert({
        user_id: targetUserId,
        username: targetUsername,
        reason,
        banned_by: bannedByUserId,
        banned_at: new Date().toISOString(),
        expires_at: expiresAt || null
      }, { onConflict: 'user_id' });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Unban a user (owner only).
 */
export async function unbanUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('banned_users')
      .delete()
      .eq('user_id', targetUserId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all currently banned users (admin panel).
 */
export async function fetchBannedUsers(): Promise<BannedUser[]> {
  try {
    const { data, error } = await supabase
      .from('banned_users')
      .select('*')
      .order('banned_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

// ============================================================
// TROLL BAN MESSAGES
// ============================================================
const TROLL_MESSAGES = [
  "🚫 You've been YEETED from Kamoted! 🚫",
  "Imagine getting banned from an anime site. Couldn't be you... oh wait, it IS you.",
  "Your anime privileges have been REVOKED. No waifus for you. 😈",
  "L + ratio + banned + no anime + touch grass 🌱",
  "You thought you could watch anime? That's cute. DENIED. 💀",
  "The council has spoken. Your vibe check has been failed.",
  "Error 403: Your taste in behavior was too trash for this platform.",
  "Plot twist: YOU are the villain of this arc, and you just got defeated.",
  "Your account has been sent to the Shadow Realm. ✨",
  "Even Truck-kun wouldn't isekai you to a world with anime access.",
];

export function getRandomTrollMessage(): string {
  return TROLL_MESSAGES[Math.floor(Math.random() * TROLL_MESSAGES.length)];
}
