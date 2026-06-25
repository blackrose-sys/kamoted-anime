import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, ChevronDown, Trash2, ExternalLink, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  message: string;
  created_at: string;
}

interface HoverCard {
  userId: string;
  username: string;
  avatarUrl: string | null;
  x: number;
  y: number;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😭', '🔥'];

function getInitial(name: string) {
  return name?.charAt(0).toUpperCase() || '?';
}

function getAvatarGradient(name: string) {
  const colors = [
    ['#f59e0b', '#d97706'],
    ['#8b5cf6', '#7c3aed'],
    ['#ec4899', '#db2777'],
    ['#06b6d4', '#0891b2'],
    ['#10b981', '#059669'],
    ['#f43f5e', '#e11d48'],
    ['#6366f1', '#4f46e5'],
    ['#14b8a6', '#0d9488'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % colors.length;
  return `linear-gradient(135deg, ${colors[idx][0]}, ${colors[idx][1]})`;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function UserAvatar({ username, avatarUrl, size = 30, onClick, extraStyle = {} }: {
  username: string;
  avatarUrl: string | null;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  extraStyle?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      title={`@${username}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: getAvatarGradient(username),
        padding: '2px',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        ...extraStyle
      }}
      onMouseOver={e => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.1)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 2px var(--accent-primary)';
        }
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        backgroundColor: 'var(--bg-color-tertiary)',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: `${Math.round(size * 0.38)}px`, fontWeight: 900, color: 'white'
      }}>
        {avatarUrl
          ? <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span>{getInitial(username)}</span>
        }
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
  const [showEmojiBar, setShowEmojiBar] = useState<string | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCard | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(isOpen);
  const MAX_CHARS = 500;

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, []);

  useEffect(() => {
    // Load initial messages
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(60);
        setMessages(data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();

    // Real-time new messages
    const msgChannel = supabase
      .channel('realtime-chat-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (!isOpenRef.current) setHasNew(true);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();

    // Presence for online count
    const presenceChannel = supabase.channel('chat-presence-v2');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const count = Object.keys(presenceChannel.presenceState()).length;
        setOnlineCount(Math.max(1, count));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user?.id || `anon-${Math.random()}`,
            at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      setHasNew(false);
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  useEffect(() => {
    const handler = () => { setHoverCard(null); setShowEmojiBar(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleSend = async () => {
    if (!user) { navigate('/login'); return; }
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_CHARS || sending) return;
    setSending(true);
    setInput('');
    // Optimistic insert
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      user_id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      message: trimmed,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        user_id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        message: trimmed
      });
      if (error) throw error;
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId: string) => {
    if (msgId.startsWith('opt-')) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      return;
    }
    setDeletingId(msgId);
    setShowEmojiBar(null);
    await supabase.from('chat_messages').delete().eq('id', msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setDeletingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') setIsOpen(false);
  };

  const openHoverCard = (e: React.MouseEvent, msg: ChatMessage) => {
    e.stopPropagation();
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverCard({
      userId: msg.user_id,
      username: msg.username,
      avatarUrl: msg.avatar_url,
      x: rect.right + 10,
      y: rect.top
    });
  };

  const closeHoverCard = () => {
    hoverTimer.current = setTimeout(() => setHoverCard(null), 250);
  };

  const charsLeft = MAX_CHARS - input.length;
  const isNearLimit = charsLeft < 80;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        id="chat-toggle-btn"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Toggle community chat"
        style={{
          position: 'fixed', bottom: '1.75rem', right: '1.75rem',
          width: '56px', height: '56px', borderRadius: '50%',
          background: isOpen
            ? 'rgba(255,255,255,0.07)'
            : 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
          border: isOpen ? '1px solid rgba(255,255,255,0.1)' : 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 201,
          boxShadow: isOpen ? 'none' : '0 8px 28px rgba(245,158,11,0.45)',
          transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
          backdropFilter: 'blur(12px)'
        }}
        onMouseOver={e => {
          if (!isOpen) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.transform = 'scale(1.08)';
            b.style.boxShadow = '0 12px 36px rgba(245,158,11,0.6)';
          }
        }}
        onMouseOut={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.transform = 'scale(1)';
          b.style.boxShadow = isOpen ? 'none' : '0 8px 28px rgba(245,158,11,0.45)';
        }}
      >
        {isOpen
          ? <ChevronDown size={22} color="white" />
          : <MessageCircle size={22} color="black" />
        }
        {!isOpen && hasNew && (
          <span style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '12px', height: '12px', borderRadius: '50%',
            backgroundColor: '#ef4444',
            border: '2px solid var(--bg-color)',
            boxShadow: '0 0 0 0 rgba(239,68,68,0.5)',
            animation: 'chatPing 1.5s ease-in-out infinite'
          }} />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fade-in"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: '5.5rem', right: '1.75rem',
            width: '360px', maxWidth: 'calc(100vw - 2rem)',
            height: '520px', maxHeight: 'calc(100vh - 8rem)',
            display: 'flex', flexDirection: 'column',
            backgroundColor: 'rgba(8,8,14,0.96)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '1.5rem',
            overflow: 'visible',
            zIndex: 200,
            boxShadow: '0 32px 80px -8px rgba(0,0,0,0.9), 0 0 0 1px rgba(245,158,11,0.06)',
            backdropFilter: 'blur(24px)'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(139,92,246,0.05))',
            borderRadius: '1.5rem 1.5rem 0 0',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ position: 'relative' }}>
                <MessageCircle size={18} color="var(--accent-primary)" />
                <span style={{
                  position: 'absolute', top: '-1px', right: '-3px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  border: '1.5px solid rgba(8,8,14,0.96)',
                  boxShadow: '0 0 6px rgba(34,197,94,0.7)'
                }} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '0.93rem', letterSpacing: '-0.01em' }}>
                Community Chat
              </span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.67rem', fontWeight: 800, color: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.18)',
                padding: '0.15rem 0.5rem', borderRadius: '9999px'
              }}>
                <Users size={10} />
                {onlineCount} online
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.3rem', color: 'rgba(255,255,255,0.4)',
                borderRadius: '0.5rem', display: 'flex', alignItems: 'center',
                transition: 'all 0.15s'
              }}
              onMouseOver={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'rgba(255,255,255,0.07)';
                b.style.color = 'white';
              }}
              onMouseOut={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'transparent';
                b.style.color = 'rgba(255,255,255,0.4)';
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1, overflowY: 'auto', overflowX: 'hidden',
              padding: '0.85rem 0.75rem',
              display: 'flex', flexDirection: 'column', gap: '0',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.07) transparent'
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              </div>
            ) : messages.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: '0.75rem',
                textAlign: 'center', color: 'var(--text-secondary)'
              }}>
                <div style={{ fontSize: '2.5rem' }}>💬</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>No messages yet</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Be the first to say something!</div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = user?.id === msg.user_id;
                const prev = messages[idx - 1];
                const grouped = !!prev && prev.user_id === msg.user_id
                  && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 90000;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: '0.5rem',
                      marginTop: grouped ? '0.1rem' : '0.85rem',
                      opacity: deletingId === msg.id ? 0.3 : 1,
                      transition: 'opacity 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={() => setShowEmojiBar(msg.id)}
                    onMouseLeave={() => setShowEmojiBar(null)}
                  >
                    {/* Avatar column */}
                    <div style={{ width: '30px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      {!grouped && (
                        <UserAvatar
                          username={msg.username}
                          avatarUrl={msg.avatar_url}
                          size={30}
                          onClick={(e) => openHoverCard(e, msg)}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{
                      maxWidth: '76%', display: 'flex', flexDirection: 'column',
                      gap: '0.18rem', alignItems: isMe ? 'flex-end' : 'flex-start'
                    }}>
                      {!grouped && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: '0.05rem'
                        }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/user/${msg.username}`); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              fontSize: '0.71rem', fontWeight: 800,
                              color: isMe ? 'var(--accent-primary)' : '#a78bfa',
                              transition: 'opacity 0.15s'
                            }}
                            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'}
                            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                          >
                            {isMe ? 'You' : msg.username}
                          </button>
                          <span style={{ fontSize: '0.59rem', color: 'rgba(255,255,255,0.22)', fontWeight: 600 }}>
                            {formatTime(msg.created_at)}
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
                        fontSize: '0.83rem', lineHeight: 1.5, wordBreak: 'break-word',
                        transition: 'background-color 0.15s'
                      }}>
                        {msg.message}
                      </div>
                    </div>

                    {/* Action Bar (hover) */}
                    {showEmojiBar === msg.id && (
                      <div
                        className="fade-in"
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          [isMe ? 'left' : 'right']: '38px',
                          bottom: '100%', marginBottom: '5px',
                          display: 'flex', alignItems: 'center', gap: '0.2rem',
                          backgroundColor: 'rgba(14,14,22,0.99)',
                          border: '1px solid rgba(255,255,255,0.09)',
                          borderRadius: '9999px',
                          padding: '0.28rem 0.5rem', zIndex: 20,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                        }}
                        onMouseEnter={() => setShowEmojiBar(msg.id)}
                        onMouseLeave={() => setShowEmojiBar(null)}
                      >
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            title={emoji}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '0.95rem', padding: '0.1rem 0.12rem',
                              borderRadius: '0.25rem', transition: 'transform 0.1s', lineHeight: 1
                            }}
                            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.4)'}
                            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'}
                          >
                            {emoji}
                          </button>
                        ))}
                        {isMe && (
                          <>
                            <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 0.1rem' }} />
                            <button
                              onClick={() => handleDelete(msg.id)}
                              title="Delete"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#ef4444', display: 'flex', alignItems: 'center',
                                padding: '0.15rem', borderRadius: '0.25rem', transition: 'all 0.1s'
                              }}
                              onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.15)'}
                              onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderRadius: '0 0 1.5rem 1.5rem',
            flexShrink: 0
          }}>
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <UserAvatar username={user.username} avatarUrl={user.avatar_url} size={28} />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Message the community..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={MAX_CHARS}
                    style={{
                      flex: 1, padding: '0.52rem 0.82rem',
                      borderRadius: '0.85rem',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'white', outline: 'none', fontSize: '0.83rem',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'rgba(245,158,11,0.45)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.09)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: input.trim()
                        ? 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)'
                        : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      cursor: input.trim() ? 'pointer' : 'not-allowed',
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
                {isNearLimit && (
                  <div style={{
                    fontSize: '0.67rem', textAlign: 'right', fontWeight: 700,
                    color: charsLeft <= 20 ? '#ef4444' : 'rgba(255,255,255,0.3)',
                    transition: 'color 0.2s'
                  }}>
                    {charsLeft} / {MAX_CHARS}
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', width: '100%', padding: '0.65rem',
                  borderRadius: '0.85rem',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.09), rgba(139,92,246,0.09))',
                  border: '1px solid rgba(245,158,11,0.18)',
                  color: 'var(--accent-primary)',
                  textDecoration: 'none', fontWeight: 800, fontSize: '0.83rem',
                  transition: 'opacity 0.2s'
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
            left: `${Math.min(hoverCard.x, window.innerWidth - 224)}px`,
            top: `${Math.max(8, Math.min(hoverCard.y, window.innerHeight - 180))}px`,
            width: '210px',
            backgroundColor: 'rgba(8,8,20,0.99)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            padding: '1rem',
            zIndex: 300,
            boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(245,158,11,0.06)',
            backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}
          onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
          onMouseLeave={closeHoverCard}
        >
          {/* Mini profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UserAvatar username={hoverCard.username} avatarUrl={hoverCard.avatarUrl} size={44} />
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.2 }}>{hoverCard.username}</div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginTop: '0.1rem' }}>
                @{hoverCard.username}
              </div>
            </div>
          </div>

          {/* View Profile button */}
          <Link
            to={`/user/${hoverCard.username}`}
            onClick={() => setHoverCard(null)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              width: '100%', padding: '0.52rem',
              borderRadius: '0.6rem',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: 'black', textDecoration: 'none',
              fontWeight: 900, fontSize: '0.77rem',
              transition: 'opacity 0.15s',
              boxShadow: '0 4px 14px rgba(245,158,11,0.25)'
            }}
            onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'}
            onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
          >
            <ExternalLink size={12} /> View Profile
          </Link>

          <div style={{
            fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)',
            textAlign: 'center', lineHeight: 1.4
          }}>
            See their anime list, level &amp; badges
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatPing {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </>
  );
}
