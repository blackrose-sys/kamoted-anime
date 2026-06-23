import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Verify() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) navigate('/register');
  }, [email, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup'
      });
      
      if (verifyError) {
        setError(verifyError.message || 'Invalid verification code');
        return;
      }
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', textAlign: 'center' }}>Verify Email</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2rem', fontSize: '0.875rem' }}>
          We sent a 6-digit code to <strong style={{ color: 'var(--accent-primary)' }}>{email}</strong>
        </p>
        
        {error && <div className="animate-pulse" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem', textAlign: 'center' }}>6-Digit Code</label>
            <input 
              type="text" 
              required
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ width: '100%', padding: '1rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', fontSize: '2rem', textAlign: 'center', letterSpacing: '0.5em', fontWeight: 900 }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading || code.length !== 6} style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify'}
          </button>
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            You can also just click the link in your email!
          </div>
        </form>
      </div>
    </main>
  );
}
