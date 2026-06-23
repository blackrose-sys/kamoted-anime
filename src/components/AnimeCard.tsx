import { Link } from 'react-router-dom';

export interface AnimeData {
  mal_id: number;
  title: string;
  images: {
    webp: {
      image_url: string;
      large_image_url: string;
    }
  };
  trailer?: {
    images?: {
      maximum_image_url?: string;
      large_image_url?: string;
    }
  };
  episodes: number | null;
  score: number | null;
  year: number | null;
  season: string | null;
  synopsis?: string;
  type?: string;
}

interface AnimeCardProps {
  anime: AnimeData;
}

export function AnimeCard({ anime }: AnimeCardProps) {
  return (
    <Link to={`/watch/${anime.mal_id}`} className="anime-card hover-scale">
      <div style={{ position: 'relative' }}>
        <img 
          src={anime.images.webp.large_image_url} 
          alt={anime.title} 
          className="anime-card-image"
          loading="lazy"
        />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }} />
        
        {anime.score && (
          <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'var(--accent-primary)', color: '#000', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 900 }}>
            ★ {anime.score}
          </div>
        )}
      </div>
      
      <div className="anime-card-content flex-col gap-1 flex-1 justify-between" style={{ padding: '0.5rem' }}>
        <h3 className="line-clamp-2 text-primary" style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.3 }}>
          {anime.title}
        </h3>
        
        <div className="flex items-center justify-between font-bold text-zinc-500 uppercase tracking-wider mt-1" style={{ fontSize: '0.65rem' }}>
          <span>{anime.season ? `${anime.season.slice(0,3)} ${anime.year}` : (anime.year || 'TBA')}</span>
          <span style={{ color: 'var(--accent-primary)' }}>{anime.episodes ? `EP ${anime.episodes}` : '??'}</span>
        </div>
      </div>
    </Link>
  );
}
