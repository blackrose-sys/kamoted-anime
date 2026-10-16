import { useState, useEffect } from 'react';
import { Check, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { generatePoWChallenge, solvePoWChallenge, isKnownBotEnvironment } from '../lib/security';

interface RobotVerificationProps {
  verified: boolean;
  onVerify: (verified: boolean) => void;
  lockoutSeconds?: number;
  onLockoutEnd?: () => void;
  hasError?: boolean;
}

export function RobotVerification({
  verified,
  onVerify,
  lockoutSeconds = 0,
  onLockoutEnd,
  hasError = false
}: RobotVerificationProps) {
  const [checking, setChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(lockoutSeconds);
  const [isBotDetected, setIsBotDetected] = useState(false);

  // Sync lockout countdown
  useEffect(() => {
    setSecondsLeft(lockoutSeconds);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onLockoutEnd?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, onLockoutEnd]);

  const handleCheckboxClick = async () => {
    if (verified || checking || secondsLeft > 0) return;

    // Check for automation environment
    const botCheck = isKnownBotEnvironment();
    if (botCheck.isBot) {
      setIsBotDetected(true);
      return;
    }

    setChecking(true);

    try {
      // Execute Proof-of-Work challenge in background to verify real human hardware
      const challenge = generatePoWChallenge(3);
      await solvePoWChallenge(challenge);

      // Brief natural delay to match iconic captcha UX
      setTimeout(() => {
        setChecking(false);
        onVerify(true);
      }, 350);
    } catch {
      setChecking(false);
      onVerify(false);
    }
  };

  // If in active lockout cooldown
  if (secondsLeft > 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          padding: '0.85rem 1rem',
          borderRadius: '0.75rem',
          color: '#fca5a5',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        <Lock size={18} color="#ef4444" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#ef4444', fontWeight: 800 }}>Account Protection Active</div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px' }}>
            Too many attempts. Cooldown:{' '}
            <span style={{ fontWeight: 800, color: '#f87171' }}>{secondsLeft}s</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${hasError ? '#ef4444' : verified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
        boxShadow: hasError ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none',
        transition: 'all 0.25s ease',
        userSelect: 'none',
      }}
    >
      {/* Left side: Checkbox + Label */}
      <div
        onClick={handleCheckboxClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          cursor: verified || checking ? 'default' : 'pointer',
        }}
      >
        {/* Checkbox box */}
        <div
          role="checkbox"
          aria-checked={verified}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleCheckboxClick();
            }
          }}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: verified
              ? '2px solid #10b981'
              : hasError
              ? '2px solid #ef4444'
              : '2px solid rgba(255, 255, 255, 0.45)',
            backgroundColor: verified ? '#10b981' : 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: verified || checking ? 'default' : 'pointer',
          }}
        >
          {checking ? (
            <Loader2 size={16} className="animate-spin" color="var(--accent-primary, #f59e0b)" />
          ) : verified ? (
            <Check size={18} color="#000" strokeWidth={3} />
          ) : null}
        </div>

        {/* Label */}
        <span
          style={{
            fontSize: '0.92rem',
            fontWeight: 600,
            color: verified ? 'white' : 'rgba(255, 255, 255, 0.9)',
            letterSpacing: '0.01em',
          }}
        >
          {isBotDetected ? 'Automated client blocked' : "I'm not a robot"}
        </span>
      </div>

      {/* Right side: Modern badge & branding */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          opacity: 0.7,
        }}
      >
        <ShieldCheck size={22} color={verified ? '#10b981' : '#94a3b8'} />
        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '0.04em' }}>
          reCAPTCHA
        </span>
        <span style={{ fontSize: '0.52rem', color: 'rgba(255, 255, 255, 0.35)' }}>
          Privacy - Terms
        </span>
      </div>
    </div>
  );
}
