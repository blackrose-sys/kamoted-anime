import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, Bookmark, Clock, Trash2, Play, Camera, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Profile() {
  const { user, updateUser } = useAuth();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'watchlist' | 'history'>('settings');
  const [showCropModal, setShowCropModal] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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
    if (!avatarFile) return;
    
    // Show crop modal instead of direct upload
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(avatarFile);
  };

  const handleCropComplete = async () => {
    if (!canvasRef.current || !imagePreview) return;
    
    setUploading(true);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const image = new Image();
      image.src = imagePreview;
      
      image.onload = () => {
        canvas.width = 300;
        canvas.height = 300;
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
        const x = (canvas.width - image.width * scale) / 2 + crop.x;
        const y = (canvas.height - image.height * scale) / 2 + crop.y;
        
        ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
        
        const croppedImage = canvas.toDataURL('image/jpeg', 0.9);
        updateUser({ ...user, avatar_url: croppedImage });
        setShowCropModal(false);
        setAvatarFile(null);
        setImagePreview('');
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setUploading(false);
      };
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Failed to crop image');
      setUploading(false);
    }
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
              <div style={{ position: 'relative', width: '150px', height: '150px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)', padding: '4px', boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)' }}>
                <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--bg-color-tertiary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {uploading ? (
                    <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
                  ) : user.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '4rem', fontWeight: 900, color: 'var(--text-secondary)' }}>{user.username?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ position: 'absolute', bottom: '5px', right: '5px', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: '3px solid var(--bg-color-secondary)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  <Camera size={20} color="black" />
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '350px' }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    style={{ 
                      position: 'absolute', 
                      width: '100%', 
                      height: '100%', 
                      opacity: 0, 
                      cursor: 'pointer',
                      zIndex: 1
                    }}
                  />
                  <div style={{ 
                    padding: '1rem 1.5rem', 
                    borderRadius: '0.75rem', 
                    background: 'linear-gradient(135deg, var(--bg-color-secondary), var(--bg-color-tertiary))', 
                    border: '2px dashed var(--border-color)', 
                    color: 'var(--text-secondary)', 
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}>
                    <Upload size={24} style={{ marginBottom: '0.5rem', color: 'var(--accent-primary)' }} />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {avatarFile ? avatarFile.name : 'Click to upload image'}
                    </div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      PNG, JPG up to 5MB
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleAvatarChange}
                  disabled={!avatarFile || uploading}
                  style={{ 
                    padding: '1rem 2rem', 
                    borderRadius: '0.75rem', 
                    background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)', 
                    color: 'black', 
                    border: 'none', 
                    cursor: !avatarFile || uploading ? 'not-allowed' : 'pointer',
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 800,
                    fontSize: '1rem',
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                    transition: 'all 0.3s ease',
                    opacity: !avatarFile || uploading ? 0.5 : 1
                  }}
                >
                  {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                  {uploading ? 'Uploading...' : 'Upload Avatar'}
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

      {/* Crop Modal */}
      {showCropModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.9)', 
          zIndex: 1000, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{ 
            backgroundColor: 'var(--bg-color-secondary)', 
            borderRadius: '1rem', 
            padding: '2rem', 
            maxWidth: '500px', 
            width: '100%',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900 }}>Crop Your Image</h3>
              <button 
                onClick={() => {
                  setShowCropModal(false);
                  setAvatarFile(null);
                  setImagePreview('');
                }}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ 
              position: 'relative', 
              width: '100%', 
              height: '300px', 
              backgroundColor: '#000', 
              borderRadius: '0.5rem', 
              overflow: 'hidden',
              marginBottom: '1.5rem'
            }}>
              <img 
                src={imagePreview} 
                alt="Preview" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <button 
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                style={{ 
                  padding: '0.5rem', 
                  borderRadius: '0.5rem', 
                  backgroundColor: 'var(--bg-color-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  color: 'white', 
                  cursor: 'pointer' 
                }}
              >
                <ZoomOut size={20} />
              </button>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.1" 
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <button 
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                style={{ 
                  padding: '0.5rem', 
                  borderRadius: '0.5rem', 
                  backgroundColor: 'var(--bg-color-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  color: 'white', 
                  cursor: 'pointer' 
                }}
              >
                <ZoomIn size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => {
                  setShowCropModal(false);
                  setAvatarFile(null);
                  setImagePreview('');
                }}
                style={{ 
                  flex: 1, 
                  padding: '1rem', 
                  borderRadius: '0.5rem', 
                  backgroundColor: 'var(--bg-color-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  color: 'white', 
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleCropComplete}
                disabled={uploading}
                style={{ 
                  flex: 1, 
                  padding: '1rem', 
                  borderRadius: '0.5rem', 
                  backgroundColor: 'var(--accent-primary)', 
                  border: 'none', 
                  color: 'black', 
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {uploading ? <Loader2 className="animate-spin" size={20} /> : 'Apply & Upload'}
              </button>
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>
      )}
    </main>
  );
}
