/**
 * Song-related type definitions
 */

/**
 * Artist information
 */
export interface Artist {
  /** Artist ID */
  id: number;
  /** Artist name */
  name: string;
}

/**
 * Album information
 */
export interface Album {
  /** Album ID */
  id: number;
  /** Album name */
  name: string;
  /** Cover image URL */
  picUrl?: string;
}

/**
 * Song information from NetEase Cloud Music
 */
export interface Song {
  /** Song ID */
  id: number;
  /** Song name */
  name: string;
  /** Artist list */
  artists: Artist[];
  /** Album information */
  album: Album;
  /** Duration in milliseconds */
  duration: number;
  /** Available quality levels */
  availableQualities: string[];
  /** Whether the song is available (copyright/region) */
  available: boolean;
  /** Whether VIP is required to play */
  needVip: boolean;
}

/**
 * Download URL information from API
 */
export interface SongUrl {
  /** Song ID */
  id: number;
  /** Download URL */
  url: string | null;
  /** Bitrate */
  br: number;
  /** File size in bytes */
  size: number;
  /** File type (mp3, flac, etc.) */
  type: string;
  /** Quality level */
  level: string;
  /** Whether this is from an external source (unblock) */
  externalSource?: boolean;
}

/**
 * Parse artist list to string
 */
export function artistsToString(artists: Artist[]): string {
  return artists.map(a => a.name).join(', ');
}

/**
 * Get primary artist name
 */
export function getPrimaryArtist(artists: Artist[]): string {
  return artists[0]?.name ?? 'Unknown Artist';
}

/**
 * Create Song from API response
 */
export function createSongFromApi(data: {
  id: number;
  name: string;
  ar?: Array<{ id: number; name: string }>;
  artists?: Array<{ id: number; name: string }>;
  al?: { id: number; name: string; picUrl?: string };
  album?: { id: number; name: string; picUrl?: string };
  dt?: number;
  duration?: number;
  privilege?: {
    maxbr?: number;
    fee?: number;
    payed?: number;
    pl?: number;
    dl?: number;
    st?: number;
  };
  noCopyrightRcmd?: unknown;
}): Song {
  const artists = (data.ar ?? data.artists ?? []).map(a => ({
    id: a.id,
    name: a.name
  }));

  const album = data.al ?? data.album ?? { id: 0, name: '' };

  // Determine available qualities based on privilege
  const availableQualities: string[] = [];
  const privilege = data.privilege;
  
  if (privilege) {
    const maxbr = privilege.maxbr ?? 0;
    if (maxbr >= 999000) availableQualities.push('lossless');
    if (maxbr >= 320000) availableQualities.push('exhigh');
    if (maxbr >= 192000) availableQualities.push('higher');
    if (maxbr >= 128000) availableQualities.push('standard');
  } else {
    // Default to standard if no privilege info
    availableQualities.push('standard');
  }

  // Check availability
  const available = !data.noCopyrightRcmd && 
    (privilege?.st === 0 || privilege?.st === undefined) &&
    (privilege?.pl !== 0 || privilege?.pl === undefined);

  // Check if VIP is needed
  const needVip = privilege?.fee === 1 && privilege?.payed !== 1;

  return {
    id: data.id,
    name: data.name,
    artists,
    album: {
      id: album.id,
      name: album.name,
      picUrl: album.picUrl
    },
    duration: data.dt ?? data.duration ?? 0,
    availableQualities,
    available,
    needVip
  };
}
