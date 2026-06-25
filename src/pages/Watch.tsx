import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, ChevronDown, BookmarkPlus, BookmarkCheck, Server, SkipForward, ChevronRight, ChevronLeft, ToggleLeft, ToggleRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { animeServers, getServerUrl, fetchAniListMetadata, type AnimeServer } from '../lib/animeServers';
import { CommentSection } from '../components/CommentSection';

export function Watch() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [animeName, setAnimeName] = useState('Loading...');
  const [animeImage, setAnimeImage] = useState('');
  const [totalEpisodes, setTotalEpisodes] = useState<number>(12);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [type, setType] = useState<'sub' | 'dub'>('sub');
  const [anilistId, setAnilistId] = useState<string>('');
  const [relations, setRelations] = useState<any[]>([]);
  
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState<string>('watching');
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedServer, setSelectedServer] = useState<AnimeServer>(animeServers[0]); // AnimePlay is primary
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  
  const CHUNK_SIZE = 200;

  useEffect(() => {
    if (id) {
      const cacheBuster = Date.now();
      
      // 1. Fetch AniList Metadata (for exact real-time episode counts)
      fetchAniListMetadata(id)
        .then(metadata => {
          if (metadata.anilistId) setAnilistId(metadata.anilistId);
          if (metadata.episodes) {
            setTotalEpisodes(metadata.episodes);
          }
        })
        .catch(console.error);

      // 2. Fetch Jikan Anime Details (for title, images, and fallback episodes)
      fetch(`https://api.jikan.moe/v4/anime/${id}?_=${cacheBuster}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            setAnimeName(data.data.title);
            setAnimeImage(data.data.images?.webp?.large_image_url || '');
            
            // If AniList count didn't load, use this fallback
            if (data.data.episodes) {
              setTotalEpisodes(prev => prev || data.data.episodes);
            }
            
            // Try to get AniList ID from url (secondary fallback)
            if (data.data.url) {
              const anilistMatch = data.data.url.match(/anilist\.co\/anime\/(\d+)/);
              if (anilistMatch) {
                setAnilistId(prev => prev || anilistMatch[1]);
              }
            }
          }
        })
        .catch(console.error);

      // 3. Fetch Jikan Relations (for Seasons & sequels/prequels)
      fetch(`https://api.jikan.moe/v4/anime/${id}/relations`)
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            const relevantRelations: any[] = [];
            const allowedTypes = ['Prequel', 'Sequel', 'Alternative version', 'Alternative setting', 'Parent story', 'Full story', 'Spin-off', 'Side story'];
            
            data.data.forEach((rel: any) => {
              if (allowedTypes.includes(rel.relation)) {
                rel.entry.forEach((entry: any) => {
                  if (entry.type === 'anime') {
                    relevantRelations.push({
                      relation: rel.relation,
                      mal_id: entry.mal_id,
                      name: entry.name
                    });
                  }
                });
              }
            });
            setRelations(relevantRelations);
          }
        })
        .catch(console.error);

      // 4. Sync Watchlist & Watch History from Supabase
      if (user) {
        supabase.from('watchlists')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('anime_id', parseInt(id))
          .single()
          .then(({ data }) => {
            if (data) {
              setInWatchlist(true);
              setWatchlistStatus(data.status || 'watching');
            } else {
              setInWatchlist(false);
            }
          });
          
        supabase.from('watch_history')
          .select('last_episode')
          .eq('user_id', user.id)
          .eq('anime_id', parseInt(id))
          .single()
          .then(({ data }) => {
            if (data && data.last_episode) {
              setSelectedEpisode(data.last_episode);
              setCurrentChunk(Math.floor((data.last_episode - 1) / CHUNK_SIZE));
            }
          });
      }

      // 5. Fetch Jikan Recommendations
      setRecommendationsLoading(true);
      fetch(`https://api.jikan.moe/v4/anime/${id}/recommendations`)
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            setRecommendations(data.data.slice(0, 10));
          }
        })
        .catch(console.error)
        .finally(() => setRecommendationsLoading(false));
    }
  }, [id, user]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'watching': return 'Watching';
      case 'plan_to_watch': return 'Plan to Watch';
      case 'completed': return 'Completed';
      case 'on_hold': return 'On Hold';
      case 'dropped': return 'Dropped';
      default: return 'Watching';
    }
  };

  const handleWatchlistStatusChange = async (status: string) => {
    if (!user || !id) return alert('Please login to save to your watchlist!');
    setWatchlistLoading(true);
    try {
      if (status === 'remove') {
        const { error } = await supabase
          .from('watchlists')
          .delete()
          .eq('user_id', user.id)
          .eq('anime_id', parseInt(id));
        if (error) throw error;
        setInWatchlist(false);
      } else {
        const { error } = await supabase
          .from('watchlists')
          .upsert({
            user_id: user.id,
            anime_id: parseInt(id),
            title: animeName,
            image_url: animeImage,
            status: status
          }, { onConflict: 'user_id, anime_id' });
        if (error) throw error;
        setInWatchlist(true);
        setWatchlistStatus(status);
      }
    } catch (err) {
      console.error('Failed to update watchlist status:', err);
    } finally {
      setWatchlistLoading(false);
      setShowWatchlistDropdown(false);
    }
  };

  const handleEpisodeClick = async (epNum: number) => {
    setSelectedEpisode(epNum);
    if (user && id && animeImage) {
      await supabase.from('watch_history').upsert({
        user_id: user.id,
        anime_id: parseInt(id),
        title: animeName,
        image_url: animeImage,
        last_episode: epNum,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, anime_id' });
    }
  };

  const handleNextEpisode = () => {
    if (selectedEpisode < totalEpisodes) {
      handleEpisodeClick(selectedEpisode + 1);
    }
  };

  const handlePrevEpisode = () => {
    if (selectedEpisode > 1) {
      handleEpisodeClick(selectedEpisode - 1);
    }
  };

  const handleSkipIntro = () => {
    // Since we're using iframe, we can't directly control the video
    // But we can add a seek forward button that would work if the player supports it
    // For now, this is a placeholder - actual implementation would depend on the video player API
    alert('Skip intro feature requires player API integration');
  };
  
  const chunks = useMemo(() => {
    const numChunks = Math.ceil(totalEpisodes / CHUNK_SIZE);
    return Array.from({ length: numChunks }, (_, i) => {
      const start = i * CHUNK_SIZE + 1;
      const end = Math.min((i + 1) * CHUNK_SIZE, totalEpisodes);
      return { start, end, index: i };
    });
  }, [totalEpisodes]);

  const currentEpisodes = useMemo(() => {
    const filtered = [];
    for (let i = 1; i <= totalEpisodes; i++) {
      if (searchQuery && !i.toString().includes(searchQuery)) continue;
      
      if (!searchQuery) {
        const start = currentChunk * CHUNK_SIZE + 1;
        const end = (currentChunk + 1) * CHUNK_SIZE;
        if (i < start || i > end) continue;
      }
      filtered.push(i);
    }
    return filtered;
  }, [totalEpisodes, currentChunk, searchQuery]);

  return (
    <main className="fade-in" style={{ flex: 1, paddingBottom: '4rem' }}>
      <div style={{ backgroundColor: '#000', borderBottom: '1px solid var(--border-color)', paddingTop: 'calc(var(--nav-height) + 2rem)' }}>
        <div className="container" style={{ paddingBottom: '2rem' }}>
          
          <Link to="/" className="hover-scale" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ArrowLeft size={16} /> Back to Browse
          </Link>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Player Container */}
            <div style={{ flex: '1 1 auto', width: '100%', aspectRatio: '16/9', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              <iframe 
                src={getServerUrl(selectedServer, id || '', selectedEpisode, type, anilistId || id)}
                width="100%" 
                height="100%" 
                frameBorder="0" 
                allowFullScreen 
                allow="autoplay; encrypted-media; picture-in-picture"
                style={{ backgroundColor: 'black' }}
                key={`${selectedServer.id}-${selectedEpisode}-${type}`}
              />
            </div>
            
            {/* Controls */}
            <div style={{ flex: '1 1 300px' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', lineHeight: 1.2 }}>{animeName}</h1>

              {/* Seasons & Related Anime */}
              {relations.length > 0 && (
                <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Seasons & Related Shows
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {relations.map((rel, idx) => (
                      <Link
                        key={`rel-${rel.mal_id}-${idx}`}
                        to={`/watch/${rel.mal_id}`}
                        className="hover-scale"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-color-secondary)',
                          border: '1px solid var(--border-color)',
                          color: 'white',
                          textDecoration: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 900, 
                          backgroundColor: rel.relation === 'Sequel' ? '#22c55e' : rel.relation === 'Prequel' ? '#ef4444' : 'var(--accent-primary)', 
                          color: 'black', 
                          padding: '0.1rem 0.35rem', 
                          borderRadius: '0.25rem',
                          textTransform: 'uppercase'
                        }}>
                          {rel.relation}
                        </span>
                        <span style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          maxWidth: '180px' 
                        }}>
                          {rel.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Episode Navigation */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button 
                  onClick={handlePrevEpisode}
                  disabled={selectedEpisode <= 1}
                  className="btn-primary"
                  style={{ 
                    opacity: selectedEpisode <= 1 ? 0.3 : 1,
                    cursor: selectedEpisode <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem'
                  }}
                >
                  <ChevronLeft size={18} />
                  Prev
                </button>
                
                <div style={{ 
                  padding: '0.75rem 1.5rem', 
                  backgroundColor: 'var(--bg-color-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  minWidth: '120px',
                  textAlign: 'center'
                }}>
                  EP {selectedEpisode} / {totalEpisodes}
                </div>
                
                <button 
                  onClick={handleNextEpisode}
                  disabled={selectedEpisode >= totalEpisodes}
                  className="btn-primary"
                  style={{ 
                    opacity: selectedEpisode >= totalEpisodes ? 0.3 : 1,
                    cursor: selectedEpisode >= totalEpisodes ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem'
                  }}
                >
                  Next
                  <ChevronRight size={18} />
                </button>

                <button 
                  onClick={handleSkipIntro}
                  className="btn-primary"
                  style={{ 
                    backgroundColor: 'var(--bg-color-secondary)', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem'
                  }}
                >
                  <SkipForward size={18} />
                  Skip Intro
                </button>

                <button 
                  onClick={() => setAutoNext(!autoNext)}
                  className="btn-primary"
                  style={{ 
                    backgroundColor: autoNext ? 'var(--accent-primary)' : 'var(--bg-color-secondary)', 
                    color: autoNext ? 'black' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem'
                  }}
                >
                  {autoNext ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  Auto Next
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setType('sub')}
                  className="btn-primary"
                  style={{ opacity: type === 'sub' ? 1 : 0.5, transition: 'opacity 0.2s' }}
                >
                  SUB
                </button>
                <button 
                  onClick={() => setType('dub')}
                  className="btn-primary"
                  style={{ opacity: type === 'dub' ? 1 : 0.5, transition: 'opacity 0.2s', backgroundColor: 'var(--bg-color-secondary)', color: 'white' }}
                >
                  DUB
                </button>

                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setShowServerDropdown(!showServerDropdown)}
                    className="btn-primary"
                    style={{ 
                      backgroundColor: 'var(--bg-color-secondary)', 
                      color: 'white',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      minWidth: '140px',
                      justifyContent: 'center'
                    }}
                  >
                    <Server size={16} />
                    {selectedServer.name}
                    <ChevronDown size={16} />
                  </button>
                  
                  {showServerDropdown && (
                    <div style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      marginTop: '0.5rem', 
                      backgroundColor: 'var(--bg-color-secondary)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '0.5rem', 
                      padding: '0.5rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.25rem', 
                      zIndex: 10, 
                      minWidth: '200px',
                      maxHeight: '300px', 
                      overflowY: 'auto' 
                    }}>
                      {animeServers.map((server) => (
                        <button
                          key={server.id}
                          onClick={() => {
                            setSelectedServer(server);
                            setShowServerDropdown(false);
                          }}
                          style={{ 
                            padding: '0.75rem 1rem', 
                            textAlign: 'left', 
                            backgroundColor: selectedServer.id === server.id ? 'var(--accent-primary)' : 'transparent', 
                            color: selectedServer.id === server.id ? 'black' : 'white', 
                            borderRadius: '0.25rem', 
                            border: 'none', 
                            cursor: 'pointer', 
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = selectedServer.id === server.id ? 'var(--accent-primary)' : 'var(--bg-color-tertiary)'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = selectedServer.id === server.id ? 'var(--accent-primary)' : 'transparent'}
                        >
                          <Server size={14} />
                          {server.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                  <button 
                    onClick={() => setShowWatchlistDropdown(!showWatchlistDropdown)}
                    disabled={watchlistLoading}
                    className="btn-primary"
                    style={{ 
                      backgroundColor: inWatchlist ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-color-secondary)', 
                      color: inWatchlist ? 'var(--accent-primary)' : 'white',
                      border: `1px solid ${inWatchlist ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    {inWatchlist ? <BookmarkCheck size={18} /> : <BookmarkPlus size={18} />}
                    <span>{inWatchlist ? getStatusLabel(watchlistStatus) : 'Add to Watchlist'}</span>
                    <ChevronDown size={14} />
                  </button>
                  
                  {showWatchlistDropdown && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '100%', 
                      right: 0, 
                      marginBottom: '0.5rem', 
                      backgroundColor: 'var(--bg-color-secondary)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '0.5rem', 
                      padding: '0.5rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.25rem', 
                      zIndex: 50, 
                      minWidth: '180px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {[
                        { value: 'watching', label: 'Watching' },
                        { value: 'plan_to_watch', label: 'Plan to Watch' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'on_hold', label: 'On Hold' },
                        { value: 'dropped', label: 'Dropped' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleWatchlistStatusChange(opt.value)}
                          style={{
                            padding: '0.6rem 0.85rem',
                            textAlign: 'left',
                            backgroundColor: inWatchlist && watchlistStatus === opt.value ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                            color: inWatchlist && watchlistStatus === opt.value ? 'var(--accent-primary)' : 'white',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-color-tertiary)'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = inWatchlist && watchlistStatus === opt.value ? 'rgba(168, 85, 247, 0.2)' : 'transparent'}
                        >
                          {opt.label}
                          {inWatchlist && watchlistStatus === opt.value && <Check size={14} />}
                        </button>
                      ))}
                      {inWatchlist && (
                        <>
                          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                          <button
                            onClick={() => handleWatchlistStatusChange('remove')}
                            style={{
                              padding: '0.6rem 0.85rem',
                              textAlign: 'left',
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            Remove from Playlist
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Episodes</h3>
                  
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="Find num..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-tertiary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', width: '150px' }}
                      />
                      <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>

                    {chunks.length > 1 && !searchQuery && (
                      <div style={{ position: 'relative' }}>
                        <button 
                          onClick={() => setShowDropdown(!showDropdown)}
                          style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-tertiary)', border: '1px solid var(--border-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                        >
                          EPS {chunks[currentChunk]?.start}-{chunks[currentChunk]?.end}
                          <ChevronDown size={16} />
                        </button>
                        
                        {showDropdown && (
                          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', backgroundColor: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                            {chunks.map((chunk) => (
                              <button
                                key={chunk.index}
                                onClick={() => {
                                  setCurrentChunk(chunk.index);
                                  setShowDropdown(false);
                                }}
                                style={{ padding: '0.5rem 1rem', textAlign: 'left', backgroundColor: currentChunk === chunk.index ? 'var(--accent-primary)' : 'transparent', color: currentChunk === chunk.index ? 'black' : 'white', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = currentChunk === chunk.index ? 'var(--accent-primary)' : 'var(--bg-color-tertiary)'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = currentChunk === chunk.index ? 'var(--accent-primary)' : 'transparent'}
                              >
                                EPS {chunk.start}-{chunk.end}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {currentEpisodes.map((epNum) => (
                    <button
                      key={epNum}
                      onClick={() => handleEpisodeClick(epNum)}
                      style={{
                        padding: '0.75rem 0',
                        textAlign: 'center',
                        borderRadius: '0.5rem',
                        backgroundColor: selectedEpisode === epNum ? 'var(--accent-primary)' : 'var(--bg-color-tertiary)',
                        color: selectedEpisode === epNum ? '#000' : 'white',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: selectedEpisode === epNum ? '0 0 15px rgba(217,70,239,0.4)' : 'none'
                      }}
                      onMouseOver={e => {
                        if (selectedEpisode !== epNum) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-color-secondary)';
                        }
                      }}
                      onMouseOut={e => {
                        if (selectedEpisode !== epNum) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-color-tertiary)';
                        }
                      }}
                    >
                      {epNum}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart Recommendations */}
              <div style={{ marginTop: '2.5rem', marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--accent-primary)' }}>✨</span> You Might Also Like
                </h3>
                {recommendationsLoading ? (
                  <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="animate-pulse" style={{ width: '150px', height: '225px', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '0.75rem', flexShrink: 0 }} />
                    ))}
                  </div>
                ) : recommendations.length === 0 ? (
                  <div style={{ padding: '2rem', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
                    No recommendations available for this anime.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', scrollbarWidth: 'thin' }}>
                    {recommendations.map((rec) => (
                      <Link
                        key={rec.entry.mal_id}
                        to={`/watch/${rec.entry.mal_id}`}
                        className="hover-scale"
                        style={{
                          width: '150px',
                          flexShrink: 0,
                          textDecoration: 'none',
                          color: 'white',
                          backgroundColor: 'var(--bg-color-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.75rem',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ width: '100%', aspectRatio: '2/3', position: 'relative' }}>
                          <img
                            src={rec.entry.images?.webp?.large_image_url || rec.entry.images?.webp?.image_url}
                            alt={rec.entry.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            loading="lazy"
                          />
                        </div>
                        <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <h4 style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            margin: 0,
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {rec.entry.title}
                          </h4>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Comment Section */}
              {id && (
                <CommentSection animeId={id} episode={selectedEpisode} />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
