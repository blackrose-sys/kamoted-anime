import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { AnimeCard } from '../components/AnimeCard';
import type { AnimeData } from '../components/AnimeCard';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Play } from 'lucide-react';

export function Home() {
  const [latestAnime, setLatestAnime] = useState<AnimeData[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<AnimeData[]>([]);
  const [topAnime, setTopAnime] = useState<AnimeData[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const latestRes = await fetch('https://api.jikan.moe/v4/seasons/now?limit=24');
        const latestData = await latestRes.json();
        
        await new Promise(r => setTimeout(r, 1000)); // Bypass rate limit
        
        const recentRes = await fetch('https://api.jikan.moe/v4/watch/episodes');
        const recentData = await recentRes.json();
        
        await new Promise(r => setTimeout(r, 1000)); // Bypass rate limit
        
        const topRes = await fetch('https://api.jikan.moe/v4/top/anime?limit=10');
        const topData = await topRes.json();

        if (user) {
          const { data } = await supabase.from('watch_history')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(4);
          setHistory(data || []);
        }
        
        // Map recently updated data to match AnimeData structure
        // Filter out region-locked entries and broken placeholder images
        const mappedRecent = (recentData.data || [])
          .filter((item: any) => {
            if (item.region_locked) return false;
            const imgUrl = item.entry?.images?.jpg?.image_url || '';
            if (imgUrl.includes('icon-banned') || imgUrl.includes('na.gif')) return false;
            return true;
          })
          .map((item: any) => ({
            mal_id: item.entry.mal_id,
            title: item.entry.title,
            images: item.entry.images,
            score: null,
            year: null,
            // Extract episode number from the episodes array
            episodes: item.episodes && item.episodes.length > 0 ? parseInt(item.episodes[0].title.replace(/\D/g, ''), 10) || null : null
          }));

        setLatestAnime(latestData.data || []);
        setRecentlyUpdated(mappedRecent);
        setTopAnime(topData.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  return (
    <main style={{ flex: 1, paddingBottom: '4rem' }}>
      <Hero featured={latestAnime.slice(0, 5)} />
      
      <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', flexDirection: 'row', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Main Content */}
        <div style={{ flex: '3 1 70%' }}>
          
          {/* Continue Watching Section */}
          {history.length > 0 && (
            <section style={{ marginBottom: '4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Continue Watching</h2>
              </div>
              
              <div className="grid">
                {history.map(item => (
                  <Link to={`/watch/${item.anime_id}`} key={item.id} className="hover-scale" style={{ display: 'block', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative' }}>
                      <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.5rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
                        <span style={{ backgroundColor: 'var(--accent-primary)', color: 'black', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>EP {item.last_episode}</span>
                      </div>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.8 }} className="play-icon-overlay">
                        <Play size={40} color="var(--accent-primary)" fill="var(--accent-primary)" />
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h3>
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
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                {[1,2,3,4].map(i => (
                  <div key={i} className="animate-pulse" style={{ minWidth: '200px', height: '300px', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem' }}></div>
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
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="animate-pulse" style={{ minWidth: '200px', height: '300px', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem' }}></div>
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
        <aside style={{ flex: '1 1 25%', minWidth: '300px' }}>
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
                    <img src={anime.images.webp.large_image_url} alt={anime.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '0.25rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{anime.title}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Score: {anime.score || 'N/A'}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>

      </div>
    </main>
  );
}
