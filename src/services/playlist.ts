/**
 * Playlist service
 * Handles playlist and track data fetching
 */

import {
  getUserPlaylists,
  getPlaylistDetail,
  getPlaylistTracks,
  getSongDetails
} from './api';
import { requireAuth } from './auth';
import type { Playlist, PlaylistSummary } from '../models/playlist';
import type { Song } from '../models/song';
import { createPlaylistFromApi } from '../models/playlist';
import { createSongFromApi } from '../models/song';
import { logger } from '../utils/logger';

/**
 * Fetch all user playlists
 */
export async function fetchUserPlaylists(): Promise<{
  success: boolean;
  playlists?: PlaylistSummary[];
  error?: string;
}> {
  try {
    const { userId, cookie } = await requireAuth();
    
    logger.debug(`Fetching playlists for user ${userId}`);
    
    const result = await getUserPlaylists(userId, cookie, { limit: 1000 });
    
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || '获取歌单失败'
      };
    }
    
    const playlists: PlaylistSummary[] = result.data.playlists.map((p: unknown) => {
      const data = p as Record<string, unknown>;
      return {
        id: data.id as number,
        name: data.name as string,
        trackCount: data.trackCount as number,
        creator: (data.creator as Record<string, unknown>)?.nickname as string || ''
      };
    });
    
    return {
      success: true,
      playlists
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌单失败'
    };
  }
}

/**
 * Fetch playlist by ID
 */
export async function fetchPlaylist(id: number): Promise<{
  success: boolean;
  playlist?: Playlist;
  error?: string;
}> {
  try {
    const { cookie } = await requireAuth();
    
    logger.debug(`Fetching playlist ${id}`);
    
    const result = await getPlaylistDetail(id, cookie);
    
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || '获取歌单详情失败'
      };
    }
    
    const data = result.data.playlist as Record<string, unknown>;
    const playlist = createPlaylistFromApi(data as {
      id: number;
      name: string;
      userId?: number;
      creator?: { userId?: number; nickname?: string };
      trackCount?: number;
      coverImgUrl?: string;
      description?: string | null;
      trackIds?: Array<{ id: number }>;
      tracks?: unknown[];
    });
    
    return {
      success: true,
      playlist
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌单详情失败'
    };
  }
}

/**
 * Fetch playlist by name (searches user's playlists)
 */
export async function fetchPlaylistByName(name: string): Promise<{
  success: boolean;
  playlist?: Playlist;
  error?: string;
}> {
  const listResult = await fetchUserPlaylists();
  
  if (!listResult.success || !listResult.playlists) {
    return {
      success: false,
      error: listResult.error || '获取歌单列表失败'
    };
  }
  
  // Find playlist by name (exact or partial match)
  const found = listResult.playlists.find(
    p => p.name === name || p.name.includes(name)
  );
  
  if (!found) {
    return {
      success: false,
      error: `未找到歌单: ${name}`
    };
  }
  
  return fetchPlaylist(found.id);
}

/**
 * Fetch all tracks in a playlist
 */
export async function fetchPlaylistSongs(
  playlistId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<{
  success: boolean;
  songs?: Song[];
  error?: string;
}> {
  try {
    const { cookie } = await requireAuth();
    
    logger.debug(`Fetching tracks for playlist ${playlistId}`);
    
    const result = await getPlaylistTracks(playlistId, cookie, options);
    
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || '获取歌曲列表失败'
      };
    }
    
    // Merge privilege info with songs
    const privilegeMap = new Map<number, unknown>();
    if (result.data.privileges) {
      for (const p of result.data.privileges as Array<{ id: number }>) {
        privilegeMap.set(p.id, p);
      }
    }
    
    const songs: Song[] = result.data.songs.map((s: unknown) => {
      const songData = s as Record<string, unknown>;
      const privilege = privilegeMap.get(songData.id as number);
      return createSongFromApi({
        ...songData,
        privilege
      } as Parameters<typeof createSongFromApi>[0]);
    });
    
    return {
      success: true,
      songs
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌曲列表失败'
    };
  }
}

/**
 * Fetch song details by IDs
 */
export async function fetchSongDetails(
  songIds: number[]
): Promise<{
  success: boolean;
  songs?: Song[];
  error?: string;
}> {
  try {
    const { cookie } = await requireAuth();
    
    logger.debug(`Fetching details for ${songIds.length} songs`);
    
    // API has a limit, batch by 500
    const batchSize = 500;
    const allSongs: Song[] = [];
    
    for (let i = 0; i < songIds.length; i += batchSize) {
      const batch = songIds.slice(i, i + batchSize);
      const result = await getSongDetails(batch, cookie);
      
      if (!result.success || !result.data) {
        logger.debug(`Batch ${i / batchSize + 1} failed: ${result.error}`);
        continue;
      }
      
      // Merge privilege info
      const privilegeMap = new Map<number, unknown>();
      if (result.data.privileges) {
        for (const p of result.data.privileges as Array<{ id: number }>) {
          privilegeMap.set(p.id, p);
        }
      }
      
      const songs: Song[] = result.data.songs.map((s: unknown) => {
        const songData = s as Record<string, unknown>;
        const privilege = privilegeMap.get(songData.id as number);
        return createSongFromApi({
          ...songData,
          privilege
        } as Parameters<typeof createSongFromApi>[0]);
      });
      
      allSongs.push(...songs);
    }
    
    return {
      success: true,
      songs: allSongs
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌曲详情失败'
    };
  }
}

/**
 * Get playlist with all track details
 */
export async function getPlaylistWithTracks(
  playlistIdOrName: string | number
): Promise<{
  success: boolean;
  playlist?: Playlist;
  songs?: Song[];
  error?: string;
}> {
  // Fetch playlist
  let playlistResult;
  
  if (typeof playlistIdOrName === 'number' || /^\d+$/.test(playlistIdOrName)) {
    const id = typeof playlistIdOrName === 'number' ? playlistIdOrName : parseInt(playlistIdOrName, 10);
    playlistResult = await fetchPlaylist(id);
  } else {
    playlistResult = await fetchPlaylistByName(playlistIdOrName);
  }
  
  if (!playlistResult.success || !playlistResult.playlist) {
    return {
      success: false,
      error: playlistResult.error
    };
  }
  
  // Fetch all tracks
  const songsResult = await fetchPlaylistSongs(playlistResult.playlist.id);
  
  if (!songsResult.success) {
    return {
      success: false,
      error: songsResult.error
    };
  }
  
  return {
    success: true,
    playlist: playlistResult.playlist,
    songs: songsResult.songs
  };
}
