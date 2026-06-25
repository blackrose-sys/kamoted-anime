export interface AnimeServer {
  id: string;
  name: string;
  baseUrl: string;
  requiresAnilist: boolean;
  format: 'iframe' | 'hls';
  priority: number;
}

export const animeServers: AnimeServer[] = [
  {
    id: 'animeplay',
    name: 'Server 1 (AnimePlay)',
    baseUrl: 'https://animeplay.cfd/stream/mal',
    requiresAnilist: false,
    format: 'iframe',
    priority: 0
  },
  {
    id: 'megaplay-mal',
    name: 'Server 2 (MegaPlay)',
    baseUrl: 'https://megaplay.buzz/stream/mal',
    requiresAnilist: false,
    format: 'iframe',
    priority: 1
  },
  {
    id: 'megaplay-ani',
    name: 'Server 3 (AniList)',
    baseUrl: 'https://megaplay.buzz/stream/ani',
    requiresAnilist: true,
    format: 'iframe',
    priority: 2
  },
  {
    id: '2anime',
    name: 'Server 4 (2Anime)',
    baseUrl: 'https://2anime.xyz/embed',
    requiresAnilist: true,
    format: 'iframe',
    priority: 3
  },
];

export interface AniListMetadata {
  anilistId: string | null;
  episodes: number | null;
  status: string | null;
}

/**
 * Fetch metadata and real-time episode counts from AniList.
 */
export async function fetchAniListMetadata(malId: string): Promise<AniListMetadata> {
  const cacheKey = `anilist_metadata_${malId}`;
  
  // Check cache first
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }

  try {
    const query = `
      query ($malId: Int) {
        Media(idMal: $malId, type: ANIME) {
          id
          status
          episodes
          nextAiringEpisode {
            episode
          }
        }
      }
    `;
    
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { malId: parseInt(malId) } })
    });
    
    const data = await response.json();
    const media = data?.data?.Media;
    
    const anilistId = media?.id?.toString() || null;
    let episodes = media?.episodes || null;
    
    // For ongoing releasing shows, nextAiringEpisode.episode - 1 gives the exact current released episode
    if (media?.status === 'RELEASING' && media?.nextAiringEpisode?.episode) {
      episodes = media.nextAiringEpisode.episode - 1;
    }
    
    const metadata = {
      anilistId,
      episodes,
      status: media?.status || null
    };
    
    // Cache the result
    try { sessionStorage.setItem(cacheKey, JSON.stringify(metadata)); } catch { /* ignore */ }
    
    return metadata;
  } catch (error) {
    console.error('Failed to fetch AniList metadata:', error);
    return { anilistId: null, episodes: null, status: null };
  }
}

/**
 * Convert MAL ID to AniList ID using AniList GraphQL API (Legacy compatibility).
 */
export async function convertMalToAnilist(malId: string): Promise<string | null> {
  const metadata = await fetchAniListMetadata(malId);
  return metadata.anilistId;
}

export function getServerUrl(
  server: AnimeServer,
  malId: string,
  episode: number,
  type: 'sub' | 'dub',
  anilistId?: string
): string {
  // For servers that require AniList ID, fall back to MAL ID if not available
  const effectiveAnilistId = anilistId || malId;
  
  switch (server.id) {
    case 'animeplay':
      // https://animeplay.cfd/stream/mal/{malId}/{episode}/{sub|dub}
      return `${server.baseUrl}/${malId}/${episode}/${type}`;
    
    case 'megaplay-mal':
      // https://megaplay.buzz/stream/mal/{malId}/{episode}/{sub|dub}
      return `${server.baseUrl}/${malId}/${episode}/${type}`;
    
    case 'megaplay-ani':
      // https://megaplay.buzz/stream/ani/{anilistId}/{episode}/{sub|dub}
      return `${server.baseUrl}/${effectiveAnilistId}/${episode}/${type}`;
    
    case '2anime':
      // https://2anime.xyz/embed/{anilistId}/{episode}
      return `${server.baseUrl}/${effectiveAnilistId}/${episode}`;
    
    default:
      return `${server.baseUrl}/${malId}/${episode}/${type}`;
  }
}

export async function fetchEpisodesFromServer(
  id: string
): Promise<number | null> {
  try {
    const cacheBuster = Date.now();
    const apiUrl = `https://animeplay.cfd/api/anime/${id}?_=${cacheBuster}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data?.episodes) return data.episodes;
    if (data?.totalEpisodes) return data.totalEpisodes;
    if (data?.data?.episodes) return data.data.episodes;
    if (data?.data?.total_episodes) return data.data.total_episodes;
    if (Array.isArray(data?.episodes)) return data.episodes.length;
    if (Array.isArray(data?.data)) return data.data.length;
    
    return null;
  } catch (error) {
    console.error('Error fetching episodes from server API:', error);
    return null;
  }
}
