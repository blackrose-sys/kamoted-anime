import React from 'react';
import { Zap, Crown } from 'lucide-react';

interface UserBadgeProps {
  username: string;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

export function UserBadge({ username, size = 'md', style }: UserBadgeProps) {
  if (!username) return null;

  const isDev = username.toLowerCase() === 'fckitscott';

  if (!isDev) return null;

  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <span
      title="Lead Developer & Platform Creator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '0.2rem' : '0.35rem',
        padding: isSm ? '0.12rem 0.45rem' : isLg ? '0.35rem 0.85rem' : '0.2rem 0.6rem',
        borderRadius: '9999px',
        background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)',
        color: '#000',
        fontWeight: 900,
        fontSize: isSm ? '0.6rem' : isLg ? '0.8rem' : '0.68rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        boxShadow: '0 0 12px rgba(245, 158, 11, 0.5), 0 0 20px rgba(236, 72, 153, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        cursor: 'default',
        userSelect: 'none',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      <Zap size={isSm ? 10 : isLg ? 14 : 11} fill="black" color="black" />
      <span>DEV</span>
      <span style={{ opacity: 0.4, fontWeight: 400 }}>|</span>
      <Crown size={isSm ? 10 : isLg ? 14 : 11} fill="black" color="black" />
      <span>GOAT</span>
    </span>
  );
}
