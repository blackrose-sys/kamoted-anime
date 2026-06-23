import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, Image, Bookmark, Clock, Trash2, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Profile() {
  const { user, updateUser } = useAuth();
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'watchlist' | 'history'>('settings');
  
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      if (activeTab === 'watchlist') {
        supabase.from('watchlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
          .then(({ data }) => setWatchlist(data || []));
      } else if (activeTab === 'history') {
        supabase.from('watch_history').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
          .then(({ data }) => setHistory(data || []));
      }
    }
  }, [user, activeTab]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleAvatarChange = async () => {
    if (!avatarUrlInput) return;
    setUploading(true);
    await updateUser({ ...user, avatar_url: avatarUrlInput });
    setAvatarUrlInput('');
    setUploading(false);
  };

  const removeFromWatchlist = async (animeId: number) => {
    await supabase.from('watchlists').delete().eq('user_id', user.id).eq('anime_id', animeId);
    setWatchlist(watchlist.filter(w => w.anime_id !== animeId));
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', width: '100%', maxWidth: '800px', overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('settings')} style={{ background: 'none', border: 'none', color: activeTab === 'settings' ? 'var(--accent-primary)' : 'white', fontWeight: 900, cursor: 'pointer', padding: '0.5rem 1rem' }}>SETTINGS</button>
        <button onClick={() => setActiveTab('watchlist')} style={{ background: 'none', border: 'none', color: activeTab === 'watchlist' ? 'var(--accent-primary)' : 'white', fontWeight: 900, cursor: 'pointer', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem' }}><Bookmark size={18} /> WATCHLIST</button>
        <button onClick={() => setActiveTab('history')} style={{ background: 'none', border: 'none', color: activeTab === 'history' ? 'var(--accent-primary)' : 'white', fontWeight: 900, cursor: 'pointer', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem' }}><Clock size={18} /> HISTORY</button>
      </div>

      <div className="glass" style={{ width: '100%', maxWidth: '800px', padding: '3rem', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textAlign: 'center' }}>My Profile</h1>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--bg-color-tertiary)', border: '4px solid var(--bg-color-secondary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {uploading ? (
                  <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
                ) : user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-secondary)' }}>{user.username?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '300px' }}>
                <input 
                  type="text" 
                  placeholder="Paste Image URL..." 
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', fontSize: '0.875rem' }}
                />
                <button 
                  onClick={handleAvatarChange}
                  disabled={!avatarUrlInput || uploading}
                  style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'var(--accent-primary)', color: 'black', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Image size={18} />
                </button>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-color-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Username</label>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{user.username}</div>
              </div>
              
              <div style={{ backgroundColor: 'var(--bg-color-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email Address</label>
                <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{user.email}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1.5rem', textTransform: 'uppercase' }}>My Watchlist</h2>
            {watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>You haven't bookmarked any anime yet!</div>
            ) : (
              <div className="grid">
                {watchlist.map(item => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <Link to={`/watch/${item.anime_id}`} className="hover-scale" style={{ display: 'block', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <div style={{ width: '100%', aspectRatio: '2/3', position: 'relative' }}>
                        <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ padding: '0.75rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h3>
                      </div>
                    </Link>
                    <button 
                      onClick={() => removeFromWatchlist(item.anime_id)}
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', zIndex: 10 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1.5rem', textTransform: 'uppercase' }}>Watch History</h2>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>You haven't watched anything yet!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {history.map(item => (
                  <Link to={`/watch/${item.anime_id}`} key={item.id} className="hover-scale" style={{ display: 'flex', gap: '1rem', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem', padding: '1rem', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                    <div style={{ width: '120px', aspectRatio: '16/9', borderRadius: '0.5rem', overflow: 'hidden', position: 'relative' }}>
                      <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.8 }}><Play size={24} color="var(--accent-primary)" fill="var(--accent-primary)" /></div>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 900 }}>{item.title}</h3>
                      <div style={{ display: 'inline-block', backgroundColor: 'var(--accent-primary)', color: 'black', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800, marginTop: '0.5rem' }}>
                        EPISODE {item.last_episode}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
