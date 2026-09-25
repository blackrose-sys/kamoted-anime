import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

interface AiringSchedule {
  id: number;
  episode: number;
  airingAt: number;
  media: {
    id: number;
    idMal: number | null;
    title: {
      userPreferred: string;
      english: string | null;
      romaji: string | null;
    };
    coverImage: {
      large: string;
    };
    genres: string[];
  };
}

// Countdown component for real-time countdown to exact airing timestamp
function AiringCountdown({ airingAt }: { airingAt: number }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const difference = (airingAt * 1000) - Date.now();
      if (difference <= 0) {
        setTimeLeft('Aired / Airing Now');
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);

      setTimeLeft(parts.join(' ') + ' left');
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000); // update every minute
    return () => clearInterval(interval);
  }, [airingAt]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
      <Clock size={12} />
      <span>{timeLeft}</span>
    </div>
  );
}

export function Calendar() {
  const [schedules, setSchedules] = useState<AiringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string>('');

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    // Default active day to today
    const today = new Date().getDay();
    setActiveDay(daysOfWeek[today]);

    const fetchSchedules = async () => {
      setLoading(true);
      setError(null);

      // Check cache first
      try {
        const cached = sessionStorage.getItem('calendar_schedules');
        if (cached) {
          const { data: cachedData, ts } = JSON.parse(cached);
          if (Date.now() - ts < 10 * 60 * 1000) { // 10 min cache
            setSchedules(cachedData);
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }

      const query = `
        query ($page: Int, $airingAtGreater: Int, $airingAtLesser: Int) {
          Page(page: $page, perPage: 50) {
            airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
              id
              episode
              airingAt
              media {
                id
                idMal
                isAdult
                title {
                  userPreferred
                  english
                  romaji
                }
                coverImage {
                  large
                }
                genres
              }
            }
          }
        }
      `;

      // Next 7 days
      const now = Math.floor(Date.now() / 1000);
      const sevenDaysLater = now + (7 * 24 * 60 * 60);

      try {
        // Fetch 2 pages for better coverage
        const allSchedules: AiringSchedule[] = [];
        
        for (let page = 1; page <= 2; page++) {
          const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables: {
                page,
                airingAtGreater: now - 3600,
                airingAtLesser: sevenDaysLater
              }
            })
          });

          if (!response.ok) {
            throw new Error(`AniList HTTP ${response.status}`);
          }

          const data = await response.json();
          
          if (data.errors) {
            console.warn('AniList GraphQL errors:', data.errors);
            throw new Error(data.errors[0]?.message || 'GraphQL error');
          }

          const rawList = data?.data?.Page?.airingSchedules || [];
          // Filter out adult content and entries without MAL ID
          const filtered = rawList.filter((s: any) => s.media && !s.media.isAdult && s.media.idMal);
          allSchedules.push(...filtered);
          
          if (rawList.length < 50) break; // No more pages
          
          // Small delay between pages
          if (page < 2) await new Promise(r => setTimeout(r, 300));
        }

        // Deduplicate by media id
        const seen = new Set<number>();
        const unique = allSchedules.filter(s => {
          if (seen.has(s.media.id)) return false;
          seen.add(s.media.id);
          return true;
        });

        setSchedules(unique);
        
        // Cache
        try {
          sessionStorage.setItem('calendar_schedules', JSON.stringify({ data: unique, ts: Date.now() }));
        } catch { /* storage full */ }
      } catch (err) {
        console.warn('AniList airing query failed, trying Jikan schedules fallback...', err);
        // Fallback to Jikan schedules
        try {
          const today = daysOfWeek[new Date().getDay()].toLowerCase();
          const fallbackRes = await fetch(`https://api.jikan.moe/v4/schedules?filter=${today}&limit=50&sfw=true`);
          const fallbackData = await fallbackRes.json();
          if (fallbackData && fallbackData.data && fallbackData.data.length > 0) {
            const mapped = fallbackData.data.map((item: any, idx: number) => {
              return {
                id: item.mal_id || idx,
                episode: 1,
                airingAt: Math.floor(Date.now() / 1000) + (idx * 1800), // Stagger times
                media: {
                  id: item.mal_id,
                  idMal: item.mal_id,
                  title: {
                    userPreferred: item.title,
                    english: item.title_english || null,
                    romaji: item.title_japanese || null
                  },
                  coverImage: {
                    large: item.images?.webp?.large_image_url || item.images?.webp?.image_url || item.images?.jpg?.image_url || ''
                  },
                  genres: item.genres?.map((g: any) => g.name) || []
                }
              };
            });
            setSchedules(mapped);
          } else {
            setError('No schedule data available. Try refreshing.');
          }
        } catch (jikanErr) {
          console.error('Jikan fallback also failed:', jikanErr);
          setError('Failed to load release calendar. Check your network connection or try disabling ad-blockers.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, []);

  // Group schedules by local day of week
  const groupedSchedules = schedules.reduce((groups, item) => {
    const localDate = new Date(item.airingAt * 1000);
    const dayName = daysOfWeek[localDate.getDay()];
    if (!groups[dayName]) {
      groups[dayName] = [];
    }
    groups[dayName].push(item);
    return groups;
  }, {} as Record<string, AiringSchedule[]>);

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', width: '100%', maxWidth: '1000px' }}>
        <CalendarIcon size={32} color="var(--accent-primary)" />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Release Calendar</h1>
      </div>

      {/* Weekday Selection Bar */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        width: '100%',
        maxWidth: '1000px',
        overflowX: 'auto',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--border-color)',
        scrollbarWidth: 'none'
      }}>
        {daysOfWeek.map((day) => {
          const count = groupedSchedules[day]?.length || 0;
          const isActive = activeDay === day;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                backgroundColor: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.02)',
                color: isActive ? 'black' : 'white',
                border: '1px solid var(--border-color)',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexShrink: 0
              }}
            >
              <span>{day.substring(0, 3).toUpperCase()}</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '0.25rem',
                backgroundColor: isActive ? 'black' : 'var(--bg-color-tertiary)',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 900
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Release List */}
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
          </div>
        ) : error ? (
          <div className="glass" style={{ padding: '3rem 2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', marginTop: '1rem' }}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        ) : !groupedSchedules[activeDay] || groupedSchedules[activeDay].length === 0 ? (
          <div className="glass" style={{ padding: '4rem 2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div>No scheduled releases for {activeDay}</div>
          </div>
        ) : (
          groupedSchedules[activeDay].map((s) => {
            const malId = s.media.idMal;
            const airTime = new Date(s.airingAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div 
                key={s.id} 
                className="glass hover-scale" 
                style={{ 
                  display: 'flex', 
                  gap: '1.5rem', 
                  padding: '1.25rem', 
                  borderRadius: '1rem', 
                  border: '1px solid var(--border-color)', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  position: 'relative'
                }}
              >
                {/* Anime Cover */}
                <div style={{ width: '80px', aspectRatio: '2/3', borderRadius: '0.5rem', overflow: 'hidden', backgroundColor: 'var(--bg-color-tertiary)', flexShrink: 0 }}>
                  <img src={s.media.coverImage.large} alt={s.media.title.userPreferred} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: '0.5rem', lineHeight: 1.2 }}>{s.media.title.userPreferred}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {s.media.genres.slice(0, 3).map((g) => (
                      <span key={g} style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        {g}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={14} />
                      <span>{airTime} Local Time</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-primary)', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '0.25rem' }}>
                      EPISODE {s.episode}
                    </div>
                  </div>
                </div>

                {/* Countdown & Navigation */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem', marginLeft: 'auto', flexShrink: 0 }}>
                  <AiringCountdown airingAt={s.airingAt} />
                  {malId ? (
                    <Link 
                      to={`/watch/${malId}`} 
                      className="btn-primary" 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.25rem', 
                        padding: '0.4rem 0.8rem', 
                        fontSize: '0.75rem', 
                        fontWeight: 900,
                        textDecoration: 'none'
                      }}
                    >
                      Watch <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Airing Soon</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </main>
  );
}
