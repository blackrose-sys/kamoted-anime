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
    id: 'megaplay-mal',
    name: 'Server 2 (MegaPlay MAL)',
    baseUrl: 'https://megaplay.buzz/stream/mal',
    requiresAnilist: false,
    format: 'iframe',
    priority: 2
  },
  {
    id: 'megaplay-ani',
    name: 'Server 3 (MegaPlay AniList)',
    baseUrl: 'https://megaplay.buzz/stream/ani',
    requiresAnilist: true,
    format: 'iframe',
    priority: 3
  },
  {
    id: 'ezvid',
    name: 'Server 4 (EzVid)',
    baseUrl: 'https://ezvidapi.com/embed/tv',
    requiresAnilist: false,
    format: 'iframe',
    priority: 4
  },
  {
    id: 'spenembed',
    name: 'Server 5 (SpenEmbed)',
    baseUrl: 'https://spencerdevs.xyz/anime',
    requiresAnilist: true,
    format: 'iframe',
    priority: 5
  },
  {
    id: 'cinetaro',
    name: 'Server 6 (Cinetaro)',
    baseUrl: 'https://cinextream.net/api/anime/embed/lang',
    requiresAnilist: true,
    format: 'iframe',
    priority: 6
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
    
    case 'megaplay-mal':
      // MegaPlay MAL ID format
      return `${server.baseUrl}/${id}/${episode}/${type}`;
    
    case 'megaplay-ani':
      // MegaPlay AniList ID format
      return `${server.baseUrl}/${effectiveId}/${episode}/${type}`;
    
    case 'ezvid':
      // EzVid TV format (anime treated as TV)
      return `${server.baseUrl}/${effectiveId}/1/${episode}`;
    
    case 'spenembed':
      // SpenEmbed AniList format
      return `${server.baseUrl}/${effectiveId}/${episode}`;
    
    case 'cinetaro':
      // Cinetaro AniList format
      return `${server.baseUrl}/${effectiveId}/${episode}`;
    
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
