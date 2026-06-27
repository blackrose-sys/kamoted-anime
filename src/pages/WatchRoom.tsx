import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, Play, Pause, Copy, Check, ArrowLeft, Crown, Loader2, Wifi, Server, ChevronDown, RefreshCw } from 'lucide-react';
import { animeServers, getServerUrl, fetchAniListMetadata, getAnimeDetails } from '../lib/animeServers';

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
  const [selectedServer, setSelectedServer] = useState<any>(animeServers[0]);
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [type, setType] = useState<'sub' | 'dub'>('sub');
  const [anilistId, setAnilistId] = useState<string>('');
  const [animeCover, setAnimeCover] = useState<string>('');
  const [syncNonce, setSyncNonce] = useState<number>(Date.now());
  
  const channelRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isHost = room?.host_id === user?.id;

  // Load room
  useEffect(() => {
    const upperRoomId = roomId?.toUpperCase() || '';
    if (!upperRoomId) { setError('Invalid room'); setLoading(false); return; }

    const load = async () => {
      const { data, error: err } = await supabase
        .from('watch_rooms')
        .select('*')
        .eq('room_code', upperRoomId)
        .maybeSingle();

      if (err || !data) { setError('Room not found or has ended.'); setLoading(false); return; }
      setRoom(data as WatchRoom);

      // Fetch anime title & cover details robustly
      try {
        const details = await getAnimeDetails(data.anime_id);
        if (details.title) setAnimeTitle(details.title);
        if (details.image_url) setAnimeCover(details.image_url);
      } catch { setAnimeTitle(`Anime #${data.anime_id}`); }

      // Fetch AniList metadata for servers that require AniList ID
      try {
        const metadata = await fetchAniListMetadata(data.anime_id.toString());
        if (metadata.anilistId) setAnilistId(metadata.anilistId);
      } catch (e) {
        console.error('Failed to fetch AniList metadata for watch room:', e);
      }

      setLoading(false);
    };
    load();

    // Realtime room updates & Chat broadcasts
    const channel = supabase
      .channel(`room-${upperRoomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_rooms' }, (p) => {
        setRoom(p.new as WatchRoom);
      })
      .on('broadcast', { event: 'room_update' }, (payload) => {
        setRoom(prev => prev ? { ...prev, ...payload.payload } : null);
        if (payload.payload?.syncNonce !== undefined) {
          setSyncNonce(payload.payload.syncNonce);
        }
      })
      .on('broadcast', { event: 'chat' }, (payload) => {
        setChatMessages(prev => [...prev, payload.payload]);
      });
    
    channel.subscribe();
    channelRef.current = channel;

    // Presence for members
    const presenceChannel = supabase.channel(`room-presence-${upperRoomId}`);
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

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handlePlayPause = async () => {
    if (!room || !isHost) return;
    const nextPlaying = !room.is_playing;
    const nextNonce = Date.now();
    
    // 1. Instant optimistic local update & WebSocket broadcast
    setRoom(prev => prev ? { ...prev, is_playing: nextPlaying } : null);
    setSyncNonce(nextNonce);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'room_update',
        payload: { is_playing: nextPlaying, syncNonce: nextNonce }
      });
    }

    // 2. Persist to DB in background
    await supabase.from('watch_rooms').update({
      is_playing: nextPlaying,
      updated_at: new Date().toISOString()
    }).eq('id', room.id);
  };

  const handleEpisodeChange = async (delta: number) => {
    if (!room || !isHost) return;
    const newEp = Math.max(1, room.episode + delta);
    const nextNonce = Date.now();

    // 1. Instant optimistic local update & WebSocket broadcast
    setRoom(prev => prev ? { ...prev, episode: newEp, is_playing: true } : null);
    setSyncNonce(nextNonce);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'room_update',
        payload: { episode: newEp, is_playing: true, syncNonce: nextNonce }
      });
    }

    // 2. Persist to DB in background
    await supabase.from('watch_rooms').update({
      episode: newEp,
      current_time: 0,
      is_playing: true,
      updated_at: new Date().toISOString()
    }).eq('id', room.id);
  };

  const handleResyncStream = () => {
    const nextNonce = Date.now();
    setSyncNonce(nextNonce);
    if (isHost && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'room_update',
        payload: { syncNonce: nextNonce }
      });
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room?.room_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const upperRoomId = roomId?.toUpperCase() || '';
    if (!chatInput.trim() || !user || !upperRoomId) return;
    
    const msgPayload = { 
      user: user.username, 
      msg: chatInput.trim(), 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };

    setChatMessages(prev => [...prev, msgPayload]);
    setChatInput('');

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: msgPayload
      });
    }
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
          <div style={{ flex: 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
            {room?.is_playing ? (
              <iframe
                src={getServerUrl(selectedServer, room?.anime_id.toString() || '', room?.episode || 1, type, anilistId || room?.anime_id.toString() || '')}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture"
                title="Watch Together Player"
                key={`${selectedServer.id}-${room?.episode}-${type}-${anilistId}-${syncNonce}`}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#07070d'
              }}>
                {animeCover && (
                  <img
                    src={animeCover}
                    alt={animeTitle}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2, filter: 'blur(30px) brightness(0.6)' }}
                  />
                )}
                <div style={{
                  position: 'relative', zIndex: 10, textAlign: 'center', padding: '2.5rem 2rem',
                  backgroundColor: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.5rem',
                  boxShadow: '0 25px 60px -12px rgba(0,0,0,0.9)', maxWidth: '460px', width: '90%'
                }}>
                  {animeCover && (
                    <div style={{ width: 84, height: 120, borderRadius: '0.75rem', overflow: 'hidden', margin: '0 auto 1.25rem auto', boxShadow: '0 12px 30px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}>
                      <img src={animeCover} alt={animeTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.85rem', borderRadius: '9999px', backgroundColor: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <Pause size={13} fill="var(--accent-primary)" /> {isHost ? 'Stream Paused by You' : 'Stream Paused by Host'}
                  </div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '0.3rem', color: 'white', lineHeight: 1.2 }}>{animeTitle}</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', fontWeight: 700 }}>Episode {room?.episode}</p>
                  
                  {isHost ? (
                    <button
                      onClick={handlePlayPause}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 2rem', borderRadius: '9999px', background: 'linear-gradient(135deg, var(--accent-primary), #d97706)', border: 'none', color: 'black', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 8px 25px rgba(245,158,11,0.4)', transition: 'transform 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Play size={20} fill="black" /> Resume Stream for Everyone
                    </button>
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} className="animate-pulse" />
                      Waiting for host to resume stream...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0, flexWrap: 'wrap' }}>
            {isHost ? (
              <>
                <button onClick={handlePlayPause} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '9999px', background: 'linear-gradient(135deg, var(--accent-primary), #d97706)', border: 'none', color: 'black', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer' }}>
                  {room?.is_playing ? <><Pause size={15} /> Pause</> : <><Play size={15} fill="black" /> Play</>}
                </button>
                <button onClick={() => handleEpisodeChange(-1)} style={{ padding: '0.6rem 1rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}>← Prev Ep</button>
                <button onClick={() => handleEpisodeChange(1)} style={{ padding: '0.6rem 1rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}>Next Ep →</button>
              </>
            ) : null}

            <button
              onClick={handleResyncStream}
              title="Resync Stream for Everyone"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}
            >
              <RefreshCw size={14} /> Resync
            </button>

            {/* Common Stream Customizations (Available to Host & Guest) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* SUB/DUB Toggle */}
              <div style={{ display: 'flex', gap: '2px', backgroundColor: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button 
                  onClick={() => setType('sub')} 
                  style={{ 
                    padding: '0.45rem 0.9rem', 
                    borderRadius: '9999px', 
                    border: 'none', 
                    background: type === 'sub' ? 'var(--accent-primary)' : 'transparent', 
                    color: type === 'sub' ? 'black' : 'rgba(255,255,255,0.7)', 
                    fontWeight: 900, 
                    fontSize: '0.72rem', 
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  SUB
                </button>
                <button 
                  onClick={() => setType('dub')} 
                  style={{ 
                    padding: '0.45rem 0.9rem', 
                    borderRadius: '9999px', 
                    border: 'none', 
                    background: type === 'dub' ? 'var(--accent-primary)' : 'transparent', 
                    color: type === 'dub' ? 'black' : 'rgba(255,255,255,0.7)', 
                    fontWeight: 900, 
                    fontSize: '0.72rem', 
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  DUB
                </button>
              </div>

              {/* Server Selector */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowServerDropdown(!showServerDropdown)} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.55rem 1rem', 
                    borderRadius: '9999px', 
                    background: 'rgba(255,255,255,0.06)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    color: 'white', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    fontSize: '0.75rem' 
                  }}
                >
                  <Server size={13} />
                  <span>{selectedServer.name}</span>
                  <ChevronDown size={13} />
                </button>
                {showServerDropdown && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '100%', 
                    left: 0, 
                    marginBottom: '0.5rem', 
                    backgroundColor: '#0a0a0f', 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    borderRadius: '0.75rem', 
                    padding: '0.4rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.2rem', 
                    zIndex: 100, 
                    minWidth: '180px',
                    boxShadow: '0 -10px 25px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    {animeServers.map((server) => (
                      <button
                        key={server.id}
                        onClick={() => {
                          setSelectedServer(server);
                          setShowServerDropdown(false);
                        }}
                        style={{ 
                          padding: '0.55rem 0.75rem', 
                          textAlign: 'left', 
                          backgroundColor: selectedServer.id === server.id ? 'var(--accent-primary)' : 'transparent', 
                          color: selectedServer.id === server.id ? 'black' : 'white', 
                          borderRadius: '0.5rem', 
                          border: 'none', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s'
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = selectedServer.id === server.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = selectedServer.id === server.id ? 'var(--accent-primary)' : 'transparent'}
                      >
                        <Server size={12} />
                        {server.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Crown size={12} style={{ color: isHost ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
              {isHost ? 'You are the host' : 'Controls managed by host'}
            </span>
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
              <div ref={chatEndRef} />
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
