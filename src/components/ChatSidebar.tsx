import { useEffect, useState, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronDown } from 'lucide-react';
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

function getInitial(username: string): string {
  return username?.charAt(0).toUpperCase() || '?';
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ChatSidebar() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(50);
        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Failed to load chat messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('public-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            // Deduplicate in case the sender gets their own message from subscription
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (!isOpen) {
            setHasNewMessage(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setHasNewMessage(false);
      setTimeout(scrollToBottom, 100);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!user) {
      alert('Please sign in to chat!');
      return;
    }
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 500) return;

    setSending(true);
    setInput('');

    try {
      const { error } = await supabase.from('chat_messages').insert({
        user_id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        message: trimmed
      });
      if (error) throw error;
    } catch (err) {
      console.error('Failed to send message:', err);
      setInput(trimmed); // Restore input on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open community chat"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseOver={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(245, 158, 11, 0.6)';
        }}
        onMouseOut={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(245, 158, 11, 0.4)';
        }}
      >
        {isOpen ? (
          <ChevronDown size={24} color="black" />
        ) : (
          <>
            <MessageCircle size={24} color="black" />
            {hasNewMessage && (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                border: '2px solid var(--bg-color)',
                animation: 'pulse 1.5s infinite'
              }} />
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fade-in"
          style={{
            position: 'fixed',
            bottom: '6rem',
            right: '2rem',
            width: '340px',
            maxWidth: 'calc(100vw - 2rem)',
            height: '480px',
            maxHeight: 'calc(100vh - 8rem)',
            backgroundColor: 'var(--bg-color-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 199,
            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(16px)'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(139,92,246,0.08))'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ position: 'relative' }}>
                <MessageCircle size={18} color="var(--accent-primary)" />
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  border: '1px solid var(--bg-color-secondary)'
                }} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '0.95rem' }}>Community Chat</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>LIVE</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', borderRadius: '0.5rem', transition: 'background-color 0.2s' }}
              onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'}
              onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            scrollbarWidth: 'thin'
          }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                <MessageCircle size={32} style={{ opacity: 0.4 }} />
                <div style={{ fontSize: '0.85rem' }}>Be the first to say hi! 👋</div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = user?.id === msg.user_id;
                return (
                  <div key={msg.id} style={{ display: 'flex', gap: '0.6rem', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-color-tertiary)',
                      border: `1.5px solid ${isMe ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '0.7rem',
                      fontWeight: 900
                    }}>
                      {msg.avatar_url ? (
                        <img src={msg.avatar_url} alt={msg.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>{getInitial(msg.username)}</span>
                      )}
                    </div>

                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isMe ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{isMe ? 'You' : msg.username}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6 }}>{timeAgo(msg.created_at)}</span>
                      </div>
                      <div style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: isMe ? '1rem 0.25rem 1rem 1rem' : '0.25rem 1rem 1rem 1rem',
                        backgroundColor: isMe ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isMe ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-color)'}`,
                        fontSize: '0.82rem',
                        lineHeight: 1.4,
                        wordBreak: 'break-word'
                      }}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: '1px solid var(--border-color)',
            padding: '0.75rem 1rem',
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'center',
            backgroundColor: 'var(--bg-color-secondary)'
          }}>
            {user ? (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={500}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-color-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    outline: 'none',
                    fontSize: '0.85rem',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: input.trim() ? 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)' : 'var(--bg-color-tertiary)',
                    border: 'none',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                    opacity: input.trim() ? 1 : 0.4
                  }}
                >
                  {sending ? (
                    <Loader2 size={16} color="black" className="animate-spin" />
                  ) : (
                    <Send size={16} color={input.trim() ? 'black' : 'var(--text-secondary)'} />
                  )}
                </button>
              </>
            ) : (
              <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.4rem' }}>
                <a href="/login" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign in</a> to chat with the community
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
