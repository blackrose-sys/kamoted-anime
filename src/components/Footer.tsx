import { Terminal, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', backgroundColor: '#050505', padding: '3rem 0' }}>
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }} className="hover-scale">
            <Tv color="var(--accent-primary)" size={28} className="logo-icon" />
            <span className="animated-logo">kamoted</span>
          </Link>
          
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Terminal size={14} color="var(--accent-primary)" />
              Directory
            </h3>
            <div className="flex flex-col gap-2 text-xs font-medium text-zinc-400">
              <Link to="/browse" className="hover:text-accent-primary transition-colors">Browse Library</Link>
              <Link to="/calendar" className="hover:text-accent-primary transition-colors">Ongoing Releases</Link>
              <Link to="/browse?tab=season" className="hover:text-accent-primary transition-colors">Seasonal Archive</Link>
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
          © {new Date().getFullYear()} kamoted. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
