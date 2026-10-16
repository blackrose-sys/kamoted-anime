import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Lock, RefreshCw } from 'lucide-react';

interface SecurityBadgeProps {
  remainingAttempts?: number;
  lockoutSeconds?: number;
  onLockoutEnd?: () => void;
  showHumanVerification?: boolean;
  onVerified?: (verified: boolean) => void;
  compact?: boolean;
}

export function SecurityBadge({
  remainingAttempts,
  lockoutSeconds = 0,
  onLockoutEnd,
  showHumanVerification = false,
  onVerified,
  compact = false
}: SecurityBadgeProps) {
  const [secondsLeft, setSecondsLeft] = useState(lockoutSeconds);
  const [isHumanVerified, setIsHumanVerified] = useState(!showHumanVerification);
  const [verifying, setVerifying] = useState(false);

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

  const handleManualVerify = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setIsHumanVerified(true);
      onVerified?.(true);
    }, 700);
  };

  // If in active lockout countdown
  if (secondsLeft > 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          color: '#fca5a5',
          fontSize: '0.85rem',
          fontWeight: 600,
          animation: 'pulse 2s infinite',
        }}
      >
        <Lock size={18} color="#ef4444" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#ef4444', fontWeight: 800 }}>Account Protection Active</div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px' }}>
            Too many failed attempts. Security cooldown:{' '}
            <span style={{ fontWeight: 800, color: '#f87171' }}>{secondsLeft}s</span>
          </div>
        </div>
      </div>
    );
  }

  // Interactive human verification challenge (if needed)
  if (showHumanVerification && !isHumanVerified) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '0.65rem 0.9rem',
          borderRadius: '0.75rem',
          fontSize: '0.825rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={16} color="var(--accent-primary, #f59e0b)" />
          <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
            Security check: Confirm you are human
          </span>
        </div>
        <button
          type="button"
          onClick={handleManualVerify}
          disabled={verifying}
          style={{
            background: 'var(--accent-primary, #f59e0b)',
            color: '#000',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.35rem 0.75rem',
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          {verifying ? (
            <>
              <RefreshCw size={12} className="animate-spin" /> Verifying...
            </>
          ) : (
            'I am human'
          )}
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.72rem',
          color: 'var(--text-secondary, #94a3b8)',
          opacity: 0.85,
        }}
      >
        <ShieldCheck size={13} color="#10b981" />
        <span>Protected by Kamoted Shield</span>
      </div>
    );
  }

  // Standard status badge
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.45rem 0.75rem',
        borderRadius: '0.65rem',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        fontSize: '0.75rem',
        color: 'var(--text-secondary, #94a3b8)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <ShieldCheck size={14} color="#10b981" />
        <span>
          <strong style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Anti-Bot & DDoS Guard</strong> active
        </span>
      </div>
      {typeof remainingAttempts === 'number' && remainingAttempts < 5 && (
        <span
          style={{
            color: remainingAttempts <= 2 ? '#ef4444' : '#f59e0b',
            fontWeight: 700,
            fontSize: '0.72rem',
          }}
        >
          {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} left
        </span>
      )}
    </div>
  );
}

/**
 * Honeypot Form Field Component
 * Hidden off-screen and completely invisible to humans and screen readers.
 * Automated bots scan HTML forms and populate all fields, falling into the trap!
 */
export function HoneypotTrap({
  value,
  onChange,
  name = 'website_url_hp'
}: {
  value: string;
  onChange: (val: string) => void;
  name?: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        opacity: 0,
        height: 0,
        width: 0,
        overflow: 'hidden',
        zIndex: -1,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
      tabIndex={-1}
    >
      <label htmlFor={name}>Leave this field blank</label>
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}
