import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AnimeCard } from '../components/AnimeCard';
import { Loader2, Bookmark, Calendar, Lock, Globe, ChevronLeft } from 'lucide-react';

interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  watchlist_privacy: 'public' | 'private';
  created_at: string;
}

function getInitials(name: string): string {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');
}

function getAvatarColor(name: string): string {
  const colors = [
    ['#f59e0b', '#d97706'], // amber
    ['#8b5cf6', '#7c3aed'], // violet
    ['#ec4899', '#db2777'], // pink
    ['#06b6d4', '#0891b2'], // cyan
    ['#10b981', '#059669'], // emerald
    ['#f43f5e', '#e11d48'], // rose
    ['#6366f1', '#4f46e5'], // indigo
    ['#14b8a6', '#0d9488'], // teal
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colors.length;
  return `linear-gradient(135deg, ${colors[idx][0]}, ${colors[idx][1]})`;
}

export function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  useEffect(() => {
    const fetchProfileAndWatchlist = async () => {
      if (!username) return;
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch user profile by username
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          setError('User not found.');
          setLoading(false);
          return;
        }

        setProfile(profileData as ProfileData);

        // 2. Determine if we can read their watchlist
        const canReadWatchlist = 
          profileData.watchlist_privacy === 'public' || 
          (currentUser && currentUser.id === profileData.id);

        if (canReadWatchlist) {
          setWatchlistLoading(true);
          const { data: watchlistData, error: watchlistError } = await supabase
            .from('watchlists')
            .select('*')
            .eq('user_id', profileData.id)
            .order('created_at', { ascending: false });

          if (watchlistError) throw watchlistError;
          setWatchlist(watchlistData || []);
          setWatchlistLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        setError(err.message || 'Failed to load user profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndWatchlist();
  }, [username, currentUser]);

  if (loading) {
    return (
      <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>Oops!</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'User not found'}</p>
        </div>
        <button onClick={() => navigate(-1)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
          <ChevronLeft size={16} /> Go Back
        </button>
      </main>
    );
  }

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const displayWatchlist = profile.watchlist_privacy === 'public' || isOwnProfile;

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Header Back Link */}
      <div style={{ width: '100%', maxWidth: '800px', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            padding: 0
          }}
          className="hover-scale"
        >
          <ChevronLeft size={16} /> BACK
        </button>
      </div>

      {/* Profile Info Glass Card */}
      <div className="glass" style={{ width: '100%', maxWidth: '800px', padding: '3rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            background: getAvatarColor(profile.username), 
            padding: '4px', 
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--bg-color-tertiary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--text-secondary)' }}>{getInitials(profile.username)}</span>
              )}
            </div>
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>{profile.username}</h1>
              {isOwnProfile && (
                <Link 
                  to="/profile" 
                  style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 900, 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '0.5rem', 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    textTransform: 'uppercase'
                  }}
                  className="hover-scale"
                >
                  Edit Profile
                </Link>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} />
                <span>Joined {joinDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {profile.watchlist_privacy === 'public' ? (
                  <>
                    <Globe size={16} color="#4ade80" />
                    <span>Watchlist is Public</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} color="#fca5a5" />
                    <span>Watchlist is Private</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist Section */}
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bookmark size={20} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', margin: 0 }}>Anime Playlist</h2>
        </div>

        {watchlistLoading ? (
          <div className="grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse" style={{ aspectRatio: '2/3', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem' }} />
            ))}
          </div>
        ) : displayWatchlist ? (
          watchlist.length === 0 ? (
            <div className="glass" style={{ padding: '4rem 2rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Bookmark size={40} style={{ color: 'var(--border-color)', marginBottom: '1rem' }} />
              <div>This user's playlist is currently empty.</div>
            </div>
          ) : (
            <div className="grid">
              {watchlist.map(item => (
                <AnimeCard 
                  key={item.id} 
                  anime={{
                    mal_id: item.anime_id,
                    title: item.title,
                    images: {
                      webp: {
                        image_url: item.image_url,
                        large_image_url: item.image_url
                      }
                    },
                    episodes: null,
                    score: null,
                    year: null,
                    season: null
                  }} 
                />
              ))}
            </div>
          )
        ) : (
          /* Private Watchlist Glass Screen */
          <div className="glass" style={{ padding: '5rem 2rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '2px dashed rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Lock size={28} color="#ef4444" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.25rem' }}>Playlist is Private</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: 0 }}>
                This user has set their anime playlist to private. Only they can view their bookmark list.
              </p>
            </div>
          </div>
        )}
      </div>

    </main>
  );
}
