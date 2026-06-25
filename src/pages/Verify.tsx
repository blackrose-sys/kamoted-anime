import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as any)?.email || '';
  
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take only last digit
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    // Focus the next empty input or the last one
    const nextEmpty = newOtp.findIndex(v => v === '');
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

    // Auto-submit if all filled
    if (newOtp.every(v => v !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleVerify = async (token: string) => {
    if (token.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });

      if (verifyError) {
        setError(verifyError.message.includes('expired') 
          ? 'Code expired. Click "Resend Code" to get a new one.'
          : 'Invalid verification code. Please check and try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      setSuccess('Email verified successfully! Redirecting...');
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      
      if (error) {
        setError(error.message);
        return;
      }
      
      setSuccess('New verification code sent! Check your inbox.');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Failed to resend code. Please try again.');
    }
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '460px', padding: '2.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
        
        {/* Icon */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '2px solid rgba(245, 158, 11, 0.3)', marginBottom: '1.5rem' }}>
          <Mail size={28} color="var(--accent-primary)" />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem' }}>Verify Your Email</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          We sent a 6-digit code to<br />
          <strong style={{ color: 'var(--accent-primary)' }}>{email}</strong>
        </p>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.85rem 1rem', borderRadius: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', padding: '0.85rem 1rem', borderRadius: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            {success}
          </div>
        )}

        {/* OTP Input */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              style={{
                width: '52px',
                height: '60px',
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: 900,
                borderRadius: '0.75rem',
                backgroundColor: digit ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-color-secondary)',
                border: `2px solid ${digit ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                color: 'white',
                outline: 'none',
                transition: 'all 0.2s',
                caretColor: 'var(--accent-primary)',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.2)'; }}
              onBlur={e => { e.target.style.borderColor = digit ? 'var(--accent-primary)' : 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
            />
          ))}
        </div>

        {/* Verify Button */}
        <button 
          onClick={() => handleVerify(otp.join(''))}
          className="btn-primary" 
          disabled={loading || otp.some(d => d === '')}
          style={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'center',
            marginBottom: '1.5rem',
            opacity: otp.every(d => d !== '') ? 1 : 0.5,
          }}
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify Email'}
        </button>

        {/* Resend */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Didn't receive the code?{' '}
          <button 
            onClick={handleResend}
            disabled={resendCooldown > 0}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: resendCooldown > 0 ? 'var(--text-secondary)' : 'var(--accent-primary)', 
              fontWeight: 700, 
              cursor: resendCooldown > 0 ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <RefreshCw size={14} />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </p>
      </div>
    </main>
  );
}
