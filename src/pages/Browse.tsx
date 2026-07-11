import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Loader2, Filter, Clock, Tv, Compass } from 'lucide-react';
import { AnimeCard } from '../components/AnimeCard';
import type { AnimeData } from '../components/AnimeCard';

const GENRES = [
  { id: '', name: 'All Genres' },
  { id: 'Action', name: 'Action' },
  { id: 'Adventure', name: 'Adventure' },
  { id: 'Comedy', name: 'Comedy' },
  { id: 'Drama', name: 'Drama' },
  { id: 'Fantasy', name: 'Fantasy' },
  { id: 'Horror', name: 'Horror' },
  { id: 'Romance', name: 'Romance' },
  { id: 'Sci-Fi', name: 'Sci-Fi' },
  { id: 'Slice of Life', name: 'Slice of Life' },
];

const getCurrentSeasonAndYear = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  
  let season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' = 'WINTER';
  if (month >= 2 && month <= 4) {
    season = 'SPRING';
  } else if (month >= 5 && month <= 7) {
    season = 'SUMMER';
  } else if (month >= 8 && month <= 10) {
    season = 'FALL';
  }
  
  return { season, year };
};

const mapAniListMedia = (mediaList: any[]): AnimeData[] => {
  return mediaList
    .filter((m: any) => m && m.idMal)
    .map((m: any) => ({
      mal_id: m.idMal,
      title: m.title.english || m.title.userPreferred || m.title.romaji,
      images: {
        jpg: {
          image_url: m.coverImage.large,
          large_image_url: m.coverImage.large
        },
        webp: {
          image_url: m.coverImage.large,
          large_image_url: m.coverImage.large
        }
      },
      score: m.averageScore ? m.averageScore / 10 : null,
      year: m.seasonYear || null,
      season: m.season || null,
      episodes: m.episodes || null
    }));
};

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
          let mapped: AnimeData[] = [];
          try {
            const queryText = `
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
                      season
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
                query: queryText,
                variables: {
                  airingAtGreater: sevenDaysAgo,
                  airingAtLesser: now
                }
              })
            });

            const resData = await response.json();
            const schedules = resData?.data?.Page?.airingSchedules || [];

            mapped = schedules
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
                season: s.media.season || null,
                episodes: s.episode
              }));
          } catch (err) {
            console.error('Failed to fetch AniList schedules in Browse, using Jikan fallback...', err);
            try {
              const fallbackRes = await fetch('https://api.jikan.moe/v4/watch/episodes');
              const fallbackData = await fallbackRes.json();
              const raw = fallbackData.data || [];
              mapped = raw.map((item: any) => ({
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
            } catch (fallbackErr) {
              console.error('Jikan fallback failed in Browse:', fallbackErr);
            }
          }

          // Deduplicate
          const seenIds = new Set<number>();
          const uniqueRecent: AnimeData[] = [];
          for (const anime of mapped) {
            if (!seenIds.has(anime.mal_id)) {
              seenIds.add(anime.mal_id);
              uniqueRecent.push(anime);
            }
          }

          // Fetch current season airing shows to pad up to 24 if needed
          let seasonFiltered: AnimeData[] = [];
          try {
            const queryText = `
              query ($season: MediaSeason, $seasonYear: Int) {
                Page(page: 1, perPage: 24) {
                  media(season: $season, seasonYear: $seasonYear, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
                    idMal
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
                    season
                    episodes
                  }
                }
              }
            `;
            const { season, year } = getCurrentSeasonAndYear();
            const response = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: queryText,
                variables: { season, seasonYear: year }
              })
            });
            const resData = await response.json();
            const media = resData?.data?.Page?.media || [];
            seasonFiltered = mapAniListMedia(media);
          } catch (seasonErr) {
            console.error('Failed to fetch season padding via AniList, trying Jikan fallback:', seasonErr);
            try {
              const seasonRes = await fetch('https://api.jikan.moe/v4/seasons/now?sfw=true&limit=24');
              const seasonData = await seasonRes.json();
              seasonFiltered = (seasonData.data || []).filter((anime: any) => {
                const imgUrl = anime.images?.jpg?.image_url || '';
                return !imgUrl.includes('icon-banned') && !imgUrl.includes('na.gif');
              });
            } catch (fallbackErr) {
              console.error('Jikan season padding fallback failed:', fallbackErr);
            }
          }

          const combined = [...uniqueRecent];
          for (const airing of seasonFiltered) {
            if (combined.length >= 24) break;
            if (!seenIds.has(airing.mal_id)) {
              seenIds.add(airing.mal_id);
              combined.push(airing);
            }
          }

          setResults(combined.slice(0, 24));
          setHasNextPage(false);
        } else if (activeTab === 'season') {
          // Fetch current season anime with pagination via AniList
          try {
            const queryText = `
              query ($page: Int, $season: MediaSeason, $seasonYear: Int) {
                Page(page: $page, perPage: 24) {
                  pageInfo {
                    hasNextPage
                  }
                  media(season: $season, seasonYear: $seasonYear, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
                    idMal
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
                    season
                    episodes
                  }
                }
              }
            `;
            const { season, year } = getCurrentSeasonAndYear();
            const response = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: queryText,
                variables: { page, season, seasonYear: year }
              })
            });
            const resData = await response.json();
            const media = resData?.data?.Page?.media || [];
            const hasNext = resData?.data?.Page?.pageInfo?.hasNextPage || false;
            const mapped = mapAniListMedia(media);

            if (page === 1) {
              setResults(mapped);
            } else {
              setResults(prev => {
                const seen = new Set(prev.map(a => a.mal_id));
                const uniqueNew = mapped.filter(a => !seen.has(a.mal_id));
                return [...prev, ...uniqueNew];
              });
            }
            setHasNextPage(hasNext);
          } catch (err) {
            console.error('Failed to fetch season via AniList, trying Jikan fallback...', err);
            // Jikan fallback
            const res = await fetch(`https://api.jikan.moe/v4/seasons/now?sfw=true&limit=24&page=${page}`);
            const data = await res.json();
            const filtered = (data.data || []).filter((anime: any) => {
              const imgUrl = anime.images?.jpg?.image_url || '';
              return !imgUrl.includes('icon-banned') && !imgUrl.includes('na.gif');
            });
            if (page === 1) {
              setResults(filtered);
            } else {
              setResults(prev => {
                const seen = new Set(prev.map(a => a.mal_id));
                const uniqueNew = filtered.filter((a: any) => !seen.has(a.mal_id));
                return [...prev, ...uniqueNew];
              });
            }
            setHasNextPage(data.pagination?.has_next_page || false);
          }
        } else {
          // Discover tab - search + genre filter via AniList
          try {
            const queryText = `
              query ($page: Int, $search: String, $genre: String, $sort: [MediaSort]) {
                Page(page: $page, perPage: 24) {
                  pageInfo {
                    hasNextPage
                  }
                  media(search: $search, genre: $genre, type: ANIME, isAdult: false, sort: $sort) {
                    idMal
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
                    season
                    episodes
                  }
                }
              }
            `;
            const variables: any = {
              page,
              sort: query.trim() ? ['SEARCH_MATCH'] : ['POPULARITY_DESC']
            };
            if (query.trim()) variables.search = query;
            if (genre) variables.genre = genre;

            const response = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: queryText,
                variables
              })
            });
            const resData = await response.json();
            const media = resData?.data?.Page?.media || [];
            const hasNext = resData?.data?.Page?.pageInfo?.hasNextPage || false;
            const mapped = mapAniListMedia(media);

            if (page === 1) {
              setResults(mapped);
            } else {
              setResults(prev => {
                const seen = new Set(prev.map(a => a.mal_id));
                const uniqueNew = mapped.filter(a => !seen.has(a.mal_id));
                return [...prev, ...uniqueNew];
              });
            }
            setHasNextPage(hasNext);
          } catch (err) {
            console.error('Failed to discover via AniList, trying Jikan fallback...', err);
            // Jikan fallback
            let url = 'https://api.jikan.moe/v4/anime?limit=24';
            if (query.trim()) {
              url += `&q=${encodeURIComponent(query)}`;
            } else {
              url += '&order_by=popularity&sort=asc&sfw=true';
            }
            url += `&page=${page}`;
            if (genre) {
              const genreMap: Record<string, string> = {
                'Action': '1', 'Adventure': '2', 'Comedy': '4', 'Drama': '8',
                'Fantasy': '10', 'Horror': '14', 'Romance': '22', 'Sci-Fi': '24', 'Slice of Life': '36'
              };
              const jikanGenreId = genreMap[genre];
              if (jikanGenreId) url += `&genres=${jikanGenreId}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            const raw = data.data || [];
            if (page === 1) {
              setResults(raw);
            } else {
              setResults(prev => {
                const seen = new Set(prev.map(a => a.mal_id));
                const uniqueNew = raw.filter((a: any) => !seen.has(a.mal_id));
                return [...prev, ...uniqueNew];
              });
            }
            setHasNextPage(data.pagination?.has_next_page || false);
          }
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
