import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ChevronRight, X } from 'lucide-react';

const GENRES = [
  { id: 'action', label: 'Action', emoji: '⚔️' },
  { id: 'romance', label: 'Romance', emoji: '💕' },
  { id: 'comedy', label: 'Comedy', emoji: '😂' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙' },
  { id: 'horror', label: 'Horror', emoji: '👻' },
  { id: 'mystery', label: 'Mystery', emoji: '🔍' },
  { id: 'sci-fi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'isekai', label: 'Isekai', emoji: '🌀' },
  { id: 'slice-of-life', label: 'Slice of Life', emoji: '🌸' },
  { id: 'psychological', label: 'Psychological', emoji: '🧠' },
  { id: 'mecha', label: 'Mecha', emoji: '🤖' },
];

const MOODS = [
  { id: 'hype', label: 'Hype & Exciting', emoji: '🔥' },
  { id: 'chill', label: 'Chill & Relaxing', emoji: '😌' },
  { id: 'emotional', label: 'Emotional & Deep', emoji: '🥺' },
  { id: 'fun', label: 'Fun & Lighthearted', emoji: '🎉' },
  { id: 'dark', label: 'Dark & Intense', emoji: '🌑' },
];

const EXPERIENCES = [
  { id: 'newcomer', label: "I'm new to anime", emoji: '🌱' },
  { id: 'casual', label: 'I watch occasionally', emoji: '📺' },
  { id: 'veteran', label: 'I watch all the time', emoji: '⚡' },
];

interface Props {
  onClose: () => void;
  onComplete: (prefs: { genres: string[]; mood: string; experience: string }) => void;
}

export function QuizModal({ onClose, onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0); // 0=genres, 1=mood, 2=experience, 3=done
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedExp, setSelectedExp] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleGenre = (id: string) => {
    setSelectedGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleFinish = async () => {
    if (!user) { onClose(); return; }
    setSaving(true);
    const prefs = { genres: selectedGenres, mood: selectedMood, experience: selectedExp };
    try {
      await supabase.from('profiles').update({ genre_prefs: prefs }).eq('id', user.id);
    } catch { /* fail silently */ }
    setSaving(false);
    onComplete(prefs);
  };

  const canNext = step === 0 ? selectedGenres.length >= 1 : step === 1 ? !!selectedMood : step === 2 ? !!selectedExp : true;

  const steps = ['Genres', 'Mood', 'Experience'];
  const progress = ((step) / 3) * 100;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: '560px',
          backgroundColor: 'rgba(10,10,18,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '1.5rem',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.75rem 1rem',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(139,92,246,0.07))',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Sparkles size={20} color="var(--accent-primary)" />
              <span style={{ fontWeight: 900, fontSize: '1rem' }}>Personalize Your Feed</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', padding: '0.25rem', borderRadius: '0.4rem', transition: 'color 0.15s' }}
              onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.color = 'white'}
              onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              {steps.map((s, i) => (
                <span key={s} style={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: i <= step ? 'var(--accent-primary)' : 'rgba(255,255,255,0.25)' }}>
                  {s}
                </span>
              ))}
            </div>
            <div style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent-primary), #8b5cf6)', borderRadius: '9999px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem' }}>
          {/* Step 0 — Genres */}
          {step === 0 && (
            <div>
              <h2 style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.4rem' }}>What genres do you love?</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Pick up to 5 — we'll tailor your recommendations.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {GENRES.map(g => {
                  const selected = selectedGenres.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.45rem',
                        padding: '0.5rem 0.95rem', borderRadius: '9999px',
                        border: `1px solid ${selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`,
                        background: selected ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
                        color: selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                        transition: 'all 0.15s',
                        boxShadow: selected ? '0 0 10px rgba(245,158,11,0.15)' : 'none',
                        transform: selected ? 'scale(1.04)' : 'scale(1)'
                      }}
                    >
                      <span>{g.emoji}</span> {g.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.75rem' }}>{selectedGenres.length}/5 selected</p>
            </div>
          )}

          {/* Step 1 — Mood */}
          {step === 1 && (
            <div>
              <h2 style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.4rem' }}>What's your usual mood?</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>We'll match you with shows that fit your vibe.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {MOODS.map(m => {
                  const selected = selectedMood === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMood(m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                        padding: '0.85rem 1.1rem', borderRadius: '0.85rem',
                        border: `1px solid ${selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)'}`,
                        background: selected ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s',
                        boxShadow: selected ? '0 0 14px rgba(245,158,11,0.12)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{m.emoji}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.8)' }}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2 — Experience */}
          {step === 2 && (
            <div>
              <h2 style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.4rem' }}>How much anime have you watched?</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>This helps us calibrate popular vs. hidden gems.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {EXPERIENCES.map(ex => {
                  const selected = selectedExp === ex.id;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => setSelectedExp(ex.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                        padding: '0.85rem 1.1rem', borderRadius: '0.85rem',
                        border: `1px solid ${selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)'}`,
                        background: selected ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{ex.emoji}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.8)' }}>{ex.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h2 style={{ fontWeight: 900, fontSize: '1.3rem', marginBottom: '0.5rem' }}>You're all set!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                Your preferences have been saved. We'll use them to show you personalized recommendations across the site.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.75rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', fontWeight: 700, transition: 'color 0.15s' }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.color = 'white'}
            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'}
          >
            Skip for now
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.5rem', borderRadius: '9999px',
                background: canNext ? 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)' : 'rgba(255,255,255,0.07)',
                border: 'none', color: canNext ? 'black' : 'rgba(255,255,255,0.25)',
                cursor: canNext ? 'pointer' : 'not-allowed',
                fontWeight: 900, fontSize: '0.85rem', transition: 'all 0.2s',
                boxShadow: canNext ? '0 4px 16px rgba(245,158,11,0.3)' : 'none'
              }}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.5rem', borderRadius: '9999px',
                background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                border: 'none', color: 'black',
                cursor: 'pointer', fontWeight: 900, fontSize: '0.85rem',
                boxShadow: '0 4px 16px rgba(245,158,11,0.3)'
              }}
            >
              {saving ? 'Saving...' : '🚀 Get My Recommendations'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
