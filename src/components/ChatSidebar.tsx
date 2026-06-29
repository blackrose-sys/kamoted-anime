import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, ChevronDown, Trash2, ExternalLink, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserBadge } from './UserBadge';

// reactions shape: { "👍": ["uid1","uid2"], "❤️": ["uid3"] }
type Reactions = Record<string, string[]>;

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  message: string;
  reactions: Reactions;
  created_at: string;
}

interface HoverCard {
  userId: string;
  username: string;
  avatarUrl: string | null;
  x: number;
  y: number;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😭', '🔥', '🎉', '😍'];

function getInitial(name: string) {
  return name?.charAt(0).toUpperCase() || '?';
}

function getAvatarGradient(name: string) {
  const palettes = [
    ['#f59e0b', '#d97706'], ['#8b5cf6', '#7c3aed'],
    ['#ec4899', '#db2777'], ['#06b6d4', '#0891b2'],
    ['#10b981', '#059669'], ['#f43f5e', '#e11d48'],
    ['#6366f1', '#4f46e5'], ['#14b8a6', '#0d9488'],
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const [a, b] = palettes[Math.abs(h) % palettes.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function UserAvatar({
  username, avatarUrl, size = 30, onClick
}: { username: string; avatarUrl: string | null; size?: number; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      title={`@${username}`}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: getAvatarGradient(username), padding: 2,
        flexShrink: 0, cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseOver={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 2px var(--accent-primary)'; } }}
      onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        backgroundColor: '#111', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 900, color: '#fff'
      }}>
        {avatarUrl
          ? <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : getInitial(username)}
      </div>
    </div>
  );
}

export function ChatSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineUsers, setOnlineUsers] = useState<{ uid: string; username: string; avatar_url: string | null }[]>([]);
  const [showOnlineList, setShowOnlineList] = useState(false);
  const [activeBar, setActiveBar] = useState<string | null>(null);   // message id with emoji bar open
  const [hoverCard, setHoverCard] = useState<HoverCard | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reactionTooltip, setReactionTooltip] = useState<{ msgId: string; emoji: string; names: string[]; x: number; y: number } | null>(null);
  const usernameCache = useRef<Map<string, string>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);

  const MAX_CHARS = 500;

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, []);

  /* ─── Resolve user IDs to usernames ─── */
  const resolveUsernames = useCallback(async (uids: string[]): Promise<string[]> => {
    const results: string[] = [];
    const toFetch: string[] = [];

    for (const uid of uids) {
      const cached = usernameCache.current.get(uid);
      if (cached) {
        results.push(cached);
      } else {
        toFetch.push(uid);
      }
    }

    if (toFetch.length > 0) {
      // Check if any messages have this user_id so we can grab their username directly
      const msgMap = new Map(messages.map(m => [m.user_id, m.username]));
      const stillNeed: string[] = [];
      for (const uid of toFetch) {
        const fromMsg = msgMap.get(uid);
        if (fromMsg) {
          usernameCache.current.set(uid, fromMsg);
          results.push(fromMsg);
        } else {
          stillNeed.push(uid);
        }
      }

      if (stillNeed.length > 0) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', stillNeed);
          for (const p of data || []) {
            usernameCache.current.set(p.id, p.username);
            results.push(p.username);
          }
        } catch { /* ignore */ }
      }
    }

    // Preserve original order
    return uids.map(uid => usernameCache.current.get(uid) || 'Unknown');
  }, [messages]);

  /* ─── Show reaction tooltip on hover ─── */
  const showReactionTooltip = useCallback(async (e: React.MouseEvent, msgId: string, emoji: string, uids: string[]) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Show loading state immediately
    setReactionTooltip({ msgId, emoji, names: ['Loading...'], x: rect.left + rect.width / 2, y: rect.top });
    const names = await resolveUsernames(uids);
    setReactionTooltip(prev => prev && prev.msgId === msgId && prev.emoji === emoji ? { ...prev, names } : prev);
  }, [resolveUsernames]);

  /* ─── Initial Load + Realtime ─── */
  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(80);
        setMessages((data as ChatMessage[]) || []);
      } finally {
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel('chat-realtime-v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) => {
        const msg = p.new as ChatMessage;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (!isOpenRef.current) setHasNew(true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (p) => {
        const updated = p.new as ChatMessage;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, reactions: updated.reactions } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (p) => {
        const id = (p.old as { id: string }).id;
        setMessages(prev => prev.filter(m => m.id !== id));
      })
      .subscribe();

    // Presence
    const presenceChannel = supabase.channel('chat-presence-v3');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const usersList: { uid: string; username: string; avatar_url: string | null }[] = [];
        
        Object.keys(state).forEach((key) => {
          const presenceList = state[key] as any[];
          presenceList.forEach((presence) => {
            if (presence.uid) {
              if (!usersList.some(u => u.uid === presence.uid)) {
                usersList.push({
                  uid: presence.uid,
                  username: presence.username || 'Anonymous Otaku',
                  avatar_url: presence.avatar_url || null
                });
              }
            }
          });
        });
        
        setOnlineUsers(usersList);
        setOnlineCount(Math.max(1, usersList.length));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ 
            uid: user?.id ?? `anon-${Math.random()}`,
            username: user?.username ?? ((import.meta.env as any).VITE_COMPUTER_NAME || 'Anonymous Otaku'),
            avatar_url: user?.avatar_url || null
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  useEffect(() => {
    if (isOpen) { setHasNew(false); scrollToBottom(); setTimeout(() => inputRef.current?.focus(), 150); }
  }, [isOpen, scrollToBottom]);

  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen, scrollToBottom]);

  useEffect(() => {
    const fn = () => { setHoverCard(null); };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, []);

  /* ─── Send ─── */
  const handleSend = async () => {
    if (!user) { navigate('/login'); return; }
    const text = input.trim();
    if (!text || text.length > MAX_CHARS || sending) return;
    setSending(true);
    setInput('');
    // Optimistic
    const opt: ChatMessage = {
      id: `opt-${Date.now()}`, user_id: user.id, username: user.username,
      avatar_url: user.avatar_url, message: text, reactions: {}, created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, opt]);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        user_id: user.id, username: user.username, avatar_url: user.avatar_url, message: text, reactions: {}
      });
      if (error) throw error;
      // Remove optimistic once realtime INSERT arrives — or just leave it (deduplicated by id check)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== opt.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  /* ─── Delete ─── */
  const handleDelete = async (msg: ChatMessage) => {
    setDeletingId(msg.id);
    setActiveBar(null);
    // Optimistic remove
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    if (!msg.id.startsWith('opt-')) {
      const { error } = await supabase.from('chat_messages').delete().eq('id', msg.id);
      if (error) {
        // Revert on failure
        setMessages(prev => {
          const copy = [...prev, msg];
          copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return copy;
        });
      }
    }
    setDeletingId(null);
  };

  /* ─── React ─── */
  const handleReact = async (msg: ChatMessage, emoji: string) => {
    if (!user) { navigate('/login'); return; }
    if (msg.id.startsWith('opt-')) return; // can't react to optimistic

    const current: Reactions = { ...(msg.reactions || {}) };
    const users: string[] = current[emoji] ? [...current[emoji]] : [];
    const already = users.includes(user.id);

    // Toggle
    const newUsers = already ? users.filter(uid => uid !== user.id) : [...users, user.id];
    if (newUsers.length === 0) {
      delete current[emoji];
    } else {
      current[emoji] = newUsers;
    }

    // Optimistic local update
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: current } : m));

    // Persist
    const { error } = await supabase
      .from('chat_messages')
      .update({ reactions: current })
      .eq('id', msg.id);

    if (error) {
      // Revert
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: msg.reactions } : m));
    }
  };

  /* ─── Emoji bar hover with delay ─── */
  const showBar = (id: string) => {
    if (emojiTimer.current) clearTimeout(emojiTimer.current);
    setActiveBar(id);
  };
  const hideBar = () => {
    emojiTimer.current = setTimeout(() => setActiveBar(null), 280);
  };

  /* ─── Hover card ─── */
  const openHoverCard = (e: React.MouseEvent, msg: ChatMessage) => {
    e.stopPropagation();
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverCard({ userId: msg.user_id, username: msg.username, avatarUrl: msg.avatar_url, x: r.right + 10, y: r.top });
  };
  const closeHoverCard = () => { hoverTimer.current = setTimeout(() => setHoverCard(null), 250); };

  /* ─── Keyboard ─── */
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') setIsOpen(false);
  };

  const charsLeft = MAX_CHARS - input.length;

  /* ─── RENDER ─── */
  return (
    <>
      {/* FAB */}
      <button
        id="chat-fab"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Toggle chat"
        style={{
          position: 'fixed', bottom: '1.75rem', right: '1.75rem',
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: isOpen ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
          boxShadow: isOpen ? 'none' : '0 8px 28px rgba(245,158,11,0.45)',
          cursor: 'pointer', zIndex: 201,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
          transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)'
        }}
        onMouseOver={e => { if (!isOpen) { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; } }}
        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        {isOpen ? <ChevronDown size={22} color="white" /> : <MessageCircle size={22} color="black" />}
        {!isOpen && hasNew && (
          <span style={{
            position: 'absolute', top: 8, right: 8, width: 12, height: 12,
            borderRadius: '50%', backgroundColor: '#ef4444',
            border: '2px solid var(--bg-color)',
            animation: 'chatPing 1.5s ease-in-out infinite'
          }} />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="fade-in"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', bottom: '5.5rem', right: '1.75rem',
            width: 360, maxWidth: 'calc(100vw - 2rem)',
            height: 520, maxHeight: 'calc(100vh - 8rem)',
            display: 'flex', flexDirection: 'column',
            backgroundColor: 'rgba(8,8,14,0.97)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '1.5rem', overflow: 'visible', zIndex: 200,
            boxShadow: '0 32px 80px -8px rgba(0,0,0,0.9), 0 0 0 1px rgba(245,158,11,0.06)',
            backdropFilter: 'blur(24px)'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '1.5rem 1.5rem 0 0',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(139,92,246,0.05))'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ position: 'relative' }}>
                <MessageCircle size={18} color="var(--accent-primary)" />
                {user?.username === 'fckitscott' && (
                  <span style={{
                    position: 'absolute', top: -1, right: -3, width: 8, height: 8,
                    borderRadius: '50%', backgroundColor: '#22c55e',
                    border: '1.5px solid rgba(8,8,14,0.97)',
                    boxShadow: '0 0 6px rgba(34,197,94,0.7)'
                  }} />
                )}
              </div>
              <span style={{ fontWeight: 900, fontSize: '0.93rem' }}>Community Chat</span>
              
              {user?.username === 'fckitscott' && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowOnlineList(!showOnlineList)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      fontSize: '0.67rem', fontWeight: 800, color: '#22c55e',
                      backgroundColor: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.18)',
                      padding: '0.15rem 0.5rem', borderRadius: 9999,
                      cursor: 'pointer', outline: 'none', transition: 'all 0.2s'
                    }}
                    className="hover-scale"
                  >
                    <Users size={10} />{onlineCount} online
                  </button>

                  {showOnlineList && (
                    <div
                      className="glass fade-in"
                      style={{
                        position: 'absolute',
                        top: '130%',
                        left: 0,
                        width: '180px',
                        backgroundColor: 'rgba(10,10,18,0.98)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        zIndex: 210,
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0.2rem 0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        Online Users ({onlineUsers.length})
                      </div>
                      {onlineUsers.length === 0 ? (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', padding: '0.4rem', textAlign: 'center' }}>
                          No users online
                        </div>
                      ) : (
                        onlineUsers.map((u) => (
                          <Link
                            key={u.uid}
                            to={`/user/${u.username}`}
                            onClick={() => setShowOnlineList(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              textDecoration: 'none',
                              color: 'white',
                              padding: '0.25rem 0.4rem',
                              borderRadius: '0.4rem',
                              transition: 'background 0.15s'
                            }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.5rem', fontWeight: 900, overflow: 'hidden', flexShrink: 0
                            }}>
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                u.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.username}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', color: 'rgba(255,255,255,0.35)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
              onMouseOver={e => { const b = e.currentTarget as HTMLButtonElement; b.style.backgroundColor = 'rgba(255,255,255,0.07)'; b.style.color = 'white'; }}
              onMouseOut={e => { const b = e.currentTarget as HTMLButtonElement; b.style.backgroundColor = 'transparent'; b.style.color = 'rgba(255,255,255,0.35)'; }}
            ><X size={16} /></button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            padding: '0.85rem 0.75rem',
            display: 'flex', flexDirection: 'column',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent'
          }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2.5rem' }}>💬</div>
                <div style={{ fontWeight: 700 }}>No messages yet</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Be the first to say something!</div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = user?.id === msg.user_id;
                const prev = messages[idx - 1];
                const grouped = !!prev && prev.user_id === msg.user_id
                  && new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 90000;

                // Gather non-empty reaction entries
                const reactionEntries = Object.entries(msg.reactions || {}).filter(([, uids]) => uids.length > 0);

                return (
                  <div
                    key={msg.id}
                    style={{ marginTop: grouped ? '0.1rem' : '0.85rem' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: isMe ? 'row-reverse' : 'row',
                        alignItems: 'flex-end', gap: '0.5rem',
                        opacity: deletingId === msg.id ? 0.3 : 1,
                        transition: 'opacity 0.2s', position: 'relative'
                      }}
                      onMouseEnter={() => showBar(msg.id)}
                      onMouseLeave={hideBar}
                    >
                      {/* Avatar */}
                      <div style={{ width: 30, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                        {!grouped && (
                          <UserAvatar
                            username={msg.username}
                            avatarUrl={msg.avatar_url}
                            size={30}
                            onClick={(e) => openHoverCard(e, msg)}
                          />
                        )}
                      </div>

                      {/* Bubble + name */}
                      <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', gap: '0.18rem', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {!grouped && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                            <button
                              onClick={() => navigate(`/user/${msg.username}`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.71rem', fontWeight: 800, color: isMe ? 'var(--accent-primary)' : '#a78bfa', transition: 'opacity 0.15s' }}
                              onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'}
                              onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                            >
                              {isMe ? 'You' : msg.username}
                            </button>
                            <UserBadge username={msg.username} size="sm" />
                            <span style={{ fontSize: '0.59rem', color: 'rgba(255,255,255,0.22)', fontWeight: 600 }}>
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        )}

                        <div style={{
                          padding: '0.52rem 0.82rem',
                          borderRadius: isMe
                            ? (grouped ? '1.1rem 0.35rem 0.35rem 1.1rem' : '1.1rem 0.35rem 1.1rem 1.1rem')
                            : (grouped ? '0.35rem 1.1rem 1.1rem 0.35rem' : '0.35rem 1.1rem 1.1rem 1.1rem'),
                          backgroundColor: isMe ? 'rgba(245,158,11,0.13)' : 'rgba(255,255,255,0.055)',
                          border: `1px solid ${isMe ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.065)'}`,
                          fontSize: '0.83rem', lineHeight: 1.5, wordBreak: 'break-word'
                        }}>
                          {msg.message}
                        </div>
                      </div>

                      {/* Emoji + Delete Action Bar */}
                      {activeBar === msg.id && (
                        <div
                          className="fade-in"
                          onClick={e => e.stopPropagation()}
                          onMouseEnter={() => showBar(msg.id)}
                          onMouseLeave={hideBar}
                          style={{
                            position: 'absolute',
                            [isMe ? 'left' : 'right']: 34,
                            bottom: '100%', marginBottom: 6,
                            display: 'flex', alignItems: 'center', gap: '0.15rem',
                            backgroundColor: 'rgba(12,12,20,0.99)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            borderRadius: 9999,
                            padding: '0.3rem 0.55rem', zIndex: 20,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.7)'
                          }}
                        >
                          {EMOJI_OPTIONS.map(emoji => {
                            const reacted = user && (msg.reactions?.[emoji] || []).includes(user.id);
                            return (
                              <button
                                key={emoji}
                                title={`React with ${emoji}`}
                                onClick={() => handleReact(msg, emoji)}
                                style={{
                                  background: reacted ? 'rgba(245,158,11,0.15)' : 'none',
                                  border: reacted ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                                  borderRadius: '0.35rem',
                                  cursor: 'pointer',
                                  fontSize: '1rem', padding: '0.1rem 0.18rem',
                                  lineHeight: 1, transition: 'transform 0.1s, background 0.15s'
                                }}
                                onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.4)'}
                                onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'}
                              >
                                {emoji}
                              </button>
                            );
                          })}

                          {isMe && (
                            <>
                              <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 0.15rem' }} />
                              <button
                                onClick={() => handleDelete(msg)}
                                title="Delete message"
                                style={{
                                  background: 'none', border: '1px solid transparent', cursor: 'pointer',
                                  color: '#ef4444', display: 'flex', alignItems: 'center',
                                  padding: '0.18rem', borderRadius: '0.35rem', transition: 'all 0.12s'
                                }}
                                onMouseOver={e => { const b = e.currentTarget as HTMLButtonElement; b.style.backgroundColor = 'rgba(239,68,68,0.15)'; b.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                                onMouseOut={e => { const b = e.currentTarget as HTMLButtonElement; b.style.backgroundColor = 'transparent'; b.style.borderColor = 'transparent'; }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reaction Pills — always visible below bubble */}
                    {reactionEntries.length > 0 && (
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: '0.3rem',
                        marginTop: '0.35rem',
                        paddingLeft: isMe ? 0 : 38,
                        paddingRight: isMe ? 8 : 0,
                        justifyContent: isMe ? 'flex-end' : 'flex-start'
                      }}>
                        {reactionEntries.map(([emoji, uids]) => {
                          const iReacted = user ? uids.includes(user.id) : false;
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReact(msg, emoji)}
                              onMouseEnter={(e) => showReactionTooltip(e, msg.id, emoji, uids)}
                              onMouseLeave={() => setReactionTooltip(null)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: 9999,
                                backgroundColor: iReacted ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${iReacted ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 800,
                                color: iReacted ? 'var(--accent-primary)' : 'rgba(255,255,255,0.75)',
                                transition: 'all 0.15s',
                                lineHeight: 1,
                                position: 'relative'
                              }}
                              onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)'}
                              onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'}
                            >
                              <span>{emoji}</span>
                              <span style={{ fontSize: '0.72rem' }}>{uids.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderRadius: '0 0 1.5rem 1.5rem', flexShrink: 0
          }}>
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <UserAvatar username={user.username} avatarUrl={user.avatar_url} size={28} />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Message the community..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    maxLength={MAX_CHARS}
                    style={{
                      flex: 1, padding: '0.52rem 0.82rem',
                      borderRadius: '0.85rem',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'white', outline: 'none', fontSize: '0.83rem',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(245,158,11,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.09)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: input.trim() ? 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)' : 'rgba(255,255,255,0.05)',
                      border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.2s',
                      boxShadow: input.trim() ? '0 4px 14px rgba(245,158,11,0.35)' : 'none'
                    }}
                    onMouseOver={e => { if (input.trim()) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  >
                    {sending
                      ? <Loader2 size={14} color="black" className="animate-spin" />
                      : <Send size={14} color={input.trim() ? 'black' : 'rgba(255,255,255,0.18)'} />
                    }
                  </button>
                </div>
                {charsLeft < 80 && (
                  <div style={{ fontSize: '0.67rem', textAlign: 'right', fontWeight: 700, color: charsLeft <= 20 ? '#ef4444' : 'rgba(255,255,255,0.28)', transition: 'color 0.2s' }}>
                    {charsLeft} / {MAX_CHARS}
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.65rem', borderRadius: '0.85rem',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.09), rgba(139,92,246,0.09))',
                  border: '1px solid rgba(245,158,11,0.18)',
                  color: 'var(--accent-primary)', textDecoration: 'none',
                  fontWeight: 800, fontSize: '0.83rem', transition: 'opacity 0.2s'
                }}
                onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8'}
                onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
              >
                <MessageCircle size={14} /> Sign in to chat
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Profile Hover Card */}
      {hoverCard && (
        <div
          className="fade-in"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(hoverCard.x, window.innerWidth - 220),
            top: Math.max(8, Math.min(hoverCard.y, window.innerHeight - 180)),
            width: 210,
            backgroundColor: 'rgba(8,8,20,0.99)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1rem', padding: '1rem', zIndex: 300,
            boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}
          onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
          onMouseLeave={closeHoverCard}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UserAvatar username={hoverCard.username} avatarUrl={hoverCard.avatarUrl} size={44} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, fontSize: '0.9rem' }}>{hoverCard.username}</span>
                <UserBadge username={hoverCard.username} size="sm" />
              </div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>@{hoverCard.username}</div>
            </div>
          </div>
          <Link
            to={`/user/${hoverCard.username}`}
            onClick={() => setHoverCard(null)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              width: '100%', padding: '0.52rem', borderRadius: '0.6rem',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: 'black', textDecoration: 'none', fontWeight: 900, fontSize: '0.77rem',
              transition: 'opacity 0.15s', boxShadow: '0 4px 14px rgba(245,158,11,0.25)'
            }}
            onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'}
            onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
          >
            <ExternalLink size={12} /> View Profile
          </Link>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            See their anime list, level &amp; badges
          </div>
        </div>
      )}

      {/* Reaction Tooltip — shows who reacted */}
      {reactionTooltip && (
        <div
          className="fade-in"
          style={{
            position: 'fixed',
            left: Math.min(Math.max(8, reactionTooltip.x - 90), window.innerWidth - 200),
            top: Math.max(8, reactionTooltip.y - 12),
            transform: 'translateY(-100%)',
            minWidth: 140,
            maxWidth: 200,
            backgroundColor: 'rgba(8, 8, 20, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.75rem',
            padding: '0.6rem 0.85rem',
            zIndex: 400,
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(16px)',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.4rem',
            paddingBottom: '0.35rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          }}>
            <span style={{ fontSize: '1.1rem' }}>{reactionTooltip.emoji}</span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 900,
              color: 'var(--accent-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {reactionTooltip.names.length === 1 && reactionTooltip.names[0] === 'Loading...'
                ? 'Loading...'
                : `${reactionTooltip.names.length} ${reactionTooltip.names.length === 1 ? 'reaction' : 'reactions'}`
              }
            </span>
          </div>
          {!(reactionTooltip.names.length === 1 && reactionTooltip.names[0] === 'Loading...') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {reactionTooltip.names.map((name, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: user && usernameCache.current.get(user.id) === name || (messages.find(m => m.username === name)?.user_id === user?.id)
                      ? 'var(--accent-primary)'
                      : 'rgba(255, 255, 255, 0.85)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}{user && messages.find(m => m.username === name)?.user_id === user.id ? ' (you)' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes chatPing {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </>
  );
}
