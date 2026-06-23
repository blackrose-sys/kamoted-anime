import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnimeData } from './AnimeCard';

interface HeroProps {
  featured: AnimeData[];
}

export function Hero({ featured }: HeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (featured.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 5000); // 5 seconds per slide
    return () => clearInterval(timer);
  }, [featured.length]);

  if (featured.length === 0) {
    return <div style={{ height: '50vh', backgroundColor: 'var(--bg-color-secondary)' }} className="animate-pulse" />;
  }

  const currentAnime = featured[currentIndex];

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '60vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      
      {/* Background Images */}
      {featured.map((anime, index) => {
        const bgImage = anime.trailer?.images?.maximum_image_url || anime.trailer?.images?.large_image_url || anime.images.webp.large_image_url;
        return (
          <div 
            key={anime.mal_id}
            style={{ 
              position: 'absolute', 
              top: 0, left: 0, right: 0, bottom: 0, 
              backgroundImage: `url(${bgImage})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center 20%', 
              opacity: index === currentIndex ? 0.6 : 0, 
              transition: 'opacity 1s ease-in-out',
              maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', 
              WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', 
              zIndex: -1 
            }} 
          />
        );
      })}
      
      {/* Content Overlay */}
      <div className="container" style={{ paddingTop: '80px', paddingBottom: '80px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '1rem', textTransform: 'uppercase' }}>
          <span>Featured #{currentIndex + 1}</span>
        </div>
        
        <h1 className="line-clamp-2" style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '1rem', maxWidth: '800px', textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          {currentAnime.title}
        </h1>
        
        <p className="line-clamp-3" style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '600px', marginBottom: '2rem', lineHeight: 1.6, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
          {currentAnime.synopsis || "No synopsis available."}
        </p>
        
        <div className="flex items-center gap-4">
          <Link to={`/watch/${currentAnime.mal_id}`} className="btn-primary flex items-center gap-2 hover-scale">
            <Play fill="black" size={18} />
            Watch Now
          </Link>
        </div>
        
        {/* Indicators */}
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', gap: '0.5rem' }}>
          {featured.map((_, index) => (
            <button 
              key={index} 
              onClick={() => setCurrentIndex(index)}
              style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: index === currentIndex ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', transition: 'background-color 0.3s' }}
            />
          ))}
        </div>
      </div>
      
    </div>
  );
}
