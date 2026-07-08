import { useState, useEffect } from 'react';
import { Mail, User, MessageSquare, Send, Loader2, CheckCircle, AlertCircle, Sparkles, AtSign, Inbox, Clock, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ContactMsg {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_username: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function Contact() {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Dev inbox (only for fckitscott)
  const [showInbox, setShowInbox] = useState(false);
  const [inbox, setInbox] = useState<ContactMsg[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);

  const isDev = user?.username === 'fckitscott';

  // Auto-fill from auth
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setName(user.username || '');
      // Fetch email from auth user
      (async () => {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          setEmail(data.user.email);
        }
      })();
    }
  }, [user]);

  // Load inbox for dev
  const loadInbox = async () => {
    setLoadingInbox(true);
    const { data } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setInbox((data as ContactMsg[]) || []);
    setLoadingInbox(false);
  };

  useEffect(() => {
    if (isDev && showInbox) {
      loadInbox();
    }
  }, [isDev, showInbox]);

  const markRead = async (id: string) => {
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
    setInbox(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
  };

  const deleteMsg = async (id: string) => {
    await supabase.from('contact_messages').delete().eq('id', id);
    setInbox(prev => prev.filter(m => m.id !== id));
    if (expandedMsg === id) setExpandedMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !username.trim() || !message.trim()) {
      setError('Please fill out all required fields — name, email, username, and message.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('contact_messages').insert({
        sender_name: name.trim(),
        sender_email: email.trim(),
        sender_username: username.trim(),
        subject: subject.trim() || `Message from ${username.trim()}`,
        message: message.trim(),
        user_id: user?.id || null,
      });

      if (insertError) {
        setError(insertError.message || 'Failed to send your message. Please try again.');
      } else {
        setSent(true);
        setSubject('');
        setMessage('');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.85rem 1rem 0.85rem 2.75rem',
    borderRadius: '0.75rem',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'white',
    outline: 'none',
    fontSize: '0.9rem',
    transition: 'border-color 0.3s, box-shadow 0.3s, background-color 0.3s',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '0.45rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '0.9rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(255,255,255,0.25)',
    transition: 'color 0.2s',
    pointerEvents: 'none',
  };

  const focusInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'rgba(245,158,11,0.45)';
    e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)';
    e.target.style.backgroundColor = 'rgba(255,255,255,0.06)';
  };

  const blurInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
    e.target.style.boxShadow = 'none';
    e.target.style.backgroundColor = 'rgba(255,255,255,0.04)';
  };

  const timeAgo = (d: string) => {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /* ─── Success State ─── */
  if (sent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div
          className="fade-in"
          style={{
            width: '100%',
            maxWidth: '480px',
            textAlign: 'center',
            padding: '3.5rem 2.5rem',
            borderRadius: '1.5rem',
            backgroundColor: 'rgba(8,8,14,0.97)',
            border: '1px solid rgba(34,197,94,0.2)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(34,197,94,0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))',
            border: '2px solid rgba(34,197,94,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            animation: 'contactPulse 2s ease-in-out infinite',
          }}>
            <CheckCircle size={32} color="#22c55e" />
          </div>
          <h2 style={{
            fontSize: '1.6rem',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #22c55e, #10b981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.75rem',
          }}>
            Message Delivered!
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '2rem' }}>
            Thanks for reaching out! The developer will see your message along with your email and username so they can get back to you. Keep watching great anime! 🎌
          </p>
          <button
            onClick={() => setSent(false)}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              border: 'none',
              color: 'black',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'all 0.25s',
              boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 30px rgba(245,158,11,0.5)';
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(245,158,11,0.35)';
            }}
          >
            Send Another Message
          </button>
        </div>

        <style>{`
          @keyframes contactPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.3); }
            50% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
          }
        `}</style>
      </div>
    );
  }

  /* ─── Main Form ─── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', flexDirection: 'column', gap: '2rem' }}>
      <div
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '2.5rem',
          borderRadius: '1.5rem',
          backgroundColor: 'rgba(8,8,14,0.97)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 80px rgba(245,158,11,0.04)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative gradient orbs */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px', width: '200px', height: '200px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px', width: '160px', height: '160px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: '1rem',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(139,92,246,0.08))',
            border: '1px solid rgba(245,158,11,0.2)', marginBottom: '1rem',
          }}>
            <Sparkles size={26} color="var(--accent-primary)" />
          </div>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Get in Touch
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
            Got a feature request, bug report, or just want to say hi?<br />
            Drop a message — include your info so I can get back to you.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="fade-in" style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.75rem 1rem', borderRadius: '0.65rem',
            backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            marginBottom: '1.25rem', fontSize: '0.8rem', color: '#f87171', fontWeight: 700,
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', position: 'relative' }}>
          {/* Name + Username row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Name <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={iconStyle} />
                <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
                  style={inputStyle} onFocus={focusInput} onBlur={blurInput}
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label style={labelStyle}>Username <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <AtSign size={16} style={iconStyle} />
                <input type="text" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)}
                  style={inputStyle} onFocus={focusInput} onBlur={blurInput}
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={iconStyle} />
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle} onFocus={focusInput} onBlur={blurInput}
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label style={labelStyle}>Subject <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>(optional)</span></label>
            <div style={{ position: 'relative' }}>
              <MessageSquare size={16} style={iconStyle} />
              <input type="text" placeholder="What's this about?" value={subject} onChange={e => setSubject(e.target.value)}
                style={inputStyle} onFocus={focusInput} onBlur={blurInput}
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label style={labelStyle}>Message <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea placeholder="Tell me what's on your mind..." value={message} onChange={e => setMessage(e.target.value)}
              rows={5} style={{ ...inputStyle, padding: '0.85rem 1rem', resize: 'vertical', minHeight: '120px', lineHeight: 1.6 }}
              onFocus={focusInput} onBlur={blurInput}
            />
          </div>

          {/* Meta row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', fontWeight: 700, marginTop: '-0.5rem',
          }}>
            <span>{message.length > 0 ? `${message.length} characters` : ''}</span>
            <span>* Required fields</span>
          </div>

          {/* Submit */}
          <button type="submit" disabled={sending} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            width: '100%', padding: '0.95rem', borderRadius: '0.85rem',
            background: sending ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
            border: 'none', color: sending ? 'rgba(255,255,255,0.3)' : 'black',
            fontWeight: 900, fontSize: '0.88rem', cursor: sending ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: sending ? 'none' : '0 4px 20px rgba(245,158,11,0.3)', marginTop: '0.25rem',
          }}
            onMouseOver={e => { if (!sending) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 30px rgba(245,158,11,0.45)'; } }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = sending ? 'none' : '0 4px 20px rgba(245,158,11,0.3)'; }}
          >
            {sending ? (<><Loader2 size={18} className="animate-spin" /> Sending...</>) : (<><Send size={16} /> Send Message</>)}
          </button>
        </form>

        {/* Footer note */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)', fontWeight: 600 }}>
          Your message goes directly to the developer. Include your email so they can reply. 📨
        </div>
      </div>

      {/* ─── Dev Inbox Panel (only for fckitscott) ─── */}
      {isDev && (
        <div className="fade-in" style={{
          width: '100%', maxWidth: '600px', borderRadius: '1.5rem',
          backgroundColor: 'rgba(8,8,14,0.97)', border: '1px solid rgba(139,92,246,0.15)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.06)',
          backdropFilter: 'blur(20px)', overflow: 'hidden',
        }}>
          {/* Inbox Header */}
          <button onClick={() => { setShowInbox(p => !p); }} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(245,158,11,0.04))',
            border: 'none', borderBottom: showInbox ? '1px solid rgba(255,255,255,0.06)' : 'none',
            cursor: 'pointer', color: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '0.65rem',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.06))',
                border: '1px solid rgba(139,92,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Inbox size={18} color="#a78bfa" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 900, fontSize: '0.88rem' }}>Developer Inbox</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  {inbox.length > 0 ? `${inbox.filter(m => !m.is_read).length} unread of ${inbox.length} messages` : 'View contact messages'}
                </div>
              </div>
            </div>
            {showInbox ? <ChevronUp size={18} color="rgba(255,255,255,0.35)" /> : <ChevronDown size={18} color="rgba(255,255,255,0.35)" />}
          </button>

          {/* Inbox Body */}
          {showInbox && (
            <div style={{ maxHeight: '500px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}>
              {loadingInbox ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader2 size={24} className="animate-spin" color="var(--accent-primary)" />
                </div>
              ) : inbox.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                  No messages yet
                </div>
              ) : (
                inbox.map(msg => (
                  <div key={msg.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background-color 0.15s',
                  }}>
                    {/* Message header */}
                    <button
                      onClick={() => { setExpandedMsg(expandedMsg === msg.id ? null : msg.id); if (!msg.is_read) markRead(msg.id); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer',
                        color: 'white', textAlign: 'left',
                      }}
                      onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
                    >
                      {/* Unread dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        backgroundColor: msg.is_read ? 'transparent' : '#8b5cf6',
                        boxShadow: msg.is_read ? 'none' : '0 0 8px rgba(139,92,246,0.6)',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 900, fontSize: '0.82rem', color: msg.is_read ? 'rgba(255,255,255,0.6)' : 'white' }}>
                            {msg.sender_name}
                          </span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a78bfa', backgroundColor: 'rgba(139,92,246,0.1)', padding: '0.1rem 0.4rem', borderRadius: '9999px', border: '1px solid rgba(139,92,246,0.2)' }}>
                            @{msg.sender_username}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.subject}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <Clock size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                          {timeAgo(msg.created_at)}
                        </span>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {expandedMsg === msg.id && (
                      <div className="fade-in" style={{ padding: '0 1.5rem 1.25rem 2.75rem' }}>
                        {/* Sender details */}
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem',
                          padding: '0.75rem 1rem', borderRadius: '0.65rem',
                          backgroundColor: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)',
                        }}>
                          <div style={{ fontSize: '0.72rem' }}>
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Email: </span>
                            <a href={`mailto:${msg.sender_email}`} style={{ color: 'var(--accent-primary)', fontWeight: 800, textDecoration: 'none' }}>{msg.sender_email}</a>
                          </div>
                          <div style={{ fontSize: '0.72rem' }}>
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Username: </span>
                            <span style={{ color: '#a78bfa', fontWeight: 800 }}>@{msg.sender_username}</span>
                          </div>
                        </div>
                        {/* Message body */}
                        <div style={{
                          fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.message}
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                          <a href={`mailto:${msg.sender_email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem',
                              borderRadius: '0.5rem', background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                              color: 'black', textDecoration: 'none', fontWeight: 900, fontSize: '0.72rem', textTransform: 'uppercase',
                              letterSpacing: '0.04em', transition: 'opacity 0.15s',
                            }}
                            onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'}
                            onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
                          >
                            <Mail size={12} /> Reply via Email
                          </a>
                          <button onClick={() => deleteMsg(msg.id)} style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem',
                            borderRadius: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#f87171', cursor: 'pointer', fontWeight: 900, fontSize: '0.72rem', textTransform: 'uppercase',
                            letterSpacing: '0.04em', transition: 'all 0.15s',
                          }}
                            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.15)'; }}
                            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes contactPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
        }
      `}</style>
    </div>
  );
}
