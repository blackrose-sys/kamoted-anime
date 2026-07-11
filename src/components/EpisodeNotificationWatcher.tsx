import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function EpisodeNotificationWatcher() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const checkEpisodeDrops = async () => {
      // 1. Throttle checks to once every 15 minutes per session to save API limits & database hits
      const lastCheck = localStorage.getItem(`last_episode_check_${user.id}`);
      const nowMs = Date.now();
      if (lastCheck && nowMs - parseInt(lastCheck) < 15 * 60 * 1000) {
        return;
      }

      try {
        // 2. Fetch user's watchlist items
        const { data: watchlist, error: wlError } = await supabase
          .from('watchlists')
          .select('anime_id')
          .eq('user_id', user.id);

        if (wlError) throw wlError;
        if (!watchlist || watchlist.length === 0) {
          localStorage.setItem(`last_episode_check_${user.id}`, nowMs.toString());
          return;
        }

        const watchlistMalIds = new Set(watchlist.map(item => item.anime_id));

        // 3. Fetch airing schedules from last 24 hours up to right now from AniList
        const query = `
          query ($airingAtGreater: Int, $airingAtLesser: Int) {
            Page(page: 1, perPage: 50) {
              airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
                id
                episode
                airingAt
                media {
                  id
                  idMal
                  title {
                    userPreferred
                    english
                  }
                  coverImage {
                    large
                  }
                }
              }
            }
          }
        `;

        const nowSec = Math.floor(nowMs / 1000);
        const yesterdaySec = nowSec - 24 * 60 * 60;

        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: {
              airingAtGreater: yesterdaySec,
              airingAtLesser: nowSec + 300 // include items airing right now
            }
          })
        });

        if (!response.ok) throw new Error('AniList fetch failed');

        const data = await response.json();
        const rawSchedules = data?.data?.Page?.airingSchedules || [];

        // 4. Match schedules against watchlist and create notifications
        for (const schedule of rawSchedules) {
          const malId = schedule.media?.idMal;
          if (!malId || !watchlistMalIds.has(malId)) continue;

          // Check if notification already exists for this anime episode drop
          const notificationLink = `/watch/${malId}?episode=${schedule.episode}`;
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'episode_drop')
            .eq('link', notificationLink)
            .maybeSingle();

          if (!existing) {
            // Trigger a new drop notification
            const animeTitle = schedule.media.title.english || schedule.media.title.userPreferred;
            await supabase.from('notifications').insert({
              user_id: user.id,
              from_user_id: null, // system/anime drop trigger
              from_username: animeTitle,
              from_avatar_url: schedule.media.coverImage?.large || null,
              type: 'episode_drop',
              message: `Episode ${schedule.episode} has dropped!`,
              link: notificationLink,
              is_read: false
            });
          }
        }

        // Save last check timestamp
        localStorage.setItem(`last_episode_check_${user.id}`, nowMs.toString());
      } catch (err) {
        console.error('Failed to run episode notification check:', err);
      }
    };

    // Run initial check on load
    checkEpisodeDrops();

    // Set recurring timer to check every 15 minutes while app stays open
    const interval = setInterval(checkEpisodeDrops, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return null;
}
