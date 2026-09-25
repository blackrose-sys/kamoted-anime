import { useEffect, useState, useRef } from 'react';
import { Play, Star, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnimeData } from './AnimeCard';

interface HeroProps {
  featured: AnimeData[];
}

export function Hero({ featured }: HeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [descriptions, setDescriptions] = useState<Record<number, string>>({});
  const [genres, setGenres] = useState<Record<number, string[]>>({});
  const progressRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch descriptions + genres from AniList for hero items
  useEffect(() => {
    if (featured.length === 0) return;

    const fetchHeroMeta = async () => {
      const query = `
        query ($idMal: Int) {
          Media(idMal: $idMal, type: ANIME) {
            description(asHtml: false)
            genres
          }
        }
      `;

      for (const anime of featured) {
        try {
          const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { idMal: anime.mal_id } })
          });
          const data = await res.json();
          const media = data?.data?.Media;
          if (media?.description) {
            let desc = media.description.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
            if (desc.length > 180) desc = desc.substring(0, 180).replace(/\s+\S*$/, '') + '…';
            setDescriptions(prev => ({ ...prev, [anime.mal_id]: desc }));
          }
          if (media?.genres) {
            setGenres(prev => ({ ...prev, [anime.mal_id]: media.genres.slice(0, 4) }));
          }
        } catch { /* ignore */ }
      }
    };

    fetchHeroMeta();
  }, [featured]);

  // Auto-rotate
  useEffect(() => {
    if (featured.length <= 1) return;
    timerRef.current = setInterval(() => {
      goToSlide((prev: number) => (prev + 1) % featured.length);
    }, 6000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured.length]);

  const goToSlide = (indexOrFn: number | ((prev: number) => number)) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(indexOrFn);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);

    // Reset timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goToSlide((prev: number) => (prev + 1) % featured.length);
    }, 6000);
  };

  if (featured.length === 0) {
    return (
      <div style={{ height: '70vh', background: 'linear-gradient(180deg, var(--bg-color-secondary) 0%, var(--bg-color) 100%)' }} className="animate-pulse">
        <div style={{ maxWidth: '600px', padding: '180px 2rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ width: '120px', height: '24px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '9999px' }} />
          <div style={{ width: '80%', height: '48px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }} />
          <div style={{ width: '60%', height: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.25rem' }} />
          <div style={{ width: '140px', height: '44px', backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: '0.75rem', marginTop: '0.5rem' }} />
        </div>
      </div>
    );
  }

  const currentAnime = featured[currentIndex];
  const currentDescription = descriptions[currentAnime.mal_id] || currentAnime.synopsis || '';
  const currentGenres = genres[currentAnime.mal_id] || [];

  return (
    <div className="hero-wrapper" style={{ 
      position: 'relative', 
      width: '100%', 
      minHeight: '75vh', 
      display: 'flex', 
      alignItems: 'flex-end', 
      overflow: 'hidden' 
    }}>
      
      {/* Background Images with Ken Burns effect */}
      {featured.map((anime, index) => {
        const bgImage = anime.trailer?.images?.maximum_image_url || anime.trailer?.images?.large_image_url || anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
        const isActive = index === currentIndex;
        return (
          <div 
            key={anime.mal_id}
            style={{ 
              position: 'absolute', 
              top: '-5%', left: '-5%', right: '-5%', bottom: '-5%', 
              backgroundImage: `url(${bgImage})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center 20%', 
              opacity: isActive && !isTransitioning ? 1 : 0,
              transform: isActive ? 'scale(1.02)' : 'scale(1.08)',
              transition: 'opacity 0.8s ease, transform 12s ease-out',
              filter: 'brightness(0.5) saturate(1.2)',
              zIndex: 0
            }} 
          />
        );
      })}

      {/* Multi-layer gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(180deg, rgba(3,3,3,0.3) 0%, rgba(3,3,3,0.1) 30%, rgba(3,3,3,0.6) 65%, rgba(3,3,3,1) 100%),
          linear-gradient(90deg, rgba(3,3,3,0.8) 0%, transparent 60%)
        `,
        zIndex: 1
      }} />

      {/* Accent glow */}
      <div style={{
        position: 'absolute',
        bottom: '-50px',
        left: '10%',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
        filter: 'blur(60px)',
        zIndex: 1,
        pointerEvents: 'none'
      }} />
      
      {/* Content */}
      <div className="container" style={{ 
        paddingTop: '160px', 
        paddingBottom: '80px', 
        position: 'relative', 
        zIndex: 10,
        width: '100%'
      }}>
        <div style={{
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'translateY(15px)' : 'translateY(0)',
          transition: 'opacity 0.4s ease, transform 0.5s ease',
          maxWidth: '700px'
        }}>
          {/* Genre Tags */}
          {currentGenres.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {currentGenres.map(genre => (
                <span key={genre} style={{
                  padding: '0.25rem 0.7rem',
                  borderRadius: '9999px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(8px)',
                }}>
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="hero-title line-clamp-2" style={{ 
            fontSize: 'clamp(2rem, 5vw, 3.5rem)', 
            fontWeight: 900, 
            letterSpacing: '-0.03em', 
            lineHeight: 1.05, 
            marginBottom: '1rem', 
            textShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}>
            {currentAnime.title}
          </h1>

          {/* Score + Meta */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            marginBottom: '1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--text-secondary)'
          }}>
            {currentAnime.score && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#facc15' }}>
                <Star size={14} fill="#facc15" stroke="#facc15" />
                {currentAnime.score.toFixed(1)}
              </span>
            )}
            {currentAnime.episodes && (
              <span>{currentAnime.episodes} Episodes</span>
            )}
            {currentAnime.season && currentAnime.year && (
              <span>{currentAnime.season.charAt(0).toUpperCase() + currentAnime.season.slice(1).toLowerCase()} {currentAnime.year}</span>
            )}
          </div>

          {/* Description */}
          {currentDescription && (
            <p className="hero-synopsis" style={{ 
              color: 'rgba(255,255,255,0.6)', 
              fontSize: '0.95rem', 
              maxWidth: '550px', 
              marginBottom: '1.75rem', 
              lineHeight: 1.7,
              fontWeight: 500,
            }}>
              {currentDescription}
            </p>
          )}
          
          {/* CTA Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Link 
              to={`/watch/${currentAnime.mal_id}`} 
              className="hover-scale"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.85rem 2rem',
                borderRadius: '0.85rem',
                background: 'linear-gradient(135deg, var(--accent-primary), #d97706)',
                color: 'black',
                fontWeight: 900,
                fontSize: '0.9rem',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                boxShadow: '0 8px 25px rgba(245,158,11,0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <Play fill="black" size={18} />
              Watch Now
            </Link>
            <Link 
              to={`/watch/${currentAnime.mal_id}`}
              className="hover-scale"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1.5rem',
                borderRadius: '0.85rem',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.85rem',
                textDecoration: 'none',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease',
              }}
            >
              <Info size={16} />
              Details
            </Link>
          </div>
        </div>
        
        {/* Bottom Bar: Nav Controls + Progress Indicators */}
        <div style={{ 
          position: 'absolute', 
          bottom: '30px', 
          right: '24px', 
          display: 'flex', 
          alignItems: 'center',
          gap: '0.75rem',
          zIndex: 20
        }}>
          {/* Prev/Next Arrows */}
          <button 
            onClick={() => goToSlide((prev: number) => (prev - 1 + featured.length) % featured.length)}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', backdropFilter: 'blur(8px)'
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Progress Bars */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            {featured.map((_, index) => (
              <button 
                key={index} 
                onClick={() => goToSlide(index)}
                style={{ 
                  width: index === currentIndex ? '32px' : '12px', 
                  height: '4px', 
                  borderRadius: '9999px', 
                  backgroundColor: index === currentIndex ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)', 
                  border: 'none', 
                  cursor: 'pointer', 
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {index === currentIndex && (
                  <div ref={progressRef} style={{
                    position: 'absolute',
                    top: 0, left: 0, bottom: 0,
                    width: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    borderRadius: '9999px',
                    animation: 'heroProgress 6s linear',
                  }} />
                )}
              </button>
            ))}
          </div>

          <button 
            onClick={() => goToSlide((prev: number) => (prev + 1) % featured.length)}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', backdropFilter: 'blur(8px)'
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      
    </div>
  );
}
