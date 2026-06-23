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
    priority: 1
  },
  {
    id: 'vidnest',
    name: 'Server 2 (VidNest)',
    baseUrl: 'https://vidnest.fun/anime',
    requiresAnilist: true,
    format: 'iframe',
    priority: 2
  },
  {
    id: 'vidnest-animepahe',
    name: 'Server 3 (VidNest AnimePahe)',
    baseUrl: 'https://vidnest.fun/animepahe',
    requiresAnilist: true,
    format: 'iframe',
    priority: 3
  },
  {
    id: 'autoembed',
    name: 'Server 4 (AutoEmbed)',
    baseUrl: 'https://anime.autoembed.cc/embed',
    requiresAnilist: false,
    format: 'iframe',
    priority: 4
  },
  {
    id: 'ezvid',
    name: 'Server 5 (EzVid)',
    baseUrl: 'https://ezvidapi.com/embed/tv',
    requiresAnilist: false,
    format: 'iframe',
    priority: 5
  },
  {
    id: 'vidsrc',
    name: 'Server 6 (VidSrc)',
    baseUrl: 'https://vidsrc.xyz/embed',
    requiresAnilist: false,
    format: 'iframe',
    priority: 6
  },
  {
    id: '2embed',
    name: 'Server 7 (2Embed)',
    baseUrl: 'https://www.2embed.cc/embed',
    requiresAnilist: false,
    format: 'iframe',
    priority: 7
  }
];

export function getServerUrl(
  server: AnimeServer,
  id: string,
  episode: number,
  type: 'sub' | 'dub',
  anilistId?: string
): string {
  const effectiveId = anilistId || id;
  
  switch (server.id) {
    case 'animeplay':
      return `${server.baseUrl}/${id}/${episode}/${type}`;
    
    case 'vidnest':
      // VidNest uses AniList ID
      return `${server.baseUrl}/${effectiveId}/${episode}/${type}`;
    
    case 'vidnest-animepahe':
      // VidNest AnimePahe uses AniList ID
      return `${server.baseUrl}/${effectiveId}/${episode}/${type}`;
    
    case 'autoembed':
      // AutoEmbed uses anime title (we'll use ID as fallback)
      return `${server.baseUrl}/${id}-episode-${episode}`;
    
    case 'ezvid':
      // EzVid uses TMDB ID format (we'll use ID as fallback)
      return `${server.baseUrl}/${effectiveId}/1/${episode}`;
    
    case 'vidsrc':
      // VidSrc uses TMDB ID format (we'll use ID as fallback)
      return `${server.baseUrl}/${effectiveId}/${episode}`;
    
    case '2embed':
      // 2Embed uses TMDB ID format (we'll use ID as fallback)
      return `${server.baseUrl}/${effectiveId}&s=1&e=${episode}`;
    
    default:
      return `${server.baseUrl}/${id}/${episode}/${type}`;
  }
}

export async function convertMalToAnilist(malId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
    const data = await response.json();
    return data.data?.images?.jpg?.large_image_url ? malId : null;
  } catch {
    return null;
  }
}
