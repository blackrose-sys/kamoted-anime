import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Loader2, Filter, Clock, Tv, Compass } from 'lucide-react';
import { AnimeCard } from '../components/AnimeCard';
import type { AnimeData } from '../components/AnimeCard';

const GENRES = [
  { id: '', name: 'All Genres' },
  { id: '1', name: 'Action' },
  { id: '2', name: 'Adventure' },
  { id: '4', name: 'Comedy' },
  { id: '8', name: 'Drama' },
  { id: '10', name: 'Fantasy' },
  { id: '14', name: 'Horror' },
  { id: '22', name: 'Romance' },
  { id: '24', name: 'Sci-Fi' },
  { id: '36', name: 'Slice of Life' },
];

type TabType = 'discover' | 'recent' | 'season';

export function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('tab') as TabType) || 'discover');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [results, setResults] = useState<AnimeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Sync tab with URL params
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['discover', 'recent', 'season'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams(tab === 'discover' ? {} : { tab });
    setResults([]);
    setPage(1);
    setQuery('');
    setGenre('');
  };

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        if (activeTab === 'recent') {
          // Fetch recently updated episodes
          const res = await fetch('https://api.jikan.moe/v4/watch/episodes');
          const data = await res.json();
          const watchEpisodes = (data.data || [])
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
              episodes: item.episodes && item.episodes.length > 0 
                ? parseInt(item.episodes[0].title.replace(/\D/g, ''), 10) || null 
                : null
            }));

          // Deduplicate
          const seenIds = new Set<number>();
          const uniqueRecent: AnimeData[] = [];
          for (const anime of watchEpisodes) {
            if (!seenIds.has(anime.mal_id)) {
              seenIds.add(anime.mal_id);
              uniqueRecent.push(anime);
            }
          }

          // Fetch current season airing shows to pad up to 24
          const seasonRes = await fetch('https://api.jikan.moe/v4/seasons/now?limit=24');
          const seasonData = await seasonRes.json();
          const seasonFiltered = (seasonData.data || []).filter((anime: any) => {
            const imgUrl = anime.images?.jpg?.image_url || '';
            return !imgUrl.includes('icon-banned') && !imgUrl.includes('na.gif');
          });

          const combined = [...uniqueRecent];
          for (const airing of seasonFiltered) {
            if (combined.length >= 24) break;
            if (!seenIds.has(airing.mal_id)) {
              seenIds.add(airing.mal_id);
              combined.push(airing);
            }
          }

          setResults(combined);
          setHasNextPage(false);
        } else if (activeTab === 'season') {
          // Fetch current season anime with pagination
          const res = await fetch(`https://api.jikan.moe/v4/seasons/now?limit=24&page=${page}`);
          const data = await res.json();
          const filtered = (data.data || []).filter((anime: any) => {
            const imgUrl = anime.images?.jpg?.image_url || '';
            return !imgUrl.includes('icon-banned') && !imgUrl.includes('na.gif');
          });
          if (page === 1) {
            const seen = new Set<number>();
            const unique = filtered.filter((a: any) => {
              if (seen.has(a.mal_id)) return false;
              seen.add(a.mal_id);
              return true;
            });
            setResults(unique);
          } else {
            setResults(prev => {
              const seen = new Set(prev.map(a => a.mal_id));
              const uniqueNew = filtered.filter((a: any) => {
                if (seen.has(a.mal_id)) return false;
                seen.add(a.mal_id);
                return true;
              });
              return [...prev, ...uniqueNew];
            });
          }
          setHasNextPage(data.pagination?.has_next_page || false);
        } else {
          // Discover tab - search + genre filter
          let url = 'https://api.jikan.moe/v4/anime?sfw=true&limit=24';
          url += `&page=${page}`;
          
          if (query.trim()) {
            url += `&q=${encodeURIComponent(query)}`;
          } else {
            url += '&order_by=popularity&sort=asc';
          }
          
          if (genre) url += `&genres=${genre}`;

          const res = await fetch(url);
          const data = await res.json();
          const raw = data.data || [];
          if (page === 1) {
            const seen = new Set<number>();
            const unique = raw.filter((a: any) => {
              if (seen.has(a.mal_id)) return false;
              seen.add(a.mal_id);
              return true;
            });
            setResults(unique);
          } else {
            setResults(prev => {
              const seen = new Set(prev.map(a => a.mal_id));
              const uniqueNew = raw.filter((a: any) => {
                if (seen.has(a.mal_id)) return false;
                seen.add(a.mal_id);
                return true;
              });
              return [...prev, ...uniqueNew];
            });
          }
          setHasNextPage(data.pagination?.has_next_page || false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, activeTab === 'discover' ? 500 : 0);
    return () => clearTimeout(debounce);
  }, [query, genre, activeTab, page]);

  // Reset page when query/genre/tab changes
  useEffect(() => {
    setPage(1);
  }, [query, genre, activeTab]);

  const TABS = [
    { id: 'discover' as TabType, label: 'Discover', icon: Compass },
    { id: 'recent' as TabType, label: 'Recently Updated', icon: Clock },
    { id: 'season' as TabType, label: 'Latest This Season', icon: Tv },
  ];

  const getTitle = () => {
    switch (activeTab) {
      case 'recent': return 'Recently Updated';
      case 'season': return 'Latest This Season';
      default: return 'Discover Anime';
    }
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'recent': return 'Anime that just dropped new episodes. Updated in real-time.';
      case 'season': return 'All anime currently airing this season.';
      default: return 'Search through thousands of anime or use our advanced filters.';
    }
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem 4rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
          {activeTab === 'discover' ? (
            <>Discover <span style={{ color: 'var(--accent-primary)' }}>Anime</span></>
          ) : (
            <span style={{ color: 'var(--accent-primary)' }}>{getTitle()}</span>
          )}
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          {getSubtitle()}
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '9999px',
                backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-color-secondary)',
                color: isActive ? 'black' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border-color)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search & Filter - Only show on Discover tab */}
      {activeTab === 'discover' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', maxWidth: '800px', margin: '0 auto 3rem auto', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <Search size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search anime..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', backgroundColor: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', fontSize: '1rem', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>
          
          <div style={{ flex: '0 0 auto', position: 'relative' }}>
            <Filter size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <select 
              value={genre}
              onChange={e => setGenre(e.target.value)}
              style={{ appearance: 'none', padding: '1rem 3rem', borderRadius: '1rem', backgroundColor: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', fontSize: '1rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            >
              {GENRES.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && results.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
        </div>
      ) : (
        <>
          <div className="grid">
            {results.map((anime, idx) => (
              <AnimeCard key={`${anime.mal_id}-${idx}`} anime={anime} />
            ))}
          </div>

          {/* Load More Button */}
          {hasNextPage && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
              <button
                onClick={() => setPage(prev => prev + 1)}
                className="btn-primary"
                style={{ padding: '1rem 3rem' }}
              >
                Load More
              </button>
            </div>
          )}
          {loading && results.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
              <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
            </div>
          )}
        </>
      )}
    </main>
  );
}
