import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AnimeCard } from '../components/AnimeCard';
import { UserBadge } from '../components/UserBadge';
import { Loader2, Bookmark, Calendar, Lock, Globe, ChevronLeft, ChevronRight, UserPlus, UserCheck, Flame } from 'lucide-react';

interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  watchlist_privacy: 'public' | 'private';
  created_at: string;
}

function getInitials(name: string): string {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');
}

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

export function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWatchlistCategory, setSelectedWatchlistCategory] = useState<string>('all');
  const [stats, setStats] = useState({
    level: 1,
    xp: 0,
    nextLevelXp: 100,
    episodesCount: 0,
    commentsCount: 0,
    showsCount: 0,
    completedCount: 0,
    badges: [] as { id: string; name: string; description: string; icon: string; unlocked: boolean }[]
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [streakCount, setStreakCount] = useState(0);

  const [showFollowModal, setShowFollowModal] = useState<false | 'followers' | 'following'>(false);
  const [followList, setFollowList] = useState<{ username: string; avatar_url: string | null }[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const openFollowModal = async (type: 'followers' | 'following') => {
    if (!profile) return;
    setShowFollowModal(type);
    setFollowListLoading(true);
    setFollowList([]);

    try {
      if (type === 'followers') {
        const { data: followRows } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', profile.id);

        const ids = followRows?.map(r => r.follower_id) || [];
        if (ids.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .in('id', ids);
          setFollowList(profileRows || []);
        }
      } else {
        const { data: followRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', profile.id);

        const ids = followRows?.map(r => r.following_id) || [];
        if (ids.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .in('id', ids);
          setFollowList(profileRows || []);
        }
      }
    } catch (err) {
      console.error('Failed to load follow list details:', err);
    } finally {
      setFollowListLoading(false);
    }
  };

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  useEffect(() => {
    const fetchProfileAndWatchlist = async () => {
      if (!username) return;
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch user profile by username
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          setError('User not found.');
          setLoading(false);
          return;
        }

        setProfile(profileData as ProfileData);

        // 1.5 Fetch gamification stats
        setStatsLoading(true);
        try {
          const { data: historyData } = await supabase
            .from('watch_history')
            .select('last_episode')
            .eq('user_id', profileData.id);
            
          const showsCount = historyData?.length || 0;
          const episodesCount = historyData?.reduce((sum, item) => sum + (item.last_episode || 0), 0) || 0;

          const { count: commentsCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profileData.id);

          const { count: completedCount } = await supabase
            .from('watchlists')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profileData.id)
            .eq('status', 'completed');

          const totalXp = (episodesCount * 10) + ((commentsCount || 0) * 15);
          const level = Math.floor(totalXp / 100) + 1;
          const xpInCurrentLevel = totalXp % 100;

          setStats({
            level,
            xp: xpInCurrentLevel,
            nextLevelXp: 100,
            episodesCount,
            commentsCount: commentsCount || 0,
            showsCount,
            completedCount: completedCount || 0,
            badges: [
              { id: 'rookie', name: 'Rookie Watcher', description: 'Joined the platform', icon: '🏅', unlocked: true },
              { id: 'otaku', name: 'Otaku Master', description: 'Watched 10+ shows', icon: '🥋', unlocked: showsCount >= 10 },
              { id: 'legend', name: 'Anime Legend', description: 'Watched 50+ shows', icon: '🌌', unlocked: showsCount >= 50 },
              { id: 'chatterbox', name: 'Chatterbox', description: 'Left 5+ comments', icon: '💬', unlocked: (commentsCount || 0) >= 5 },
              { id: 'completionist', name: 'Completionist', description: 'Completed 5+ shows', icon: '📚', unlocked: (completedCount || 0) >= 5 }
            ]
          });
        } catch (err) {
          console.error('Failed to load user profile stats:', err);
        } finally {
          setStatsLoading(false);
        }

        // Fetch follow and streak info
        try {
          setStreakCount(profileData.streak_count || 0);

          const { count: followers } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', profileData.id);
          setFollowerCount(followers || 0);

          const { count: following } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', profileData.id);
          setFollowingCount(following || 0);

          if (currentUser && currentUser.id !== profileData.id) {
            const { data: followRecord } = await supabase
              .from('follows')
              .select('*')
              .eq('follower_id', currentUser.id)
              .eq('following_id', profileData.id)
              .maybeSingle();
            setIsFollowing(!!followRecord);
          }
        } catch (err) {
          console.error('Failed to load follow / streak details:', err);
        }

        // 2. Determine if we can read their watchlist
        const canReadWatchlist = 
          profileData.watchlist_privacy === 'public' || 
          (currentUser && currentUser.id === profileData.id);

        if (canReadWatchlist) {
          setWatchlistLoading(true);
          const { data: watchlistData, error: watchlistError } = await supabase
            .from('watchlists')
            .select('*')
            .eq('user_id', profileData.id)
            .order('created_at', { ascending: false });

          if (watchlistError) throw watchlistError;
          setWatchlist(watchlistData || []);
          setWatchlistLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        setError(err.message || 'Failed to load user profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndWatchlist();
  }, [username, currentUser]);

  const handleToggleFollow = async () => {
    if (!currentUser) return alert('Please login to follow users!');
    if (!profile || followLoading) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: profile.id
          });
        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to toggle follow status:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>Oops!</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'User not found'}</p>
        </div>
        <button onClick={() => navigate(-1)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
          <ChevronLeft size={16} /> Go Back
        </button>
      </main>
    );
  }

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const displayWatchlist = profile.watchlist_privacy === 'public' || isOwnProfile;

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Header Back Link */}
      <div style={{ width: '100%', maxWidth: '800px', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            padding: 0
          }}
          className="hover-scale"
        >
          <ChevronLeft size={16} /> BACK
        </button>
      </div>

      {/* Profile Info Glass Card */}
      <div className="glass" style={{ width: '100%', maxWidth: '800px', padding: '3rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            background: getAvatarColor(profile.username), 
            padding: '4px', 
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--bg-color-tertiary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--text-secondary)' }}>{getInitials(profile.username)}</span>
              )}
            </div>
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>{profile.username}</h1>
              <UserBadge username={profile.username} size="lg" />
              {isOwnProfile && (
                <Link 
                  to="/profile" 
                  style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 900, 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '0.5rem', 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    textTransform: 'uppercase'
                  }}
                  className="hover-scale"
                >
                  Edit Profile
                </Link>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} />
                <span>Joined {joinDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {profile.watchlist_privacy === 'public' ? (
                  <>
                    <Globe size={16} color="#4ade80" />
                    <span>Watchlist is Public</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} color="#fca5a5" />
                    <span>Watchlist is Private</span>
                  </>
                )
                }
              </div>
            </div>

            {/* Streak & Follows details */}
            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              {streakCount > 0 && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.5rem',
                  color: '#f87171',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}>
                  <Flame size={14} fill="#ef4444" />
                  <span>{streakCount} DAY WATCH STREAK</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem' }}>
                <button 
                  onClick={() => openFollowModal('followers')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', gap: '0.25rem', fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit' }}
                  className="hover-underline hover-scale"
                >
                  <span style={{ color: 'white', fontWeight: 800 }}>{followerCount}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>followers</span>
                </button>
                <button 
                  onClick={() => openFollowModal('following')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', gap: '0.25rem', fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit' }}
                  className="hover-underline hover-scale"
                >
                  <span style={{ color: 'white', fontWeight: 800 }}>{followingCount}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>following</span>
                </button>
              </div>
            </div>

            {/* Follow Action Button */}
            {!isOwnProfile && currentUser && (
              <button
                onClick={handleToggleFollow}
                disabled={followLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 1.25rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isFollowing ? 'transparent' : 'var(--accent-primary)',
                  color: isFollowing ? 'white' : 'black',
                  border: isFollowing ? '1px solid var(--border-color)' : 'none',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginTop: '0.75rem'
                }}
                className="hover-scale"
              >
                {followLoading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : isFollowing ? (
                  <>
                    <UserCheck size={14} />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    Follow
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Gamification Dashboard */}
        {!statsLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '2rem',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginTop: '2.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Watcher Level
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--accent-primary)', textShadow: '0 0 15px rgba(245,158,11,0.2)' }}>Lvl {stats.level}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {stats.episodesCount} episodes watched
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <span>XP PROGRESS</span>
                <span>{stats.xp} / {stats.nextLevelXp} XP</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-color-tertiary)', borderRadius: '9999px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{ width: `${(stats.xp / stats.nextLevelXp) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), #8b5cf6)', borderRadius: '9999px', boxShadow: '0 0 10px rgba(245,158,11,0.5)' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {100 - stats.xp} XP to next level
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />

            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Unlocked Achievements
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {stats.badges.map(badge => (
                  <div 
                    key={badge.id} 
                    title={badge.description}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: badge.unlocked ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${badge.unlocked ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      opacity: badge.unlocked ? 1 : 0.4,
                      transition: 'all 0.2s',
                      boxShadow: badge.unlocked ? '0 0 15px rgba(245,158,11,0.15)' : 'none',
                      cursor: 'help'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{badge.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: badge.unlocked ? 'white' : 'var(--text-secondary)' }}>{badge.name}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{badge.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Watchlist Section */}
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bookmark size={20} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', margin: 0 }}>Anime Playlist</h2>
        </div>

        {watchlistLoading ? (
          <div className="grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse" style={{ aspectRatio: '2/3', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '1rem' }} />
            ))}
          </div>
        ) : displayWatchlist ? (() => {
          const filtered = watchlist.filter(item => {
            const status = item.status || 'watching';
            if (selectedWatchlistCategory === 'all') return true;
            return status === selectedWatchlistCategory;
          });
          return (
            <div>
              {/* Category tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'watching', label: 'Watching' },
                  { value: 'plan_to_watch', label: 'Plan to Watch' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'on_hold', label: 'On Hold' },
                  { value: 'dropped', label: 'Dropped' }
                ].map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setSelectedWatchlistCategory(cat.value)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '0.5rem',
                      backgroundColor: selectedWatchlistCategory === cat.value ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                      color: selectedWatchlistCategory === cat.value ? 'black' : 'white',
                      border: '1px solid var(--border-color)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {cat.label} ({
                      cat.value === 'all' 
                        ? watchlist.length 
                        : watchlist.filter(item => (item.status || 'watching') === cat.value).length
                    })
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="glass" style={{ padding: '4rem 2rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Bookmark size={40} style={{ color: 'var(--border-color)', marginBottom: '1rem' }} />
                  <div>No anime found in this folder.</div>
                </div>
              ) : (
                <div className="grid">
                  {filtered.map(item => (
                    <AnimeCard 
                      key={item.id} 
                      anime={{
                        mal_id: item.anime_id,
                        title: item.title,
                        images: {
                          webp: {
                            image_url: item.image_url,
                            large_image_url: item.image_url
                          }
                        },
                        episodes: null,
                        score: null,
                        year: null,
                        season: null
                      }} 
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })() : (
          /* Private Watchlist Glass Screen */
          <div className="glass" style={{ padding: '5rem 2rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '2px dashed rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Lock size={28} color="#ef4444" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.25rem' }}>Playlist is Private</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: 0 }}>
                This user has set their anime playlist to private. Only they can view their bookmark list.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Followers / Following Modal */}
      {showFollowModal && (
        <div
          onClick={() => setShowFollowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass"
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '70vh',
              borderRadius: '1.25rem',
              border: '1px solid var(--border-color)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideUp 0.25s ease'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, textTransform: 'capitalize' }}>
                {showFollowModal === 'followers' ? `Followers (${followerCount})` : `Following (${followingCount})`}
              </h3>
              <button
                onClick={() => setShowFollowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  lineHeight: 1,
                  padding: '0.25rem',
                  fontWeight: 700
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.5rem 0'
            }}>
              {followListLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                  <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
                </div>
              ) : followList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                    {showFollowModal === 'followers' ? '👥' : '🔍'}
                  </div>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {showFollowModal === 'followers'
                      ? 'No followers yet'
                      : 'Not following anyone yet'}
                  </p>
                </div>
              ) : (
                followList.map((person) => (
                  <Link
                    key={person.username}
                    to={`/user/${person.username}`}
                    onClick={() => setShowFollowModal(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1.5rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background-color 0.15s',
                    }}
                    className="hover-bg"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: getAvatarColor(person.username),
                      padding: '2px',
                      flexShrink: 0
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-color-tertiary)',
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt={person.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                            {getInitials(person.username)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Username + Badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {person.username}
                        </span>
                        <UserBadge username={person.username} size="sm" />
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
