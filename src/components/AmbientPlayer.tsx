import { useState, useRef, useEffect, useCallback } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, ChevronDown, Shuffle, Repeat, X } from 'lucide-react';

// ── Track data (CC0 public domain from github.com/btahir/open-lofi) ──
const BASE = 'https://raw.githubusercontent.com/btahir/open-lofi/main';

interface Track {
  title: string;
  category: string;
  categorySlug: string;
  url: string;
}

const CATEGORIES = [
  { slug: 'all', label: 'All Vibes', emoji: '🎵' },
  { slug: 'asian', label: 'Zen & Anime', emoji: '🎋' },
  { slug: 'ambient', label: 'Dreamscape', emoji: '🌙' },
  { slug: 'late-night', label: 'Late Night', emoji: '🌃' },
  { slug: 'chill', label: 'Chill Beats', emoji: '☕' },
  { slug: 'jazz', label: 'Jazz Lounge', emoji: '🎷' },
];

function trackUrl(folder: string, title: string) {
  return `${BASE}/${encodeURIComponent(folder)}/${encodeURIComponent(title)}.mp3`;
}

const TRACKS: Track[] = [
  // Asian & Zen Lo-Fi
  { title: 'Bamboo Shadow Waltz', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Bamboo Shadow Waltz') },
  { title: 'Bells Before Sunrise', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Bells Before Sunrise') },
  { title: 'Lanterns in Slow Motion', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Lanterns in Slow Motion') },
  { title: 'Misty Steam Quiet Dreams', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Misty Steam Quiet Dreams') },
  { title: 'Moon Through Bamboo', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Moon Through Bamboo') },
  { title: 'Paper Lantern Rain', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Paper Lantern Rain') },
  { title: 'Teacup Morning Fog', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Teacup Morning Fog') },
  { title: 'Temple at Dawn', category: 'Zen & Anime', categorySlug: 'asian', url: trackUrl('Asian & Zen Lo-Fi', 'Temple at Dawn') },

  // Ambient Drift & Dreamscapes
  { title: 'A Letter Left Open', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'A Letter Left Open') },
  { title: 'Between Two Clouds', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'Between Two Clouds') },
  { title: 'Breathing Room', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'Breathing Room') },
  { title: 'Curtain Sigh', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'Curtain Sigh') },
  { title: 'Drift Between Pages', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'Drift Between Pages') },
  { title: 'Floating Ink', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'Floating Ink') },
  { title: 'Half Remembered Room', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'Half Remembered Room') },
  { title: 'Soft Landing', category: 'Dreamscape', categorySlug: 'ambient', url: trackUrl('Ambient Drift & Dreamscapes', 'Soft Landing') },

  // Late Night, Neon & After Hours
  { title: '3 AM in a Taxi', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', '3 AM in a Taxi') },
  { title: 'After the Encore', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', 'After the Encore') },
  { title: 'Alley Glow', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', 'Alley Glow') },
  { title: 'Bar Tab Lullaby', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', 'Bar Tab Lullaby') },
  { title: 'Cigarette on the Fire Escape', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', 'Cigarette on the Fire Escape') },
  { title: 'City Drip', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', 'City Drip') },
  { title: 'Hotel Elevator Music', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', 'Hotel Elevator Music') },
  { title: 'Neon Puddle Walk', category: 'Late Night', categorySlug: 'late-night', url: trackUrl('Late Night, Neon & After Hours', 'Neon Puddle Walk') },

  // Chillhop & Cozy Beats
  { title: 'Blanket Fort Diplomacy', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Blanket Fort Diplomacy') },
  { title: 'Cloudy with a Chance of Naps', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Cloudy with a Chance of Naps') },
  { title: 'Couch Groove Philosophy', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Couch Groove Philosophy') },
  { title: 'Half Asleep on the Couch', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Half Asleep on the Couch') },
  { title: 'Hoodie Weather Groove', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Hoodie Weather Groove') },
  { title: 'Lazy Sunday Protocol', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Lazy Sunday Protocol') },
  { title: 'Pillow Talk for One', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Pillow Talk for One') },
  { title: 'Socks on Hardwood', category: 'Chill Beats', categorySlug: 'chill', url: trackUrl('Chillhop & Cozy Beats', 'Socks on Hardwood') },

  // Jazz Lounge & Bookstore Grooves
  { title: 'A Booth by the Window', category: 'Jazz Lounge', categorySlug: 'jazz', url: trackUrl('Jazz Lounge & Bookstore Grooves', 'A Booth by the Window') },
  { title: 'Bookstore Dust and Brass', category: 'Jazz Lounge', categorySlug: 'jazz', url: trackUrl('Jazz Lounge & Bookstore Grooves', 'Bookstore Dust and Brass') },
  { title: 'Cappuccino and a Novel', category: 'Jazz Lounge', categorySlug: 'jazz', url: trackUrl('Jazz Lounge & Bookstore Grooves', 'Cappuccino and a Novel') },
  { title: 'Corner Booth Serenade', category: 'Jazz Lounge', categorySlug: 'jazz', url: trackUrl('Jazz Lounge & Bookstore Grooves', 'Corner Booth Serenade') },
  { title: 'Late Set Easy Feeling', category: 'Jazz Lounge', categorySlug: 'jazz', url: trackUrl('Jazz Lounge & Bookstore Grooves', 'Late Set Easy Feeling') },
  { title: 'Vinyl and Velvet', category: 'Jazz Lounge', categorySlug: 'jazz', url: trackUrl('Jazz Lounge & Bookstore Grooves', 'Vinyl and Velvet') },
];

export function AmbientPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<number | null>(null);
  const [fabPulse, setFabPulse] = useState(false);

  const filteredTracks = activeCategory === 'all'
    ? TRACKS
    : TRACKS.filter(t => t.categorySlug === activeCategory);

  const currentTrack = filteredTracks[currentIndex % filteredTracks.length];

  // Ensure the audio element exists
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = 'none';
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = window.setInterval(() => {
      if (audioRef.current) {
        setProgress(audioRef.current.currentTime);
        setDuration(audioRef.current.duration || 0);
      }
    }, 500);
  }, []);

  const playTrack = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = filteredTracks[index % filteredTracks.length];
    if (!track) return;

    setLoadError(false);
    audio.src = track.url;
    audio.load();

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => {
        setIsPlaying(true);
        setCurrentIndex(index % filteredTracks.length);
        startProgressTracking();
      }).catch(() => {
        setLoadError(true);
        setIsPlaying(false);
      });
    }
  }, [filteredTracks, startProgressTracking]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (progressInterval.current) clearInterval(progressInterval.current);
    } else {
      if (!audio.src || audio.src === window.location.href) {
        playTrack(currentIndex);
      } else {
        audio.play().then(() => {
          setIsPlaying(true);
          startProgressTracking();
        }).catch(() => {});
      }
    }
  }, [isPlaying, currentIndex, playTrack, startProgressTracking]);

  const handleNext = useCallback(() => {
    if (shuffle) {
      const nextIdx = Math.floor(Math.random() * filteredTracks.length);
      playTrack(nextIdx);
    } else {
      playTrack((currentIndex + 1) % filteredTracks.length);
    }
  }, [shuffle, currentIndex, filteredTracks.length, playTrack]);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    playTrack((currentIndex - 1 + filteredTracks.length) % filteredTracks.length);
  }, [currentIndex, filteredTracks.length, playTrack]);

  // Auto-play next track when current ends
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        handleNext();
      }
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [handleNext, repeat]);

  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
    if (isPlaying) {
      playTrack(0);
    }
  }, [activeCategory]);

  // FAB pulse animation
  useEffect(() => {
    if (!isOpen && isPlaying) {
      const id = setInterval(() => setFabPulse(p => !p), 1500);
      return () => clearInterval(id);
    }
    setFabPulse(false);
  }, [isOpen, isPlaying]);

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setProgress(audio.currentTime);
  };

  // ── Render ──
  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '1.5rem',
            zIndex: 999,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            border: '2px solid rgba(139,92,246,0.4)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 32px rgba(139,92,246,${fabPulse ? '0.6' : '0.3'})`,
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            transform: fabPulse ? 'scale(1.08)' : 'scale(1)',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(139,92,246,0.5)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = fabPulse ? 'scale(1.08)' : 'scale(1)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(139,92,246,${fabPulse ? '0.6' : '0.3'})`; }}
          title="Open Ambient Player"
        >
          <Music size={24} />
          {isPlaying && (
            <span style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              border: '2px solid #050508',
            }} />
          )}
        </button>
      )}

      {/* Player Drawer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}>
        <div style={{
          backgroundColor: 'rgba(8,8,18,0.97)',
          backdropFilter: 'blur(30px)',
          borderTop: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.6), 0 -4px 20px rgba(139,92,246,0.15)',
        }}>

          {/* Drag handle / Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '0.6rem',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Music size={16} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'white' }}>
                  Ambient Player
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                  Lo-fi beats to watch anime to
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '0.4rem', display: 'flex', transition: 'all 0.15s' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                title="Minimize"
              >
                <ChevronDown size={18} />
              </button>
              <button
                onClick={() => { setIsOpen(false); if (audioRef.current) { audioRef.current.pause(); } setIsPlaying(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '0.4rem', display: 'flex', transition: 'all 0.15s' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                title="Close & Stop"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            padding: '0.65rem 1.25rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '9999px',
                  border: activeCategory === cat.slug ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: activeCategory === cat.slug ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                  color: activeCategory === cat.slug ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Track List */}
          <div style={{
            maxHeight: '180px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139,92,246,0.3) transparent',
          }}>
            {filteredTracks.map((track, idx) => {
              const isCurrent = idx === (currentIndex % filteredTracks.length) && currentTrack?.title === track.title;
              return (
                <button
                  key={`${track.categorySlug}-${track.title}`}
                  onClick={() => playTrack(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.6rem 1.25rem',
                    background: isCurrent ? 'rgba(139,92,246,0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.025)',
                    color: isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.75)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    fontSize: '0.8rem',
                    fontWeight: isCurrent ? 800 : 600,
                  }}
                  onMouseOver={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                  onMouseOut={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '0.4rem', flexShrink: 0,
                    background: isCurrent ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isCurrent && isPlaying ? (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 14 }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: 3, borderRadius: 1,
                            backgroundColor: 'white',
                            animation: `ambient-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <Music size={12} color={isCurrent ? 'white' : 'rgba(255,255,255,0.3)'} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{track.category}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Now Playing + Controls */}
          <div style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'linear-gradient(180deg, rgba(139,92,246,0.04), transparent)',
          }}>
            {/* Track info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.82rem', fontWeight: 900, color: 'white',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {currentTrack?.title || 'Select a track'}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#a78bfa', fontWeight: 700 }}>
                  {currentTrack?.category || '—'}
                </div>
                {loadError && (
                  <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 700, marginTop: '0.15rem' }}>
                    ⚠ Track unavailable — try another
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: '2.5em', textAlign: 'right' }}>
                {formatTime(progress)}
              </span>
              <div
                onClick={handleSeek}
                style={{
                  flex: 1, height: 4, borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{
                  width: duration ? `${(progress / duration) * 100}%` : '0%',
                  height: '100%',
                  borderRadius: 2,
                  background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                  transition: 'width 0.3s linear',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', right: -5, top: -3,
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: '#a78bfa',
                    boxShadow: '0 0 8px rgba(139,92,246,0.6)',
                    opacity: isPlaying ? 1 : 0,
                    transition: 'opacity 0.2s',
                  }} />
                </div>
              </div>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: '2.5em' }}>
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Left — Shuffle & Repeat */}
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  onClick={() => setShuffle(!shuffle)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem', borderRadius: '0.35rem',
                    color: shuffle ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                    transition: 'all 0.15s', display: 'flex',
                  }}
                  title="Shuffle"
                >
                  <Shuffle size={15} />
                </button>
                <button
                  onClick={() => setRepeat(!repeat)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem', borderRadius: '0.35rem',
                    color: repeat ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                    transition: 'all 0.15s', display: 'flex',
                  }}
                  title="Repeat"
                >
                  <Repeat size={15} />
                </button>
              </div>

              {/* Center — Prev / Play / Next */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  onClick={handlePrev}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem', borderRadius: '50%', color: 'rgba(255,255,255,0.7)', display: 'flex', transition: 'color 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.color = 'white'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                >
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={handlePlayPause}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(139,92,246,0.55)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,92,246,0.4)'; }}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
                </button>
                <button
                  onClick={handleNext}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem', borderRadius: '50%', color: 'rgba(255,255,255,0.7)', display: 'flex', transition: 'color 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.color = 'white'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                >
                  <SkipForward size={18} />
                </button>
              </div>

              {/* Right — Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', color: isMuted ? '#ef4444' : 'rgba(255,255,255,0.5)', display: 'flex', transition: 'color 0.15s' }}
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                  style={{
                    width: '70px',
                    height: '3px',
                    appearance: 'none',
                    background: `linear-gradient(to right, #8b5cf6 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)`,
                    borderRadius: '2px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animation for the bars */}
      <style>{`
        @keyframes ambient-bar {
          0% { height: 4px; }
          100% { height: 14px; }
        }
      `}</style>
    </>
  );
}
