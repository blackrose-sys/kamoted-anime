import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { QuizModal } from '../components/QuizModal';
import { AnimeCard } from '../components/AnimeCard';
import type { AnimeData } from '../components/AnimeCard';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getAnimeDetails } from '../lib/animeServers';
import { Play, AlertCircle, RefreshCw } from 'lucide-react';
import { ChatSidebar } from '../components/ChatSidebar';

// --- Caching Layer ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch { return null; }
}

function setCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full, ignore */ }
}

// --- Fetch with Retry ---
async function fetchWithRetry(url: string, retries = 3, delayMs = 1500): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        // Rate limited — wait and retry
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

export function Home() {
  const [latestAnime, setLatestAnime] = useState<AnimeData[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<AnimeData[]>([]);
  const [topAnime, setTopAnime] = useState<AnimeData[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [friendActivity, setFriendActivity] = useState<any[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // --- Fetch anime data (separate from user data) ---
  const fetchAnimeData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Latest this season (check cache first)
    let latestData: AnimeData[] = [];
    try {
      const cached = getCached<AnimeData[]>('home_latest');
      if (cached) {
        latestData = cached;
      } else {
        const res = await fetchWithRetry('https://api.jikan.moe/v4/seasons/now?sfw=true&limit=24');
        const rawList = res.data || [];
        const seenIds = new Set<number>();
        const uniqueList: AnimeData[] = [];
        
        for (const anime of rawList) {
          if (!seenIds.has(anime.mal_id)) {
            const img = anime.images?.jpg?.image_url || '';
            if (!img.includes('icon-banned') && !img.includes('na.gif')) {
              seenIds.add(anime.mal_id);
              uniqueList.push(anime);
            }
          }
        }
        latestData = uniqueList;
        setCache('home_latest', latestData);
      }
      setLatestAnime(latestData);
    } catch (err) {
      console.error('Failed to fetch latest season data:', err);
    }

    // Small delay to avoid rate limit
    await new Promise(r => setTimeout(r, 600));

    // 2. Recently updated (check cache first)
    try {
      let recentData = getCached<AnimeData[]>('home_recent');
      if (!recentData) {
        const query = `
          query ($airingAtGreater: Int, $airingAtLesser: Int) {
            Page(page: 1, perPage: 50) {
              airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME_DESC) {
                episode
                media {
                  idMal
                  isAdult
                  title {
                    romaji
                    english
                    userPreferred
                  }
                  coverImage {
                    large
                  }
                  averageScore
                  seasonYear
                }
              }
            }
          }
        `;

        const now = Math.floor(Date.now() / 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60);

        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: {
              airingAtGreater: sevenDaysAgo,
              airingAtLesser: now
            }
          })
        });

        const resData = await response.json();
        const schedules = resData?.data?.Page?.airingSchedules || [];

        const mapped = schedules
          .filter((s: any) => s.media && s.media.idMal && !s.media.isAdult)
          .map((s: any) => ({
            mal_id: s.media.idMal,
            title: s.media.title.english || s.media.title.userPreferred || s.media.title.romaji,
            images: {
              jpg: {
                image_url: s.media.coverImage.large,
                large_image_url: s.media.coverImage.large
              }
            },
            score: s.media.averageScore ? s.media.averageScore / 10 : null,
            year: s.media.seasonYear || null,
            episodes: s.episode
          }));

        // Deduplicate recent episodes
        const seenIds = new Set<number>();
        const uniqueRecent: AnimeData[] = [];
        for (const anime of mapped) {
          if (!seenIds.has(anime.mal_id)) {
            seenIds.add(anime.mal_id);
            uniqueRecent.push(anime);
          }
        }

        // Pad list up to 24 items with currently airing shows
        const fallbackAiring = latestData || [];
        const combined = [...uniqueRecent];
        for (const airing of fallbackAiring) {
          if (combined.length >= 24) break;
          if (!seenIds.has(airing.mal_id)) {
            seenIds.add(airing.mal_id);
            combined.push(airing);
          }
        }

        recentData = combined.slice(0, 24);
        setCache('home_recent', recentData);
      }
      setRecentlyUpdated(recentData || []);
    } catch (err) {
      console.error('Failed to fetch recently updated data from AniList, trying Jikan fallback...', err);
      try {
        const fallbackRes = await fetchWithRetry('https://api.jikan.moe/v4/watch/episodes');
        const raw = fallbackRes.data || [];
        const mapped = raw.map((item: any) => ({
          mal_id: item.entry.mal_id,
          title: item.entry.title,
          images: {
            jpg: {
              image_url: item.entry.images?.jpg?.image_url || '',
              large_image_url: item.entry.images?.jpg?.large_image_url || ''
            },
            webp: {
              image_url: item.entry.images?.webp?.image_url || '',
              large_image_url: item.entry.images?.webp?.large_image_url || ''
            }
          },
          score: null,
          year: null,
          season: null,
          episodes: item.episodes && item.episodes[0] 
            ? parseInt(item.episodes[0].title.replace(/\D/g, '')) || null 
            : null
        }));

        const seenIds = new Set<number>();
        const uniqueRecent: AnimeData[] = [];
        for (const anime of mapped) {
          if (!seenIds.has(anime.mal_id)) {
            seenIds.add(anime.mal_id);
            uniqueRecent.push(anime);
          }
        }
        
        // Pad list up to 24 items with currently airing shows if needed
        const combined = [...uniqueRecent];
        for (const airing of latestData) {
          if (combined.length >= 24) break;
          if (!seenIds.has(airing.mal_id)) {
            seenIds.add(airing.mal_id);
            combined.push(airing);
          }
        }

        const recentData = combined.slice(0, 24);
        setRecentlyUpdated(recentData);
        setCache('home_recent', recentData);
      } catch (fallbackErr) {
        console.error('Jikan fallback failed too:', fallbackErr);
        // Absolute fallback
        setRecentlyUpdated(latestData.slice(0, 24));
      }
    }

    // Small delay
    await new Promise(r => setTimeout(r, 600));

    // 3. Top anime (check cache first)
    try {
      let topData = getCached<AnimeData[]>('home_top');
      if (!topData) {
        const res = await fetchWithRetry('https://api.jikan.moe/v4/top/anime?sfw=true&limit=10');
        const rawList = res.data || [];
        const seenIds = new Set<number>();
        const uniqueList: AnimeData[] = [];
        
        for (const anime of rawList) {
          if (!seenIds.has(anime.mal_id)) {
            seenIds.add(anime.mal_id);
            uniqueList.push(anime);
          }
        }
        topData = uniqueList;
        setCache('home_top', topData);
      }
      setTopAnime(topData || []);
    } catch (err) {
      console.error('Failed to fetch top anime data:', err);
    }

    // Only show error if both main sections completely failed to load
    if (latestData.length === 0) {
      setError('Failed to load anime data. Please refresh the page.');
    }
    setLoading(false);
  }, []);

  // Fetch anime data ONCE on mount (no dependency on user)
  useEffect(() => {
    fetchAnimeData();
  }, [fetchAnimeData]);

  // Fetch user history & preferences & friends activity
  useEffect(() => {
    if (!user) {
      setHistory([]);
      setFriendActivity([]);
      return;
    }
    
    // 1. Get user watch history
    supabase.from('watch_history')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(6)
      .then(async ({ data }) => {
        const items = data || [];
        setHistory(items);
        for (const item of items) {
          if (!item.title || item.title === 'Loading...' || !item.image_url || item.image_url === '' || item.image_url === 'Loading...') {
            try {
              const resolved = await getAnimeDetails(item.anime_id);
              if (resolved.title || resolved.image_url) {
                const newTitle = (resolved.title && resolved.title !== 'Loading...') ? resolved.title : (item.title !== 'Loading...' ? item.title : `Anime #${item.anime_id}`);
                const newImg = resolved.image_url || item.image_url;
                setHistory(prev => prev.map(h => h.id === item.id ? { ...h, title: newTitle, image_url: newImg } : h));
                supabase.from('watch_history').update({ title: newTitle, image_url: newImg }).eq('id', item.id).then();
              }
            } catch (e) { /* ignore */ }
          }
        }
      });

    // 2. Check if genre preferences exist, else show Quiz
    supabase.from('profiles')
      .select('genre_prefs')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && (!data.genre_prefs || (Array.isArray(data.genre_prefs) && data.genre_prefs.length === 0) || Object.keys(data.genre_prefs).length === 0)) {
          setShowQuiz(true);
        }
      });

    // 3. Get followed users recent activity
    supabase.from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .then(async ({ data: followsData }) => {
        const followingIds = followsData?.map(f => f.following_id) || [];
        if (followingIds.length > 0) {
          const { data: historyItems } = await supabase
            .from('watch_history')
            .select('*')
            .in('user_id', followingIds)
            .order('updated_at', { ascending: false })
            .limit(5);

          if (historyItems && historyItems.length > 0) {
            const userIds = Array.from(new Set(historyItems.map(item => item.user_id)));
            const { data: userProfiles } = await supabase
              .from('profiles')
              .select('id, username, avatar_url')
              .in('id', userIds);

            const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || []);
            const enriched = historyItems.map(item => ({
              ...item,
              profile: profileMap.get(item.user_id) || { username: 'Otaku', avatar_url: null }
            }));
            setFriendActivity(enriched);
          }
        }
      });
  }, [user]);

  return (
    <main style={{ flex: 1, paddingBottom: '4rem' }}>
      <Hero featured={latestAnime.slice(0, 5)} />
      
      <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', flexDirection: 'row', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Main Content */}
        <div style={{ flex: '3 1 70%' }}>

          {/* Error State */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '1rem', marginBottom: '2rem' }}>
              <AlertCircle size={24} color="#ef4444" />
              <span style={{ color: '#fca5a5', flex: 1 }}>{error}</span>
              <button onClick={fetchAnimeData} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          )}
          
          {/* Continue Watching Section */}
          {history.length > 0 && (
            <section style={{ marginBottom: '4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Continue Watching</h2>
              </div>
              
              <div className="grid">
                {history.map(item => (
                  <Link to={`/watch/${item.anime_id}`} key={item.id} className="hover-scale" style={{ display: 'block', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '100%', aspectRatio: '2/3', position: 'relative' }}>
                      <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.5rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
                        <span style={{ backgroundColor: 'var(--accent-primary)', color: 'black', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>EP {item.last_episode}</span>
                      </div>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.8 }}>
                        <Play size={40} color="var(--accent-primary)" fill="var(--accent-primary)" />
                      </div>
                    </div>
                    <div style={{ padding: '0.5rem' }}>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recently Updated Section */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Recently Updated</h2>
              <Link to="/browse?tab=recent" style={{ color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 700 }}>View All</Link>
            </div>

            {loading ? (
              <div className="grid">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="animate-pulse" style={{ aspectRatio: '2/3', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '0.75rem' }}></div>
                ))}
              </div>
            ) : (
              <div className="grid">
                {recentlyUpdated.map((anime, idx) => (
                  <AnimeCard key={`recent-${anime.mal_id}-${idx}`} anime={anime} />
                ))}
              </div>
            )}
          </section>

          {/* Latest This Season */}
          <section style={{ marginTop: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Latest This Season</h2>
              <Link to="/browse?tab=season" style={{ color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 700 }}>View All</Link>
            </div>

            {loading ? (
              <div className="grid">
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className="animate-pulse" style={{ aspectRatio: '2/3', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '0.75rem' }}></div>
                ))}
              </div>
            ) : (
              <div className="grid">
                {latestAnime.map(anime => (
                  <AnimeCard key={anime.mal_id} anime={anime} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside style={{ flex: '1 1 25%', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Top Anime Card */}
          <div style={{ backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>Top Anime</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loading ? (
                 [1,2,3,4,5].map(i => (
                  <div key={i} className="animate-pulse" style={{ height: '60px', backgroundColor: 'var(--bg-color-tertiary)', borderRadius: '0.5rem' }}></div>
                ))
              ) : (
                topAnime.map((anime, idx) => (
                  <Link to={`/watch/${anime.mal_id}`} key={anime.mal_id} className="hover-scale" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: idx < 3 ? 'var(--accent-primary)' : 'var(--text-secondary)', minWidth: '30px' }}>
                      {idx + 1}
                    </div>
                    <img src={anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || ''} alt={anime.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '0.25rem' }} loading="lazy" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{anime.title}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Score: {anime.score || 'N/A'}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Friends Activity Widget */}
          {user && friendActivity.length > 0 && (
            <div style={{ backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                👥 Friends Activity
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {friendActivity.map((activity, idx) => (
                  <div key={`act-${activity.id}-${idx}`} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Link to={`/user/${activity.profile.username}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        color: 'white',
                        overflow: 'hidden'
                      }}>
                        {activity.profile.avatar_url ? (
                          <img src={activity.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          activity.profile.username.charAt(0).toUpperCase()
                        )}
                      </div>
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', lineHeight: 1.3 }}>
                        <Link to={`/user/${activity.profile.username}`} style={{ color: 'var(--accent-primary)', fontWeight: 800, textDecoration: 'none' }} className="hover-underline">
                          {activity.profile.username}
                        </Link>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>watched EP</span>{' '}
                        <span style={{ color: 'white', fontWeight: 700 }}>{activity.last_episode}</span>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>of</span>
                      </div>
                      <Link to={`/watch/${activity.anime_id}`} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'white', textDecoration: 'none', marginTop: '0.15rem' }} className="hover-underline">
                        {activity.title}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

      </div>
      <ChatSidebar />

      {showQuiz && (
        <QuizModal 
          onClose={() => setShowQuiz(false)} 
          onComplete={(prefs) => {
            setShowQuiz(false);
            console.log('Quiz completed with prefs:', prefs);
          }} 
        />
      )}
    </main>
  );
}
