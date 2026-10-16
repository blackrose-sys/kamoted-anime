import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail, Lock, Eye, EyeOff, XCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  checkLoginSecurity,
  recordLoginFailure,
  recordLoginSuccess,
  isKnownBotEnvironment,
  isSubmissionTooFast,
  isHoneypotTriggered,
  generatePoWChallenge,
  solvePoWChallenge,
  sanitizeInput,
  ddosBurstShield
} from '../lib/security';
import { SecurityBadge, HoneypotTrap } from '../components/SecurityBadge';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<string>('');
  const [honeypot, setHoneypot] = useState('');
  
  // Security attempt tracking & lockout states
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [requireHumanCheck, setRequireHumanCheck] = useState(false);
  const [isHumanVerified, setIsHumanVerified] = useState(true);

  const mountTimeRef = useRef<number>(Date.now());
  const navigate = useNavigate();

  // On email change, evaluate existing security status for this email
  useEffect(() => {
    if (!email.trim()) {
      setLockoutSeconds(0);
      setRemainingAttempts(5);
      return;
    }
    const sec = checkLoginSecurity(email);
    setRemainingAttempts(sec.remainingAttempts);
    setLockoutSeconds(sec.lockoutSeconds);
    if (sec.isLocked) {
      setError(sec.message || 'Account temporarily locked due to failed attempts.');
    } else if (sec.remainingAttempts <= 2) {
      setRequireHumanCheck(true);
      setIsHumanVerified(false);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Check Global DDoS burst shield
    if (!ddosBurstShield.canMakeRequest()) {
      setError('Too many requests detected. Kamoted DDoS protection throttled this action. Please pause for 5 seconds.');
      return;
    }

    // 2. Anti-Bot Honeypot Trap
    if (isHoneypotTriggered(honeypot)) {
      console.warn('[Security] Bot honeypot triggered on login form.');
      // Silently pretend to process for 1 second then error to fool the bot without touching database
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setError('Verification failed. Automated activity rejected.');
      }, 1000);
      return;
    }

    // 3. Known Bot / Automation Framework check
    const botCheck = isKnownBotEnvironment();
    if (botCheck.isBot) {
      console.warn('[Security] Automated browser detected:', botCheck.reason);
      setError('Automated or scripted browser environment detected. Access restricted.');
      return;
    }

    // 4. Form Submission Velocity Check (human reaction timer)
    if (isSubmissionTooFast(mountTimeRef.current, 600)) {
      console.warn('[Security] Instantaneous form submission blocked (bot trap).');
      setError('Form submitted too fast. Please retry as a human user.');
      return;
    }

    // 5. Account Brute-Force & Attempt Limit Check
    const cleanEmail = sanitizeInput(email).toLowerCase();
    const sec = checkLoginSecurity(cleanEmail);
    if (sec.isLocked) {
      setLockoutSeconds(sec.lockoutSeconds);
      setError(sec.message || `Account locked. Please wait ${sec.lockoutSeconds} seconds.`);
      return;
    }

    // 6. Interactive verification if suspicious
    if (requireHumanCheck && !isHumanVerified) {
      setError('Please complete the security human verification check below.');
      return;
    }

    setLoading(true);

    try {
      // 7. Solve Proof-of-Work Challenge (Computational puzzle to stop DDoS & brute-force script storms)
      setSecurityStatus('Verifying secure connection...');
      const powChallenge = generatePoWChallenge(3);
      await solvePoWChallenge(powChallenge);
      setSecurityStatus('');

      // 8. Query Supabase Auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });
      
      if (signInError) {
        // Record failure and update lockout status
        const failRecord = recordLoginFailure(cleanEmail);
        setRemainingAttempts(failRecord.remainingAttempts);
        setLockoutSeconds(failRecord.lockoutSeconds);

        if (failRecord.isLocked) {
          setError(failRecord.message);
        } else if (signInError.message.includes('Invalid login')) {
          setError(failRecord.message);
          if (failRecord.remainingAttempts <= 2) {
            setRequireHumanCheck(true);
            setIsHumanVerified(false);
          }
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email first. Check your inbox for the verification code.');
          setTimeout(() => navigate('/verify', { state: { email: cleanEmail } }), 2000);
        } else {
          setError(signInError.message);
        }
        return;
      }
      
      // Success: Clear failed attempts
      recordLoginSuccess(cleanEmail);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again later.');
    } finally {
      setLoading(false);
      setSecurityStatus('');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.85rem 1rem 0.85rem 2.75rem',
    borderRadius: '0.75rem',
    backgroundColor: 'var(--bg-color-secondary)',
    border: '1px solid var(--border-color)',
    color: 'white',
    outline: 'none',
    fontSize: '0.95rem',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '7rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        {/* Security Badge Indicator */}
        <div style={{ marginBottom: '1.5rem' }}>
          <SecurityBadge
            remainingAttempts={remainingAttempts}
            lockoutSeconds={lockoutSeconds}
            onLockoutEnd={() => {
              setLockoutSeconds(0);
              setError('');
              const updated = checkLoginSecurity(email);
              setRemainingAttempts(updated.remainingAttempts);
            }}
            showHumanVerification={requireHumanCheck}
            onVerified={setIsHumanVerified}
          />
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem', textAlign: 'center' }}>Welcome Back</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.75rem', fontSize: '0.875rem' }}>Login to access your watchlist and history.</p>
        
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.85rem 1rem', borderRadius: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Invisible Anti-Bot Honeypot */}
          <HoneypotTrap value={honeypot} onChange={setHoneypot} name="kamoted_hp_trap" />

          {/* Email */}
          <div>
            <label style={labelStyle}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="email" 
                name="email"
                autoComplete="username"
                required
                disabled={lockoutSeconds > 0}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  ...inputStyle,
                  opacity: lockoutSeconds > 0 ? 0.6 : 1,
                  cursor: lockoutSeconds > 0 ? 'not-allowed' : 'text'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
          
          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={labelStyle}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none', marginBottom: '0.5rem' }} className="hover-scale">Forgot Password?</Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                disabled={lockoutSeconds > 0}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingRight: '2.75rem',
                  opacity: lockoutSeconds > 0 ? 0.6 : 1,
                  cursor: lockoutSeconds > 0 ? 'not-allowed' : 'text'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                disabled={lockoutSeconds > 0}
                style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? <EyeOff size={18} color="var(--text-secondary)" /> : <Eye size={18} color="var(--text-secondary)" />}
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || lockoutSeconds > 0} 
            style={{ 
              marginTop: '0.5rem', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem',
              opacity: (loading || lockoutSeconds > 0) ? 0.6 : 1,
              cursor: (loading || lockoutSeconds > 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>{securityStatus || 'Authenticating...'}</span>
              </>
            ) : lockoutSeconds > 0 ? (
              `Locked (${lockoutSeconds}s)`
            ) : (
              'Login'
            )}
          </button>
        </form>
        
        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Register</Link>
        </div>

        {/* Security Footer */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
          <ShieldCheck size={13} color="#10b981" />
          <span>Protected by Kamoted Shield • Cryptographic Anti-DDoS Verification</span>
        </div>
      </div>
    </main>
  );
}
