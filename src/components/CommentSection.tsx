import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Trash2, Loader2, LogIn, Clock, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Comment {
  id: string;
  user_id: string;
  anime_id: number;
  episode: number;
  username: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

interface CommentSectionProps {
  animeId: string;
  episode: number;
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

function getInitials(name: string): string {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');
}

// Deterministic color from username
function getAvatarColor(name: string): string {
  const colors = [
    ['#f59e0b', '#d97706'], // amber
    ['#8b5cf6', '#7c3aed'], // violet
    ['#ec4899', '#db2777'], // pink
    ['#06b6d4', '#0891b2'], // cyan
    ['#10b981', '#059669'], // emerald
    ['#f43f5e', '#e11d48'], // rose
    ['#6366f1', '#4f46e5'], // indigo
    ['#14b8a6', '#0d9488'], // teal
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colors.length;
  return `linear-gradient(135deg, ${colors[idx][0]}, ${colors[idx][1]})`;
}

export function CommentSection({ animeId, episode }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_LENGTH = 1000;
  const numericAnimeId = parseInt(animeId);

  // Fetch comments for this anime + episode
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('anime_id', numericAnimeId)
        .eq('episode', episode)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setComments(data as Comment[]);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [numericAnimeId, episode]);

  // Load comments when anime/episode changes
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${numericAnimeId}-${episode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `anime_id=eq.${numericAnimeId}`,
        },
        (payload) => {
          const newRow = payload.new as Comment;
          if (newRow.episode === episode) {
            setComments(prev => {
              // Avoid duplicates
              if (prev.some(c => c.id === newRow.id)) return prev;
              return [newRow, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setComments(prev => prev.filter(c => c.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [numericAnimeId, episode]);

  // Auto-resize textarea
  const handleTextareaChange = (value: string) => {
    if (value.length <= MAX_LENGTH) {
      setNewComment(value);
    }
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  };

  const handlePost = async () => {
    if (!user || !newComment.trim() || posting) return;

    setPosting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        user_id: user.id,
        anime_id: numericAnimeId,
        episode,
        username: user.username,
        avatar_url: user.avatar_url || null,
        content: newComment.trim(),
      });

      if (error) {
        console.error('Failed to post comment:', error);
        alert('Failed to post comment. Please try again.');
        return;
      }

      setNewComment('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to post:', err);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) {
        console.error('Delete failed:', error);
      } else {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  const charPercent = (newComment.length / MAX_LENGTH) * 100;

  return (
    <div style={{
      marginTop: '2rem',
      backgroundColor: 'var(--bg-color-secondary)',
      borderRadius: '1rem',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(139, 92, 246, 0.03) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '0.6rem',
            background: 'linear-gradient(135deg, var(--accent-primary), #d97706)',
          }}>
            <MessageSquare size={18} color="#000" />
          </div>
          <div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              lineHeight: 1.2,
            }}>
              Comments
            </h3>
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}>
              Episode {episode}
            </span>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '2rem',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
        }}>
          <MessageCircle size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
            {comments.length}
          </span>
        </div>
      </div>

      {/* Comment Input */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        {user ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            {/* User Avatar */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: getAvatarColor(user.username),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '0.85rem',
              color: '#fff',
              flexShrink: 0,
              border: '2px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials(user.username)
              )}
            </div>

            {/* Input Area */}
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => handleTextareaChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Share your thoughts on Episode ${episode}...`}
                rows={1}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  paddingRight: '3.5rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-color-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  outline: 'none',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  resize: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  minHeight: '44px',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-primary)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-color)';
                  e.target.style.boxShadow = 'none';
                }}
              />

              {/* Send Button (inside textarea area) */}
              <button
                onClick={handlePost}
                disabled={!newComment.trim() || posting}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  bottom: '0.5rem',
                  width: '34px',
                  height: '34px',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: newComment.trim()
                    ? 'linear-gradient(135deg, var(--accent-primary), #d97706)'
                    : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  cursor: newComment.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  transform: newComment.trim() ? 'scale(1)' : 'scale(0.9)',
                }}
              >
                {posting ? (
                  <Loader2 size={16} color="#000" className="animate-spin" />
                ) : (
                  <Send size={16} color={newComment.trim() ? '#000' : 'var(--text-secondary)'} />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Guest prompt */
          <Link
            to="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '1rem 1.5rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              border: '1px dashed rgba(245, 158, 11, 0.3)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'all 0.3s',
              cursor: 'pointer',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <LogIn size={18} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Sign in to join the conversation</span>
          </Link>
        )}

        {/* Character counter */}
        {user && newComment.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '0.5rem',
            paddingLeft: '52px',
          }}>
            <div style={{
              width: '50px',
              height: '3px',
              borderRadius: '2px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${charPercent}%`,
                height: '100%',
                borderRadius: '2px',
                background: charPercent > 90
                  ? '#ef4444'
                  : charPercent > 70
                    ? '#f59e0b'
                    : '#4ade80',
                transition: 'width 0.2s, background 0.2s',
              }} />
            </div>
            <span style={{
              fontSize: '0.7rem',
              color: charPercent > 90 ? '#ef4444' : 'var(--text-secondary)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {newComment.length}/{MAX_LENGTH}
            </span>
          </div>
        )}
      </div>

      {/* Comment List */}
      <div
        ref={listRef}
        style={{
          maxHeight: '500px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        }}
      >
        {loading ? (
          /* Skeleton loaders */
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                animationDelay: `${i * 150}ms`,
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-color-tertiary)',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    width: `${60 + i * 10}%`,
                    height: '12px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-color-tertiary)',
                    marginBottom: '0.5rem',
                  }} />
                  <div style={{
                    width: `${40 + i * 15}%`,
                    height: '10px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-color-tertiary)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem 1.5rem',
            gap: '1rem',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              border: '2px dashed rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MessageCircle size={28} color="rgba(245, 158, 11, 0.3)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                No comments yet
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Be the first to share your thoughts on this episode!
              </p>
            </div>
          </div>
        ) : (
          /* Comments */
          <div style={{ padding: '0.5rem 0' }}>
            {comments.map((comment, index) => (
              <div
                key={comment.id}
                className="comment-slide-in"
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '1rem 1.5rem',
                  borderBottom: index < comments.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  transition: 'background-color 0.2s',
                  animationDelay: `${index * 30}ms`,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Avatar */}
                <Link to={`/user/${comment.username}`} style={{ textDecoration: 'none' }} className="hover-scale">
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: getAvatarColor(comment.username),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.75rem',
                    color: '#fff',
                    flexShrink: 0,
                    border: '2px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}>
                    {comment.avatar_url ? (
                      <img src={comment.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getInitials(comment.username)
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <Link to={`/user/${comment.username}`} style={{
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      color: user && comment.user_id === user.id ? 'var(--accent-primary)' : 'white',
                      textDecoration: 'none',
                    }} className="hover-underline">
                      {comment.username}
                      {user && comment.user_id === user.id && (
                        <span style={{
                          marginLeft: '0.4rem',
                          fontSize: '0.6rem',
                          fontWeight: 900,
                          padding: '0.1rem 0.35rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--accent-primary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          verticalAlign: 'middle',
                        }}>
                          You
                        </span>
                      )}
                    </Link>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}>
                      <Clock size={10} />
                      {getRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255,255,255,0.85)',
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                  }}>
                    {comment.content}
                  </p>
                </div>

                {/* Delete (own comments only) */}
                {user && comment.user_id === user.id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: '0.2rem',
                      padding: '0.35rem',
                      borderRadius: '0.35rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: 0.3,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.opacity = '0.3';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="Delete comment"
                  >
                    {deletingId === comment.id ? (
                      <Loader2 size={14} color="var(--text-secondary)" className="animate-spin" />
                    ) : (
                      <Trash2 size={14} color="#ef4444" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
