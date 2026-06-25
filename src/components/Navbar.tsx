import { Tv, Search, Check, LogOut, User as UserIcon, Calendar, Newspaper, List } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Discord SVG icon (official shape)
function DiscordIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export function Navbar() {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleCopy = () => {
    navigator.clipboard.writeText('kamotedelight');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <nav className="glass" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 'var(--nav-height)', display: 'flex', alignItems: 'center' }}>
      <div className="container flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover-scale">
          <Tv color="var(--accent-primary)" size={28} className="logo-icon" />
          <span className="animated-logo">kamoted</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Nav Links */}
          <div className="flex items-center gap-5" style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>
            <Link
              to="/browse"
              className="flex items-center gap-2"
              style={{ transition: 'color 0.2s' }}
              onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
              onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'}
            >
              <Search size={15} />
              <span className="hidden sm:inline">Browse</span>
            </Link>
            <Link
              to="/calendar"
              className="flex items-center gap-2"
              style={{ transition: 'color 0.2s' }}
              onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
              onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'}
            >
              <Calendar size={15} />
              <span className="hidden sm:inline">Calendar</span>
            </Link>
            <Link
              to="/news"
              className="flex items-center gap-2"
              style={{ transition: 'color 0.2s' }}
              onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
              onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'}
            >
              <Newspaper size={15} />
              <span className="hidden sm:inline">News</span>
            </Link>
            <Link
              to="/lists"
              className="flex items-center gap-2"
              style={{ transition: 'color 0.2s' }}
              onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
              onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'}
            >
              <List size={15} />
              <span className="hidden sm:inline">Playlists</span>
            </Link>
          </div>

          {/* Discord Button — premium pill */}
          <button
            onClick={handleCopy}
            title={copied ? 'Discord ID Copied!' : 'Copy Discord ID: kamotedelight'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.45rem 1rem',
              borderRadius: '9999px',
              background: copied
                ? 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.15))'
                : 'linear-gradient(135deg, rgba(88,101,242,0.45), rgba(88,101,242,0.25))',
              border: `1px solid ${copied ? '#22c55e' : '#5865f2'}`,
              color: 'white', // extremely visible
              cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: copied
                ? '0 0 15px rgba(34,197,94,0.45)'
                : '0 0 15px rgba(88,101,242,0.4)',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
            }}
            onMouseOver={e => {
              const b = e.currentTarget as HTMLButtonElement;
              if (copied) {
                b.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.45), rgba(34,197,94,0.25))';
                b.style.boxShadow = '0 0 25px rgba(34,197,94,0.7)';
              } else {
                b.style.background = 'linear-gradient(135deg, rgba(88,101,242,0.6), rgba(88,101,242,0.4))';
                b.style.borderColor = '#7289da';
                b.style.boxShadow = '0 0 25px rgba(88,101,242,0.65)';
              }
              b.style.transform = 'translateY(-1.5px)';
            }}
            onMouseOut={e => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.transform = 'translateY(0)';
              if (copied) {
                b.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.15))';
                b.style.boxShadow = '0 0 15px rgba(34,197,94,0.45)';
              } else {
                b.style.background = 'linear-gradient(135deg, rgba(88,101,242,0.45), rgba(88,101,242,0.25))';
                b.style.borderColor = '#5865f2';
                b.style.boxShadow = '0 0 15px rgba(88,101,242,0.4)';
              }
            }}
          >
            {copied ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span className="hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <DiscordIcon size={15} />
                <span className="hidden sm:inline">Discord</span>
              </>
            )}
          </button>

          {/* User menu / Sign In */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  backgroundColor: 'var(--bg-color-tertiary)',
                  border: '2px solid var(--accent-primary)',
                  overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center',
                  cursor: 'pointer', padding: 0,
                  boxShadow: '0 0 10px rgba(245,158,11,0.25)',
                  transition: 'box-shadow 0.2s, transform 0.2s'
                }}
                onMouseOver={e => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = '0 0 16px rgba(245,158,11,0.5)'; b.style.transform = 'scale(1.05)'; }}
                onMouseOut={e => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = '0 0 10px rgba(245,158,11,0.25)'; b.style.transform = 'scale(1)'; }}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#fff' }}>
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {showDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.6rem',
                  backgroundColor: 'rgba(8,8,14,0.97)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: '0.85rem', padding: '0.5rem',
                  display: 'flex', flexDirection: 'column', gap: '0.25rem',
                  minWidth: '170px', zIndex: 100,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(16px)'
                }}>
                  <div style={{ padding: '0.5rem 0.65rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '0.25rem' }}>
                    Signed in as<br />
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{user.username}</strong>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setShowDropdown(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.55rem 0.65rem', borderRadius: '0.55rem',
                      color: 'rgba(255,255,255,0.75)', textDecoration: 'none',
                      fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.15s'
                    }}
                    onMouseOver={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.backgroundColor = 'rgba(255,255,255,0.06)'; a.style.color = 'white'; }}
                    onMouseOut={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.backgroundColor = 'transparent'; a.style.color = 'rgba(255,255,255,0.75)'; }}
                  >
                    <UserIcon size={14} /> Profile
                  </Link>
                  <button
                    onClick={() => { logout(); setShowDropdown(false); navigate('/'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0.55rem 0.65rem', borderRadius: '0.55rem',
                      color: '#f87171', fontSize: '0.8rem', fontWeight: 700,
                      textAlign: 'left', width: '100%', transition: 'all 0.15s'
                    }}
                    onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.1)'}
                    onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="btn-primary"
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.75rem', borderRadius: '9999px' }}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
