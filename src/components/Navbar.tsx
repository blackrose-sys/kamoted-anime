import { Tv, MessageCircle, Search, Check, LogOut, User as UserIcon, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="glass" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 'var(--nav-height)', display: 'flex', alignItems: 'center' }}>
      <div className="container flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover-scale">
          <Tv color="var(--accent-primary)" size={28} className="logo-icon" />
          <span className="animated-logo">kamoted</span>
        </Link>
        
        <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-zinc-400">
          <Link to="/browse" className="flex items-center gap-2 hover:text-white" style={{ transition: 'color 0.2s' }}>
            <Search size={16} />
            <span className="hidden sm:inline">Browse</span>
          </Link>
          <Link to="/calendar" className="flex items-center gap-2 hover:text-white" style={{ transition: 'color 0.2s' }}>
            <Calendar size={16} />
            <span className="hidden sm:inline">Calendar</span>
          </Link>
          <button 
            onClick={() => {
              navigator.clipboard.writeText('kamotedelight');
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-2 hover:text-white" 
            style={{ transition: 'color 0.2s', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {copied ? <Check size={16} color="var(--accent-primary)" /> : <MessageCircle size={16} />}
            <span className="hidden sm:inline" style={{ color: copied ? 'var(--accent-primary)' : 'inherit', transition: 'color 0.2s' }}>
              {copied ? 'Copied ID' : 'Discord'}
            </span>
          </button>
          
          {user ? (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-color-tertiary)', border: '2px solid var(--accent-primary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', padding: 0 }}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#fff' }}>{user.username.charAt(0).toUpperCase()}</span>
                )}
              </button>
              
              {showDropdown && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', backgroundColor: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', marginBottom: '0.25rem' }}>
                    Signed in as <br/><strong style={{ color: '#fff', fontSize: '0.875rem' }}>{user.username}</strong>
                  </div>
                  <Link 
                    to="/profile" 
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-2 hover:text-accent-primary" 
                    style={{ padding: '0.5rem', borderRadius: '0.25rem', transition: 'all 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-color-tertiary)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <UserIcon size={14} /> Profile
                  </Link>
                  <button 
                    onClick={() => { logout(); setShowDropdown(false); navigate('/'); }}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.25rem', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderRadius: '9999px' }}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
