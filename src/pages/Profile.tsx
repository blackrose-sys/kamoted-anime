import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, Bookmark, Clock, Trash2, Play, Camera, X, Check, Save, User, Mail, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Profile() {
  const { user, updateUser, isLoading } = useAuth();
  
  // Tab management
  const [activeTab, setActiveTab] = useState<'settings' | 'watchlist' | 'history'>('settings');
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // Username form states
  const [usernameInput, setUsernameInput] = useState('');
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);

  // Avatar upload and crop states
  const [uploading, setUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (user) {
      setUsernameInput(user.username || '');
      
      if (activeTab === 'watchlist') {
        supabase.from('watchlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
          .then(({ data }) => setWatchlist(data || []));
      } else if (activeTab === 'history') {
        supabase.from('watch_history').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
          .then(({ data }) => setHistory(data || []));
      }
    }
  }, [user, activeTab]);

  if (isLoading) {
    return (
      <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // --- Image Cropper Calculations ---
  const containerSize = 200; // Size of circular crop area
  const currentWidth = imgDimensions.width * zoom;
  const currentHeight = imgDimensions.height * zoom;

  // Max offsets to keep the image covering the 200x200 crop area
  const maxX = Math.max(0, (currentWidth - containerSize) / 2);
  const minX = -maxX;
  const maxY = Math.max(0, (currentHeight - containerSize) / 2);
  const minY = -maxY;

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    
    // Fit image to cover circular crop container (200x200)
    const aspect = img.naturalWidth / img.naturalHeight;
    let w = containerSize;
    let h = containerSize;
    
    if (aspect >= 1) {
      h = containerSize;
      w = containerSize * aspect;
    } else {
      w = containerSize;
      h = containerSize / aspect;
    }
    
    setImgDimensions({ width: w, height: h });
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Drag handlers for mouse & touch
  const startDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setInitialPos(position);
  };

  const handleDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    
    let newX = initialPos.x + dx;
    let newY = initialPos.y + dy;
    
    // Clamp within calculated bounds to guarantee image covers crop frame
    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));
    
    setPosition({ x: newX, y: newY });
  };

  const endDrag = () => {
    setIsDragging(false);
  };

  // Crop and Export to Base64
  const handleCropSave = async () => {
    if (!imageSrc || !naturalSize.width || !naturalSize.height) return;
    
    setUploading(true);
    
    try {
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // Top-left displayed coordinate relative to the crop container
      const dispX = (containerSize / 2) - (currentWidth / 2) + position.x;
      const dispY = (containerSize / 2) - (currentHeight / 2) + position.y;

      // Translate coordinates to source image (natural resolution)
      const ratio = naturalSize.width / currentWidth;
      const sX = -dispX * ratio;
      const sY = -dispY * ratio;
      const sW = containerSize * ratio;
      const sH = containerSize * ratio;

      // Draw onto canvas (scaling to output resolution)
      ctx.drawImage(img, sX, sY, sW, sH, 0, 0, 256, 256);
      
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);

      // Save to Supabase User Profile
      await updateUser({ ...user, avatar_url: croppedBase64 });
      
      setCropperOpen(false);
      setImageSrc(null);
    } catch (err) {
      console.error('Cropping error:', err);
      alert('Failed to crop and update avatar.');
    } finally {
      setUploading(false);
    }
  };

  // Handle Username Edit
  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || usernameInput.trim().length < 3) {
      alert('Username must be at least 3 characters.');
      return;
    }
    setUpdatingUsername(true);
    try {
      await updateUser({ ...user, username: usernameInput.trim() });
      setShowSuccessMsg(true);
      setTimeout(() => setShowSuccessMsg(false), 3000);
    } catch (error) {
      console.error('Error saving username:', error);
      alert('Failed to update username.');
    } finally {
      setUpdatingUsername(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image exceeds the 5MB size limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const removeFromWatchlist = async (animeId: number) => {
    await supabase.from('watchlists').delete().eq('user_id', user.id).eq('anime_id', animeId);
    setWatchlist(watchlist.filter(w => w.anime_id !== animeId));
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Premium Tab Navigation */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', width: '100%', maxWidth: '800px', overflowX: 'auto' }}>
        <button 
          onClick={() => setActiveTab('settings')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
            fontWeight: 900, 
            cursor: 'pointer', 
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            transition: 'color 0.2s',
            borderBottom: activeTab === 'settings' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginBottom: '-17px'
          }}
        >
          SETTINGS
        </button>
        <button 
          onClick={() => setActiveTab('watchlist')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'watchlist' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
            fontWeight: 900, 
            cursor: 'pointer', 
            padding: '0.5rem 1rem', 
            display: 'flex', 
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            transition: 'color 0.2s',
            borderBottom: activeTab === 'watchlist' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginBottom: '-17px'
          }}
        >
          <Bookmark size={16} /> WATCHLIST
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
            fontWeight: 900, 
            cursor: 'pointer', 
            padding: '0.5rem 1rem', 
            display: 'flex', 
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            transition: 'color 0.2s',
            borderBottom: activeTab === 'history' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginBottom: '-17px'
          }}
        >
          <Clock size={16} /> HISTORY
        </button>
      </div>

      {/* Main Glassmorphism Card */}
      <div className="glass" style={{ width: '100%', maxWidth: '800px', padding: '3rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative' }}>
        
        {/* TAB 1: SETTINGS */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textAlign: 'center', letterSpacing: '-0.02em' }}>My Profile</h1>
            
            {/* Avatar Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)', 
                  padding: '4px', 
                  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--bg-color-tertiary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {uploading ? (
                      <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
                    ) : user.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '4.5rem', fontWeight: 900, color: 'var(--text-secondary)' }}>{user.username?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>
                
                {/* Upload Trigger Input Button */}
                <label 
                  style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    right: '4px', 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--accent-primary)', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    border: '3px solid var(--bg-color-secondary)', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s'
                  }}
                  className="hover-scale"
                >
                  <Camera size={18} color="black" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Click the camera icon to upload and crop a new avatar</p>
            </div>

            {/* Profile Fields & Settings Form */}
            <form onSubmit={handleSaveUsername} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
              
              {/* Success Notification Alert */}
              {showSuccessMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#86efac', padding: '0.85rem 1rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
                  <Check size={18} color="#22c55e" />
                  Profile updated successfully!
                </div>
              )}

              {/* Email Address (Read-only) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  <Mail size={14} /> Email Address
                </label>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.95rem'
                }}>
                  {user.email}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', margin: 0 }}>Email address cannot be changed</p>
              </div>

              {/* Username Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  <User size={14} /> Username
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'var(--bg-color-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      outline: 'none',
                      fontSize: '0.95rem',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={updatingUsername || usernameInput.trim() === user.username}
                style={{ 
                  padding: '0.85rem 2rem', 
                  borderRadius: '0.75rem', 
                  background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)', 
                  color: 'black', 
                  border: 'none', 
                  cursor: updatingUsername || usernameInput.trim() === user.username ? 'not-allowed' : 'pointer',
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.25)',
                  transition: 'all 0.3s ease',
                  opacity: updatingUsername || usernameInput.trim() === user.username ? 0.4 : 1,
                  marginTop: '0.5rem'
                }}
              >
                {updatingUsername ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {updatingUsername ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: WATCHLIST */}
        {activeTab === 'watchlist' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>My Watchlist</h2>
            {watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem 2rem' }}>
                <Bookmark size={40} style={{ color: 'var(--border-color)', marginBottom: '1rem' }} />
                <div>You haven't bookmarked any anime yet!</div>
                <Link to="/" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 700, display: 'inline-block', marginTop: '1rem' }}>Browse Shows</Link>
              </div>
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
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.95)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      className="hover-scale"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WATCH HISTORY */}
        {activeTab === 'history' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Watch History</h2>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem 2rem' }}>
                <Clock size={40} style={{ color: 'var(--border-color)', marginBottom: '1rem' }} />
                <div>You haven't watched anything yet!</div>
                <Link to="/" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 700, display: 'inline-block', marginTop: '1rem' }}>Start Watching</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {history.map(item => (
                  <Link to={`/watch/${item.anime_id}`} key={item.id} className="hover-scale" style={{ display: 'flex', gap: '1.25rem', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem', padding: '1rem', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                    <div style={{ width: '120px', aspectRatio: '16/9', borderRadius: '0.5rem', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                      <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.8 }}><Play size={24} color="var(--accent-primary)" fill="var(--accent-primary)" /></div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h3>
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

      {/* --- CROPPER MODAL (Backdrop Blur Glass Overlay) --- */}
      {cropperOpen && imageSrc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1.5rem'
        }} className="fade-in">
          
          <div className="glass" style={{
            width: '100%',
            maxWidth: '450px',
            borderRadius: '1.5rem',
            border: '1px solid var(--border-color)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>Crop Avatar</h3>
              <button 
                onClick={() => { setCropperOpen(false); setImageSrc(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
                className="hover-scale"
              >
                <X size={20} />
              </button>
            </div>

            {/* Crop Window Container */}
            <div style={{
              width: '260px',
              height: '260px',
              backgroundColor: '#050505',
              border: '1px solid var(--border-color)',
              borderRadius: '1rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
              touchAction: 'none'
            }}>
              {/* Circular Target Crop Frame Overlay */}
              <div style={{
                position: 'relative',
                width: `${containerSize}px`,
                height: `${containerSize}px`,
                borderRadius: '50%',
                border: '2px solid var(--accent-primary)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)', // Dim outer space
                overflow: 'hidden',
                zIndex: 2,
                pointerEvents: 'none'
              }} />

              {/* The Draggable / Zoomable Source Image */}
              <img 
                src={imageSrc} 
                alt="Source Crop"
                onLoad={handleImageLoaded}
                
                // Drag Events (Mouse)
                onMouseDown={(e) => {
                  e.preventDefault();
                  startDrag(e.clientX, e.clientY);
                }}
                onMouseMove={(e) => {
                  handleDrag(e.clientX, e.clientY);
                }}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                
                // Drag Events (Touch / Mobile)
                onTouchStart={(e) => {
                  startDrag(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchMove={(e) => {
                  handleDrag(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchEnd={endDrag}

                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${currentWidth}px`,
                  height: `${currentHeight}px`,
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  objectFit: 'cover',
                  zIndex: 1,
                  pointerEvents: 'auto',
                  userSelect: 'none'
                }}
              />
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem', textAlign: 'center' }}>Drag image to reposition</p>

            {/* Zoom Slider Control */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', marginBottom: '2rem' }}>
              <ZoomOut size={16} color="var(--text-secondary)" />
              <input 
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => {
                  const nextZoom = parseFloat(e.target.value);
                  setZoom(nextZoom);
                  
                  // Adjust position limits on-the-fly for the new scale
                  const nextWidth = imgDimensions.width * nextZoom;
                  const nextHeight = imgDimensions.height * nextZoom;
                  const nextMaxX = Math.max(0, (nextWidth - containerSize) / 2);
                  const nextMaxY = Math.max(0, (nextHeight - containerSize) / 2);
                  
                  // Keep position clamped inside new boundaries
                  setPosition({
                    x: Math.max(-nextMaxX, Math.min(nextMaxX, position.x)),
                    y: Math.max(-nextMaxY, Math.min(nextMaxY, position.y))
                  });
                }}
                style={{
                  flex: 1,
                  accentColor: 'var(--accent-primary)',
                  cursor: 'pointer',
                  height: '4px',
                  borderRadius: '2px'
                }}
              />
              <ZoomIn size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', minWidth: '35px' }}>{Math.round(zoom * 100)}%</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                onClick={() => { setCropperOpen(false); setImageSrc(null); }}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s'
                }}
                className="hover-scale"
              >
                Cancel
              </button>
              <button 
                onClick={handleCropSave}
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                  color: 'black',
                  border: 'none',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: uploading ? 0.5 : 1
                }}
                className="hover-scale"
              >
                {uploading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Apply Crop
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}
