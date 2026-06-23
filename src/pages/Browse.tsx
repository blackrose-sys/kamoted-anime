import { useEffect, useState } from 'react';
import { Search, Loader2, Filter } from 'lucide-react';
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

export function Browse() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [results, setResults] = useState<AnimeData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        let url = 'https://api.jikan.moe/v4/anime?sfw=true&limit=24';
        
        if (query.trim()) {
          url += `&q=${encodeURIComponent(query)}`;
          // Do NOT add order_by=popularity here, so Jikan sorts by exact text match relevance
        } else {
          url += '&order_by=popularity&sort=asc';
        }
        
        if (genre) url += `&genres=${genre}`;

        const res = await fetch(url);
        const data = await res.json();
        setResults(data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 500);
    return () => clearTimeout(debounce);
  }, [query, genre]);

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem 4rem 1.5rem' }}>
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
          Discover <span style={{ color: 'var(--accent-primary)' }}>Anime</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Search through thousands of anime or use our advanced filters to find exactly what you're looking for.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', maxWidth: '800px', margin: '0 auto', flexWrap: 'wrap' }}>
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
        </div>
      ) : (
        <div className="grid">
          {results.map(anime => (
            <AnimeCard key={anime.mal_id} anime={anime} />
          ))}
        </div>
      )}
    </main>
  );
}
