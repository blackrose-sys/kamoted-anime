import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('kamoted_announcement_dismissed');
    if (isDismissed) setDismissed(true);
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('kamoted_announcement_dismissed', 'true');
  };

  return (
    <div style={{
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
      borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
      color: '#fef08a',
      padding: '0.65rem 1.25rem',
      fontSize: '0.82rem',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      width: '100%',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      position: 'relative',
      zIndex: 60
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, justifyContent: 'center', textAlign: 'center', flexWrap: 'wrap' }}>
        <span style={{
          backgroundColor: '#f59e0b',
          color: 'black',
          padding: '0.15rem 0.6rem',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
        }}>
          <AlertTriangle size={13} color="black" /> SYSTEM NOTICE
        </span>
        <span>
          Server 1 (AnimePlay) API is currently down. Please use <strong style={{ color: '#ffffff', textDecoration: 'underline', fontWeight: 900 }}>Server 2 (MegaPlay)</strong> for video streaming!
        </span>
      </div>
      <button 
        onClick={handleDismiss} 
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#fef08a', 
          cursor: 'pointer', 
          opacity: 0.8, 
          padding: '0.25rem', 
          display: 'flex', 
          alignItems: 'center',
          transition: 'opacity 0.2s, transform 0.2s'
        }}
        onMouseOver={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseOut={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1)'; }}
        title="Dismiss notice"
      >
        <X size={17} />
      </button>
    </div>
  );
}
