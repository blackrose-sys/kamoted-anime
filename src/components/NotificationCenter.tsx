import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, AtSign, Play, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Notification {
  id: string;
  user_id: string;
  from_user_id: string;
  from_username: string;
  from_avatar_url: string | null;
  type: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function getAvatarGradient(name: string) {
  const palettes = [
    ['#f59e0b', '#d97706'], ['#8b5cf6', '#7c3aed'],
    ['#ec4899', '#db2777'], ['#06b6d4', '#0891b2'],
    ['#10b981', '#059669'], ['#f43f5e', '#e11d48'],
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const [a, b] = palettes[Math.abs(h) % palettes.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Load notifications
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setNotifications((data as Notification[]) || []);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => {
        const notif = p.new as Notification;
        setNotifications(prev => prev.some(n => n.id === notif.id) ? prev : [notif, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => {
        const updated = p.new as Notification;
        setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => {
        const id = (p.old as { id: string }).id;
        setNotifications(prev => prev.filter(n => n.id !== id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  };

  const clearAll = async () => {
    if (!user) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user.id);
  };

  if (!user) return null;

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          width: 34, height: 34, borderRadius: '50%',
          backgroundColor: isOpen ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
          border: isOpen ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s', padding: 0
        }}
        onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.12)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'; }}
        onMouseOut={e => { e.currentTarget.style.backgroundColor = isOpen ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = isOpen ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'; }}
      >
        <Bell size={16} color={isOpen || unreadCount > 0 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.5)'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 16, height: 16, borderRadius: 9999,
            backgroundColor: '#ef4444', color: 'white',
            fontSize: '0.6rem', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid var(--bg-color)',
            animation: 'notifPulse 2s ease-in-out infinite',
            boxShadow: '0 0 8px rgba(239,68,68,0.5)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="fade-in"
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '0.6rem',
            width: 340, maxWidth: 'calc(100vw - 2rem)',
            maxHeight: 420,
            backgroundColor: 'rgba(8,8,14,0.98)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '1rem',
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(20px)',
            zIndex: 200,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.85rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 900, fontSize: '0.88rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 800,
                  backgroundColor: 'rgba(245,158,11,0.15)',
                  color: 'var(--accent-primary)',
                  padding: '0.1rem 0.45rem',
                  borderRadius: 9999,
                  border: '1px solid rgba(245,158,11,0.25)'
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.4)', padding: '0.25rem',
                    borderRadius: '0.35rem', display: 'flex', alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.08)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <CheckCheck size={14} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  title="Clear all"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.4)', padding: '0.25rem',
                    borderRadius: '0.35rem', display: 'flex', alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '2rem' }}>🔔</div>
                <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No notifications yet</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>When someone @mentions you or a new episode drops, you'll see it here</div>
              </div>
            ) : (
              notifications.map(notif => {
                const isEpisodeDrop = notif.type === 'episode_drop';
                const isMention = notif.type === 'mention';
                
                // Determine icon and color palette
                let typeIcon = <AtSign size={10} color="rgba(255,255,255,0.4)" />;
                let badgeText = '';
                let badgeBg = 'transparent';
                let badgeColor = 'transparent';
                
                if (isEpisodeDrop) {
                  typeIcon = <Play size={10} color="#10b981" />;
                  badgeText = 'NEW EPISODE';
                  badgeBg = 'rgba(16,185,129,0.11)';
                  badgeColor = '#10b981';
                } else if (isMention) {
                  typeIcon = <MessageSquare size={10} color="var(--accent-primary)" />;
                  badgeText = 'MENTION';
                  badgeBg = 'rgba(245,158,11,0.11)';
                  badgeColor = 'var(--accent-primary)';
                }
                
                return (
                  <button
                    key={notif.id}
                    onClick={() => {
                      markAsRead(notif.id);
                      setIsOpen(false);
                      if (notif.link) {
                        navigate(notif.link);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      width: '100%', padding: '0.85rem 1rem',
                      background: notif.is_read ? 'transparent' : 'rgba(245,158,11,0.03)',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.15s, transform 0.1s',
                      position: 'relative'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.backgroundColor = notif.is_read ? 'transparent' : 'rgba(245,158,11,0.03)';
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: isEpisodeDrop ? 'linear-gradient(135deg, #10b981, #059669)' : getAvatarGradient(notif.from_username),
                      padding: 2, flexShrink: 0,
                      position: 'relative',
                      boxShadow: !notif.is_read && isEpisodeDrop ? '0 0 10px rgba(16,185,129,0.3)' : 'none'
                    }}>
                      <div style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        backgroundColor: '#111', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 900, color: '#fff'
                      }}>
                        {notif.from_avatar_url
                          ? <img src={notif.from_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : notif.from_username.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Sub-badge indicating notification type */}
                      <div style={{
                        position: 'absolute', bottom: -3, right: -3,
                        width: 16, height: 16, borderRadius: '50%',
                        backgroundColor: isEpisodeDrop ? '#10b981' : 'var(--accent-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1.5px solid rgba(8,8,14,0.98)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                      }}>
                        {isEpisodeDrop ? <Play size={8} color="#000" style={{ fill: '#000', marginLeft: '0.5px' }} /> : <AtSign size={8} color="#000" />}
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: notif.is_read ? 'rgba(255,255,255,0.7)' : 'var(--accent-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '160px'
                        }}>
                          {notif.from_username}
                        </span>
                        
                        {badgeText && (
                          <span style={{
                            fontSize: '0.56rem',
                            fontWeight: 900,
                            letterSpacing: '0.04em',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            flexShrink: 0
                          }}>
                            {badgeText}
                          </span>
                        )}
                      </div>
                      
                      <div style={{
                        fontSize: '0.78rem',
                        lineHeight: 1.35,
                        color: notif.is_read ? 'rgba(255,255,255,0.5)' : '#e5e7eb',
                        wordBreak: 'break-word'
                      }}>
                        {notif.message}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                        {typeIcon}
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                          {timeAgo(notif.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!notif.is_read && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        backgroundColor: 'var(--accent-primary)',
                        flexShrink: 0, marginTop: '0.35rem',
                        boxShadow: '0 0 8px rgba(245,158,11,0.6)'
                      }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes notifPulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
}
