import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, ChevronDown, BookmarkPlus, BookmarkCheck, Server, SkipForward, ChevronRight, ChevronLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { animeServers, getServerUrl, fetchEpisodesFromServer, type AnimeServer } from '../lib/animeServers';

export function Watch() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [animeName, setAnimeName] = useState('Loading...');
  const [animeImage, setAnimeImage] = useState('');
  const [totalEpisodes, setTotalEpisodes] = useState<number>(12);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [type, setType] = useState<'sub' | 'dub'>('sub');
  const [anilistId, setAnilistId] = useState<string>('');
  
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedServer, setSelectedServer] = useState<AnimeServer>(animeServers[0]);
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  
  const CHUNK_SIZE = 200;

  useEffect(() => {
    if (id) {
      const cacheBuster = Date.now();
      
      fetch(`https://api.jikan.moe/v4/anime/${id}?_=${cacheBuster}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            setAnimeName(data.data.title);
            setAnimeImage(data.data.images?.webp?.large_image_url || '');
            
            // Try to get AniList ID from the response
            if (data.data.url) {
              const anilistMatch = data.data.url.match(/anilist\.co\/anime\/(\d+)/);
              if (anilistMatch) {
                setAnilistId(anilistMatch[1]);
              }
            }
          }
        })
        .catch(console.error);

      // Try to fetch episodes from streaming server API first (PRIMARY SOURCE)
      const fetchServerEpisodes = async () => {
        try {
          const serverEpisodes = await fetchEpisodesFromServer(selectedServer, id, anilistId || id);
          if (serverEpisodes && serverEpisodes > 0) {
            setTotalEpisodes(serverEpisodes);
            return true;
          }
        } catch (error) {
          console.error('Error fetching from server API:', error);
        }
        return false;
      };

      // Fallback to Jikan API if server API fails
      const fetchJikanEpisodes = async () => {
        let allEpisodes: any[] = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore && page <= 100) {
          try {
            const res = await fetch(`https://api.jikan.moe/v4/anime/${id}/episodes?page=${page}&_=${cacheBuster}`);
            const data = await res.json();
            
            if (data && data.data && Array.isArray(data.data)) {
              allEpisodes = [...allEpisodes, ...data.data];
              
              if (data.pagination && data.pagination.has_next_page) {
                page++;
              } else {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
            
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 400));
            }
          } catch (error) {
            console.error('Error fetching episodes:', error);
            hasMore = false;
          }
        }
        
        if (allEpisodes.length > 0) {
          setTotalEpisodes(allEpisodes.length);
        } else {
          fetch(`https://api.jikan.moe/v4/anime/${id}?_=${cacheBuster}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.data && data.data.episodes) {
                setTotalEpisodes(data.data.episodes);
              }
            })
            .catch(console.error);
        }
      };

      // Try server API first, then fallback to Jikan
      fetchServerEpisodes().then((success) => {
        if (!success) {
          fetchJikanEpisodes();
        }
      });

      if (user) {
        supabase.from('watchlists')
          .select('id')
          .eq('user_id', user.id)
          .eq('anime_id', parseInt(id))
          .single()
          .then(({ data }) => {
            if (data) setInWatchlist(true);
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
    }
  }, [id, user]);

  const toggleWatchlist = async () => {
    if (!user || !id) return alert('Please login to save to your watchlist!');
    setWatchlistLoading(true);
    
    if (inWatchlist) {
      await supabase.from('watchlists').delete().eq('user_id', user.id).eq('anime_id', parseInt(id));
      setInWatchlist(false);
    } else {
      await supabase.from('watchlists').insert({
        user_id: user.id,
        anime_id: parseInt(id),
        title: animeName,
        image_url: animeImage
      });
      setInWatchlist(true);
    }
    setWatchlistLoading(false);
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
                style={{ backgroundColor: 'black' }}
                key={`${selectedServer.id}-${selectedEpisode}-${type}`}
              />
            </div>
            
            {/* Controls */}
            <div style={{ flex: '1 1 300px' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', lineHeight: 1.2 }}>{animeName}</h1>
              
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

                <button 
                  onClick={toggleWatchlist}
                  disabled={watchlistLoading}
                  className="btn-primary"
                  style={{ 
                    backgroundColor: inWatchlist ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-color-secondary)', 
                    color: inWatchlist ? 'var(--accent-primary)' : 'white',
                    border: `1px solid ${inWatchlist ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginLeft: 'auto'
                  }}
                >
                  {inWatchlist ? <BookmarkCheck size={18} /> : <BookmarkPlus size={18} />}
                  <span className="hidden sm:inline">{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
                </button>
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
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
