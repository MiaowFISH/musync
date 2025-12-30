/**
 * Playlist type definitions
 */

import type { Song } from './song';

/**
 * User information
 */
export interface User {
  /** NetEase user ID */
  id: number;
  /** User nickname */
  nickname: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** VIP type: 0=non-VIP, 11=黑胶VIP */
  vipType: number;
}

/**
 * Playlist information
 */
export interface Playlist {
  /** Playlist ID */
  id: number;
  /** Playlist name */
  name: string;
  /** Creator user ID */
  userId: number;
  /** Creator nickname */
  creator: string;
  /** Number of tracks */
  trackCount: number;
  /** Cover image URL */
  coverUrl?: string;
  /** Description */
  description?: string;
  /** Track IDs (complete list) */
  trackIds: number[];
  /** Track details (may be incomplete, need to fetch via song/detail) */
  tracks?: Song[];
}

/**
 * Create User from API response
 */
export function createUserFromApi(data: {
  userId?: number;
  id?: number;
  nickname?: string;
  avatarUrl?: string;
  vipType?: number;
}): User {
  return {
    id: data.userId ?? data.id ?? 0,
    nickname: data.nickname ?? '',
    avatarUrl: data.avatarUrl,
    vipType: data.vipType ?? 0
  };
}

/**
 * Create Playlist from API response
 */
export function createPlaylistFromApi(data: {
  id: number;
  name: string;
  userId?: number;
  creator?: { userId?: number; nickname?: string };
  trackCount?: number;
  coverImgUrl?: string;
  description?: string | null;
  trackIds?: Array<{ id: number }>;
  tracks?: unknown[];
}): Playlist {
  return {
    id: data.id,
    name: data.name,
    userId: data.userId ?? data.creator?.userId ?? 0,
    creator: data.creator?.nickname ?? '',
    trackCount: data.trackCount ?? 0,
    coverUrl: data.coverImgUrl,
    description: data.description ?? undefined,
    trackIds: (data.trackIds ?? []).map(t => t.id),
    tracks: undefined // Tracks need to be fetched separately
  };
}

/**
 * Playlist summary for list display
 */
export interface PlaylistSummary {
  id: number;
  name: string;
  trackCount: number;
  creator: string;
}

/**
 * Convert Playlist to PlaylistSummary
 */
export function toPlaylistSummary(playlist: Playlist): PlaylistSummary {
  return {
    id: playlist.id,
    name: playlist.name,
    trackCount: playlist.trackCount,
    creator: playlist.creator
  };
}
