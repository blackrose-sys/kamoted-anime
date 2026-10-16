import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail, Lock, User, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
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

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isRobotVerified, setIsRobotVerified] = useState(false);
  const [robotError, setRobotError] = useState(false);
  
  const mountTimeRef = useRef<number>(Date.now());
  const navigate = useNavigate();

  // Password strength checks
  const checks = {
    length: password.length >= 6,
    match: password.length > 0 && password === confirmPassword,
  };

  const isFormValid = username.length >= 3 && email.includes('@') && checks.length && checks.match && agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. DDoS burst shield check
    if (!ddosBurstShield.canMakeRequest()) {
      setError('Too many requests detected. Please pause for 5 seconds.');
      return;
    }

    // 2. "I'm not a robot" check
    if (!isRobotVerified) {
      setRobotError(true);
      setError('Please check "I\'m not a robot" to verify.');
      return;
    }

    // 2. Anti-Bot Honeypot Trap
    if (isHoneypotTriggered(honeypot)) {
      console.warn('[Security] Bot honeypot triggered on registration form.');
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setError('Verification failed. Automated registration rejected.');
      }, 1200);
      return;
    }

    // 3. Known bot automation detection
    const botCheck = isKnownBotEnvironment();
    if (botCheck.isBot) {
      console.warn('[Security] Automated browser detected on registration:', botCheck.reason);
      setError('Automated browsers are prohibited from creating accounts.');
      return;
    }

    // 4. Form Submission Velocity Check (< 1200ms is impossible for a human to fill 4 fields)
    if (isSubmissionTooFast(mountTimeRef.current, 1200)) {
      console.warn('[Security] Instantaneous registration form submission blocked.');
      setError('Submission too fast. Please take a moment to review your details.');
      return;
    }

    // 5. Registration Flood Rate Limiting (max 3 accounts per 30 mins)
    const rateCheck = checkActionRateLimit('register_flood', {
      maxRequests: 3,
      windowSeconds: 1800,
      cooldownSeconds: 600
    });
    if (!rateCheck.allowed) {
      setError(`Account creation limit reached. Please wait ${rateCheck.waitSeconds} seconds before registering another account.`);
      return;
    }

    const cleanUsername = sanitizeInput(username);
    const cleanEmail = sanitizeInput(email).toLowerCase();

    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!checks.length) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!checks.match) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // 6. Computational Proof-of-Work Puzzle (DDoS & Mass-Account Bot Protection)
      setSecurityStatus('Computing anti-bot cryptographic check...');
      const powChallenge = generatePoWChallenge(3);
      await solvePoWChallenge(powChallenge);
      setSecurityStatus('');

      // Check if email already exists in profiles
      const { data: existingEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingEmail) {
        setError('This email is already registered. Try logging in instead.');
        setLoading(false);
        return;
      }

      // Check if username already exists in profiles
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUsername) {
        setError('This username is already taken. Please choose another one.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { username: cleanUsername }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Try logging in instead.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // Record successful registration for rate limit tracker
      recordAction('register_flood');

      // Check if session is already active (i.e. email confirmation is disabled)
      if (data?.session) {
        navigate('/');
      } else {
        // Redirect to verify page with the email
        navigate('/verify', { state: { email: cleanEmail } });
      }
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
        


        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem', textAlign: 'center' }}>Create Account</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Join the kamoted community. We'll send a verification code to your email.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.15)', color: 'var(--text-secondary)', padding: '0.85rem 1rem', borderRadius: '0.75rem', fontSize: '0.8rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
          <span>💡</span>
          <span><strong>Pro Tip:</strong> When submitting, your device (like iOS Keychain or Google Passwords) will offer to save your password. Be sure to select <strong>Save</strong> so you don't forget it!</span>
        </div>
        
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.85rem 1rem', borderRadius: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Honeypot Trap */}
          <HoneypotTrap value={honeypot} onChange={setHoneypot} name="kamoted_reg_trap" />

          {/* Username */}
          <div>
            <label style={labelStyle}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                name="username"
                autoComplete="username"
                required
                placeholder="Choose a username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="email" 
                name="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                required
                placeholder="Min 6 characters"
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: '2.75rem' }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <EyeOff size={18} color="var(--text-secondary)" /> : <Eye size={18} color="var(--text-secondary)" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={labelStyle}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type={showPassword ? 'text' : 'password'}
                name="confirm-password"
                autoComplete="new-password"
                required
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Password Strength Checks */}
          {password.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: checks.length ? '#4ade80' : '#fca5a5' }}>
                {checks.length ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                At least 6 characters
              </div>
              {confirmPassword.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: checks.match ? '#4ade80' : '#fca5a5' }}>
                  {checks.match ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  Passwords match
                </div>
              )}
            </div>
          )}

          {/* Terms Agreement */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              style={{ 
                marginTop: '3px', 
                accentColor: 'var(--accent-primary)',
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                flexShrink: 0
              }}
            />
            <label htmlFor="agree-terms" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer', fontWeight: 500 }}>
              I agree to the <Link to="/terms" target="_blank" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'underline' }}>Terms of Service</Link> and <Link to="/privacy" target="_blank" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'underline' }}>Privacy Policy</Link>
            </label>
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
            disabled={loading || !isFormValid} 
            style={{ 
              marginTop: '0.5rem', 
              display: 'flex', 
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isFormValid ? 1 : 0.5,
              cursor: isFormValid ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>{securityStatus || 'Creating Account...'}</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
        
        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Login</Link>
        </div>
      </div>
    </main>
  );
}
