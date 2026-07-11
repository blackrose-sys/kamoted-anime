import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Star, Calendar, Play, Loader2, Newspaper, Flame, RefreshCw } from 'lucide-react';

interface NewsAnime {
  mal_id: number;
  title: string;
  image_url: string;
  score: number | null;
  synopsis: string;
  episodes: number | null;
  year: number | null;
  season: string | null;
  status: string;
  genres: string[];
  rank: number | null;
  popularity: number | null;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (!score) return null;
  const color = score >= 8 ? '#22c55e' : score >= 7 ? '#f59e0b' : '#94a3b8';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      backgroundColor: `${color}18`, border: `1px solid ${color}35`,
      color, padding: '0.2rem 0.5rem', borderRadius: '9999px',
      fontSize: '0.72rem', fontWeight: 900
    }}>
      <Star size={10} fill={color} /> {score.toFixed(1)}
    </span>
  );
}

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

const mapAniListToNewsAnime = (media: any): NewsAnime => {
  const cleanSynopsis = media.description
    ? media.description.replace(/<[^>]*>/g, '').slice(0, 200) + '...'
    : 'No synopsis available.';

  const statusMap: Record<string, string> = {
    'RELEASING': 'Currently Airing',
    'FINISHED': 'Finished Airing',
    'NOT_YET_RELEASED': 'Not Yet Airing',
    'CANCELLED': 'Cancelled',
    'HIATUS': 'On Hiatus'
  };

  return {
    mal_id: media.idMal,
    title: media.title.english || media.title.userPreferred || media.title.romaji,
    image_url: media.coverImage.large,
    score: media.averageScore ? media.averageScore / 10 : null,
    synopsis: cleanSynopsis,
    episodes: media.episodes || null,
    year: media.seasonYear || null,
    season: media.season || null,
    status: statusMap[media.status] || media.status || '',
    genres: (media.genres || []).slice(0, 3),
    rank: null,
    popularity: null
  };
};

const mapJikanAnime = (d: any): NewsAnime => ({
  mal_id: d.mal_id,
  title: d.title_english || d.title,
  image_url: d.images?.webp?.large_image_url || d.images?.jpg?.large_image_url || '',
  score: d.score,
  synopsis: d.synopsis ? d.synopsis.slice(0, 200) + '...' : 'No synopsis available.',
  episodes: d.episodes,
  year: d.year,
  season: d.season,
  status: d.status || '',
  genres: (d.genres || []).slice(0, 3).map((g: any) => g.name),
  rank: d.rank,
  popularity: d.popularity,
});

export function News() {
  const [trending, setTrending] = useState<NewsAnime[]>([]);
  const [upcoming, setUpcoming] = useState<NewsAnime[]>([]);
  const [topThisSeason, setTopThisSeason] = useState<NewsAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trending' | 'upcoming' | 'season'>('trending');

  const fetchNews = async () => {
    setLoading(true);
    try {
      // Fetch Trending via AniList
      let trendData: NewsAnime[] = [];
      try {
        const queryText = `
          query {
            Page(page: 1, perPage: 18) {
              media(status: RELEASING, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
                idMal
                title { romaji english userPreferred }
                coverImage { large }
                averageScore
                seasonYear
                season
                episodes
                status
                genres
                description
              }
            }
          }
        `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryText })
        });
        const json = await res.json();
        trendData = (json?.data?.Page?.media || []).map(mapAniListToNewsAnime);
      } catch (err) {
        console.error('AniList trending fetch failed, trying Jikan...', err);
        try {
          const res = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&sfw=true&limit=18');
          const json = await res.json();
          trendData = (json.data || []).map(mapJikanAnime);
        } catch (jikanErr) {
          console.error('Jikan fallback failed for trending:', jikanErr);
        }
      }

      // Fetch Upcoming via AniList
      let upcomingData: NewsAnime[] = [];
      try {
        const queryText = `
          query {
            Page(page: 1, perPage: 18) {
              media(status: NOT_YET_RELEASED, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
                idMal
                title { romaji english userPreferred }
                coverImage { large }
                averageScore
                seasonYear
                season
                episodes
                status
                genres
                description
              }
            }
          }
        `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryText })
        });
        const json = await res.json();
        upcomingData = (json?.data?.Page?.media || []).map(mapAniListToNewsAnime);
      } catch (err) {
        console.error('AniList upcoming fetch failed, trying Jikan...', err);
        try {
          const res = await fetch('https://api.jikan.moe/v4/seasons/upcoming?sfw=true&limit=18');
          const json = await res.json();
          upcomingData = (json.data || []).map(mapJikanAnime);
        } catch (jikanErr) {
          console.error('Jikan fallback failed for upcoming:', jikanErr);
        }
      }

      // Fetch Season via AniList
      let seasonData: NewsAnime[] = [];
      try {
        const queryText = `
          query ($season: MediaSeason, $seasonYear: Int) {
            Page(page: 1, perPage: 18) {
              media(season: $season, seasonYear: $seasonYear, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
                idMal
                title { romaji english userPreferred }
                coverImage { large }
                averageScore
                seasonYear
                season
                episodes
                status
                genres
                description
              }
            }
          }
        `;
        const { season, year } = getCurrentSeasonAndYear();
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryText,
            variables: { season, seasonYear: year }
          })
        });
        const json = await res.json();
        seasonData = (json?.data?.Page?.media || []).map(mapAniListToNewsAnime);
      } catch (err) {
        console.error('AniList season fetch failed, trying Jikan...', err);
        try {
          const res = await fetch('https://api.jikan.moe/v4/seasons/now?sfw=true&limit=18');
          const json = await res.json();
          seasonData = (json.data || []).map(mapJikanAnime);
        } catch (jikanErr) {
          console.error('Jikan fallback failed for season:', jikanErr);
        }
      }

      setTrending(trendData);
      setUpcoming(upcomingData);
      setTopThisSeason(seasonData);
    } catch (err) {
      console.error('Failed fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  const tabs = [
    { key: 'trending' as const, label: 'Trending Now', icon: <Flame size={15} />, data: trending },
    { key: 'season' as const, label: 'This Season', icon: <Calendar size={15} />, data: topThisSeason },
    { key: 'upcoming' as const, label: 'Upcoming', icon: <TrendingUp size={15} />, data: upcoming },
  ];

  const activeData = tabs.find(t => t.key === activeTab)?.data || [];
  const featured = activeData[0];
  const rest = activeData.slice(1);

  return (
    <main style={{ flex: 1, paddingTop: 'var(--nav-height)', paddingBottom: '4rem', minHeight: '100vh' }}>
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(139,92,246,0.08) 100%)',
        borderBottom: '1px solid var(--border-color)',
        padding: '3rem 0 2rem'
      }}>
        <div className="container" style={{ padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Newspaper size={28} color="var(--accent-primary)" />
            <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em' }}>Anime Feed</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Stay up to date with what's trending, airing, and coming soon</p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 1.1rem', borderRadius: '9999px',
                  border: `1px solid ${activeTab === tab.key ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  background: activeTab === tab.key ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800,
                  transition: 'all 0.2s'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
            <button
              onClick={fetchNews}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '9999px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh', flexDirection: 'column', gap: '1rem' }}>
            <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
            <p style={{ color: 'var(--text-secondary)' }}>Loading anime feed...</p>
          </div>
        ) : (
          <>
            {/* Featured Card */}
            {featured && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'clamp(140px,22%,220px) 1fr',
                gap: '2rem', marginBottom: '2.5rem',
                backgroundColor: 'var(--bg-color-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '1.25rem', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}>
                <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden' }}>
                  <img
                    src={featured.image_url}
                    alt={featured.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute', top: '0.75rem', left: '0.75rem',
                    backgroundColor: 'var(--accent-primary)', color: 'black',
                    fontSize: '0.7rem', fontWeight: 900, padding: '0.25rem 0.6rem',
                    borderRadius: '9999px'
                  }}>
                    #{activeData.indexOf(featured) + 1} {tabs.find(t => t.key === activeTab)?.label}
                  </div>
                </div>
                <div style={{ padding: '2rem 2rem 2rem 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {featured.genres.map(g => (
                      <span key={g} style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '9999px', backgroundColor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }}>{g}</span>
                    ))}
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.2 }}>{featured.title}</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                    <ScoreBadge score={featured.score} />
                    {featured.episodes && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{featured.episodes} eps</span>}
                    {featured.year && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{featured.season} {featured.year}</span>}
                    {featured.status && <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 700, backgroundColor: 'rgba(34,197,94,0.1)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(34,197,94,0.2)' }}>{featured.status}</span>}
                  </div>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)', maxWidth: '60ch' }}>{featured.synopsis}</p>
                  <Link
                    to={`/watch/${featured.mal_id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.65rem 1.5rem', borderRadius: '9999px',
                      background: 'linear-gradient(135deg, var(--accent-primary), #d97706)',
                      color: 'black', textDecoration: 'none',
                      fontWeight: 900, fontSize: '0.85rem', width: 'fit-content',
                      boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'}
                    onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
                  >
                    <Play size={16} fill="black" /> Watch Now
                  </Link>
                </div>
              </div>
            )}

            {/* Grid of rest */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.25rem'
            }}>
              {rest.map((anime, idx) => (
                <Link
                  to={`/watch/${anime.mal_id}`}
                  key={anime.mal_id}
                  style={{
                    display: 'flex', gap: '1rem',
                    backgroundColor: 'var(--bg-color-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '1rem', overflow: 'hidden',
                    textDecoration: 'none', color: 'inherit',
                    transition: 'all 0.2s',
                    padding: '0.85rem'
                  }}
                  onMouseOver={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.borderColor = 'rgba(245,158,11,0.3)';
                    el.style.transform = 'translateY(-2px)';
                    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                  }}
                  onMouseOut={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.borderColor = 'var(--border-color)';
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={anime.image_url}
                      alt={anime.title}
                      style={{ width: '70px', height: '100px', objectFit: 'cover', borderRadius: '0.6rem' }}
                      loading="lazy"
                    />
                    <span style={{
                      position: 'absolute', top: '4px', left: '4px',
                      backgroundColor: 'rgba(0,0,0,0.85)', color: 'var(--accent-primary)',
                      fontSize: '0.65rem', fontWeight: 900, padding: '0.1rem 0.35rem',
                      borderRadius: '0.3rem'
                    }}>
                      #{idx + 2}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.4rem' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {anime.title}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      <ScoreBadge score={anime.score} />
                      {anime.episodes && <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{anime.episodes} eps</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {anime.genres.slice(0, 2).map(g => (
                        <span key={g} style={{ fontSize: '0.63rem', padding: '0.1rem 0.4rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontWeight: 700 }}>{g}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
