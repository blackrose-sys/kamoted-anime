import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  checkActionRateLimit,
  recordAction,
  isKnownBotEnvironment,
  isSubmissionTooFast,
  isHoneypotTriggered,
  generatePoWChallenge,
  solvePoWChallenge,
  sanitizeInput,
  ddosBurstShield
} from '../lib/security';
import { HoneypotTrap } from '../components/SecurityBadge';
import { RobotVerification } from '../components/RobotVerification';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [securityStatus, setSecurityStatus] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);
  const [isRobotVerified, setIsRobotVerified] = useState(false);
  const [robotError, setRobotError] = useState(false);

  const mountTimeRef = useRef<number>(Date.now());

  // Cooldown timer ticker
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // 1. DDoS Burst Shield
    if (!ddosBurstShield.canMakeRequest()) {
      setError('Too many requests detected. Please pause for 5 seconds.');
      return;
    }

    // 2. Anti-Bot Honeypot
    if (isHoneypotTriggered(honeypot)) {
      console.warn('[Security] Bot honeypot triggered on forgot password form.');
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setSuccess(true);
      }, 1000);
      return;
    }

    // 3. Known bot automation detection
    const botCheck = isKnownBotEnvironment();
    if (botCheck.isBot) {
      console.warn('[Security] Automated browser detected:', botCheck.reason);
      setError('Automated or scripted browser environment detected.');
      return;
    }

    // 4. Form Submission Velocity Check
    if (isSubmissionTooFast(mountTimeRef.current, 600)) {
      console.warn('[Security] Instantaneous form submission blocked.');
      setError('Submission too fast. Please retry as a human user.');
      return;
    }

    // 5. Rate limiting: max 3 requests per 15 minutes, with 60s cooldown
    const rateCheck = checkActionRateLimit('forgot_pwd', {
      maxRequests: 3,
      windowSeconds: 900,
      cooldownSeconds: 60
    });
    if (!rateCheck.allowed) {
      setCooldownSec(rateCheck.waitSeconds);
      setError(`Password reset limit reached. Please wait ${rateCheck.waitSeconds}s before requesting another reset.`);
      return;
    }

    // 6. "I'm not a robot" check
    if (!isRobotVerified) {
      setRobotError(true);
      setError('Please check "I\'m not a robot" to verify.');
      return;
    }

    const cleanEmail = sanitizeInput(email).toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // 7. Computational Proof-of-Work Puzzle (Anti-Spam / Anti-DDoS)
      setSecurityStatus('Verifying...');
      const powChallenge = generatePoWChallenge(3);
      await solvePoWChallenge(powChallenge);
      setSecurityStatus('');

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      recordAction('forgot_pwd');
      setCooldownSec(60);
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.message || err?.error_description || (typeof err === 'string' ? err : 'An error occurred. Please try again.');
      setError(msg);
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
        
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem', textAlign: 'center' }}>Reset Password</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.75rem', fontSize: '0.875rem' }}>
          Enter your email and we'll send you a link to reset your password.
        </p>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.85rem 1rem', borderRadius: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(74, 222, 128, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={24} color="#4ade80" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem' }}>Check your email</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                We sent a password reset link to <strong style={{ color: 'white' }}>{email}</strong>.
              </p>
              <p style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', lineHeight: 1.5, marginTop: '0.75rem', fontWeight: 600 }}>
                ⚠️ Important: If the link doesn't open, right-click it and select "Copy link address", then paste it directly into your browser's address bar.
              </p>
            </div>
            <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none', fontSize: '0.875rem', marginTop: '1rem' }} className="hover-scale">
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Honeypot Trap */}
            <HoneypotTrap value={honeypot} onChange={setHoneypot} name="kamoted_pwd_trap" />

            <div>
              <label style={labelStyle}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="email" 
                  required
                  placeholder="you@example.com"
                  value={email}
                  disabled={cooldownSec > 0}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    ...inputStyle,
                    opacity: cooldownSec > 0 ? 0.6 : 1,
                    cursor: cooldownSec > 0 ? 'not-allowed' : 'text'
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* "I'm not a robot" Verification Widget */}
            <div style={{ marginTop: '0.25rem' }}>
              <RobotVerification
                verified={isRobotVerified}
                onVerify={(v) => {
                  setIsRobotVerified(v);
                  setRobotError(false);
                  if (error.includes('not a robot')) setError('');
                }}
                hasError={robotError}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || cooldownSec > 0} 
              style={{ 
                marginTop: '0.5rem', 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: (loading || cooldownSec > 0) ? 0.6 : 1,
                cursor: (loading || cooldownSec > 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>{securityStatus || 'Processing...'}</span>
                </>
              ) : cooldownSec > 0 ? (
                `Wait ${cooldownSec}s before retry`
              ) : (
                'Send Reset Link'
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontWeight: 700, textDecoration: 'none', fontSize: '0.875rem' }} className="hover-scale">
                <ArrowLeft size={16} /> Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
