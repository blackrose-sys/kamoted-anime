import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, Play, Pause, Copy, Check, ArrowLeft, Crown, Loader2, Wifi } from 'lucide-react';

interface RoomMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  joined_at: string;
}

interface WatchRoom {
  id: string;
  room_code: string;
  host_id: string;
  anime_id: number;
  episode: number;
  is_playing: boolean;
  current_time: number;
  updated_at: string;
}

function getInitial(name: string) { return name?.charAt(0).toUpperCase() || '?'; }
function getGradient(name: string) {
  const c = ['#f59e0b,#d97706','#8b5cf6,#7c3aed','#ec4899,#db2777','#06b6d4,#0891b2','#10b981,#059669'];
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `linear-gradient(135deg,${c[Math.abs(h) % c.length]})`;
}

export function WatchRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<WatchRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [animeTitle, setAnimeTitle] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ user: string; msg: string; time: string }[]>([]);
  const isHost = room?.host_id === user?.id;

  // Load room
  useEffect(() => {
    if (!roomId) { setError('Invalid room'); setLoading(false); return; }

    const load = async () => {
      const { data, error: err } = await supabase
        .from('watch_rooms')
        .select('*')
        .eq('room_code', roomId.toUpperCase())
        .maybeSingle();

      if (err || !data) { setError('Room not found or has ended.'); setLoading(false); return; }
      setRoom(data as WatchRoom);

      // Fetch anime title
      try {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${data.anime_id}`);
        const json = await res.json();
        setAnimeTitle(json.data?.title_english || json.data?.title || `Anime #${data.anime_id}`);
      } catch { setAnimeTitle(`Anime #${data.anime_id}`); }

      setLoading(false);
    };
    load();

    // Realtime room updates
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_rooms' }, (p) => {
        setRoom(p.new as WatchRoom);
      })
      .subscribe();

    // Presence for members
    const presenceChannel = supabase.channel(`room-presence-${roomId}`);
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<RoomMember>();
        const memberList: RoomMember[] = Object.values(state).flat();
        setMembers(memberList);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await presenceChannel.track({
            user_id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            joined_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [roomId, user]);

  const handlePlayPause = async () => {
    if (!room || !isHost) return;
    await supabase.from('watch_rooms').update({
      is_playing: !room.is_playing,
      updated_at: new Date().toISOString()
    }).eq('id', room.id);
  };

  const handleEpisodeChange = async (delta: number) => {
    if (!room || !isHost) return;
    const newEp = Math.max(1, room.episode + delta);
    await supabase.from('watch_rooms').update({ episode: newEp, current_time: 0, is_playing: false, updated_at: new Date().toISOString() }).eq('id', room.id);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room?.room_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
    setChatMessages(prev => [...prev, { user: user.username, msg: chatInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setChatInput('');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
      <p style={{ color: 'var(--text-secondary)' }}>Joining room...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
      <div style={{ fontSize: '3rem' }}>🔴</div>
      <h2 style={{ fontWeight: 900, fontSize: '1.5rem' }}>{error}</h2>
      <Link to="/" className="btn-primary" style={{ padding: '0.65rem 1.5rem', borderRadius: '9999px', textDecoration: 'none' }}>Go Home</Link>
    </div>
  );

  return (
    <main style={{ flex: 1, paddingTop: 'var(--nav-height)', minHeight: '100vh', backgroundColor: '#050508' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: 'calc(100vh - var(--nav-height))', maxHeight: 'calc(100vh - var(--nav-height))' }}>

        {/* Main player area */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, transition: 'color 0.2s' }}
              onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.color = 'white'}
              onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'}
            >
              <ArrowLeft size={16} /> Leave Room
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontWeight: 900, fontSize: '0.95rem' }}>{animeTitle}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>Episode {room?.episode}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#22c55e', fontWeight: 800 }}>
              <Wifi size={14} /> LIVE SYNC
            </div>
          </div>

          {/* Player embed */}
          <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
            <iframe
              src={`https://www.2embed.cc/embed/${room?.anime_id}?ep=${room?.episode}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowFullScreen
              title="Watch Together Player"
            />
            {!room?.is_playing && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)' }}>
                    {isHost ? 'You paused for everyone' : 'Paused by host'}
                  </div>
                  {isHost && (
                    <button
                      onClick={handlePlayPause}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', borderRadius: '9999px', background: 'linear-gradient(135deg, var(--accent-primary), #d97706)', border: 'none', color: 'black', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', margin: '0 auto' }}
                    >
                      <Play size={18} fill="black" /> Resume for Everyone
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
            {isHost ? (
              <>
                <button onClick={handlePlayPause} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '9999px', background: 'linear-gradient(135deg, var(--accent-primary), #d97706)', border: 'none', color: 'black', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer' }}>
                  {room?.is_playing ? <><Pause size={15} /> Pause</> : <><Play size={15} fill="black" /> Play</>}
                </button>
                <button onClick={() => handleEpisodeChange(-1)} style={{ padding: '0.6rem 1rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}>← Prev Ep</button>
                <button onClick={() => handleEpisodeChange(1)} style={{ padding: '0.6rem 1rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}>Next Ep →</button>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                  <Crown size={12} style={{ display: 'inline', color: 'var(--accent-primary)' }} /> You are the host
                </span>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                <Crown size={14} color="var(--accent-primary)" />
                Controls are managed by the host
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Members + Chat */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Room code */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(139,92,246,0.05))' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 800, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Room Code</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <code style={{ flex: 1, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.15em', color: 'var(--accent-primary)' }}>{room?.room_code}</code>
              <button
                onClick={handleCopyCode}
                style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, color: copied ? '#4ade80' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s' }}
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>Share this code with friends to join</p>
          </div>

          {/* Members */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Users size={14} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Watching ({members.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: getGradient(m.username), padding: 2, flexShrink: 0 }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, overflow: 'hidden' }}>
                      {m.avatar_url ? <img src={m.avatar_url} alt={m.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitial(m.username)}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</span>
                  {room?.host_id === m.user_id && (
                    <span title="Host" style={{ display: 'inline-flex' }}>
                      <Crown size={12} color="var(--accent-primary)" />
                    </span>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Waiting for members...</p>
              )}
            </div>
          </div>

          {/* Room Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Room Chat
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', scrollbarWidth: 'thin' }}>
              {chatMessages.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>No messages yet — say hi!</p>
              )}
              {chatMessages.map((cm, i) => (
                <div key={i} style={{ fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 800, color: cm.user === user?.username ? 'var(--accent-primary)' : '#a78bfa' }}>{cm.user}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', marginLeft: '0.35rem' }}>{cm.time}</span>
                  <div style={{ color: 'rgba(255,255,255,0.8)', marginTop: '0.1rem', lineHeight: 1.4 }}>{cm.msg}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={user ? 'Say something...' : 'Sign in to chat'}
                disabled={!user}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.65rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'white', outline: 'none', fontSize: '0.8rem' }}
              />
              <button type="submit" disabled={!chatInput.trim() || !user} style={{ padding: '0.5rem 0.85rem', borderRadius: '0.65rem', background: 'linear-gradient(135deg, var(--accent-primary), #d97706)', border: 'none', color: 'black', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem', opacity: chatInput.trim() && user ? 1 : 0.4 }}>
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
