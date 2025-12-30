/**
 * Playlist command
 * View user playlists and playlist details
 */

import { Command } from 'commander';
import { fetchUserPlaylists, getPlaylistWithTracks } from '../services/playlist';
import { checkAuth } from '../services/auth';
import { logger } from '../utils/logger';
import {
  formatJsonSuccess,
  formatJsonError,
  formatDuration,
  formatArtists,
  truncate,
  tableRow,
  tableSeparator
} from '../utils/format';

/**
 * Display playlist list
 */
function displayPlaylistList(
  playlists: Array<{ id: number; name: string; trackCount: number; creator: string }>,
  json: boolean
): void {
  if (json) {
    console.log(formatJsonSuccess({ playlists }));
    return;
  }
  
  logger.group('您的歌单');
  
  // Column widths
  const idWidth = 12;
  const nameWidth = 30;
  const countWidth = 8;
  
  // Header
  console.log(tableRow(['ID', '名称', '歌曲数'], [idWidth, nameWidth, countWidth]));
  console.log(tableSeparator([idWidth, nameWidth, countWidth]));
  
  // Rows
  for (const playlist of playlists) {
    console.log(tableRow(
      [
        playlist.id.toString(),
        truncate(playlist.name, nameWidth),
        playlist.trackCount.toString()
      ],
      [idWidth, nameWidth, countWidth]
    ));
  }
  
  logger.newLine();
  logger.info(`共 ${playlists.length} 个歌单`);
}

/**
 * Display playlist details
 */
function displayPlaylistDetail(
  playlist: { id: number; name: string; trackCount: number; description?: string },
  songs: Array<{
    id: number;
    name: string;
    artists: Array<{ name: string }>;
    album: { name: string };
    duration: number;
    available: boolean;
  }>,
  json: boolean
): void {
  if (json) {
    console.log(formatJsonSuccess({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        trackCount: playlist.trackCount,
        description: playlist.description
      },
      tracks: songs.map((s, i) => ({
        index: i + 1,
        id: s.id,
        name: s.name,
        artist: formatArtists(s.artists),
        album: s.album.name,
        duration: s.duration,
        available: s.available
      }))
    }));
    return;
  }
  
  // Header
  console.log(`\n歌单: ${playlist.name} (${songs.length}首)`);
  if (playlist.description) {
    console.log(`简介: ${truncate(playlist.description, 60)}`);
  }
  console.log();
  
  // Column widths
  const numWidth = 5;
  const nameWidth = 24;
  const artistWidth = 16;
  const albumWidth = 16;
  const durationWidth = 6;
  
  // Header
  console.log(tableRow(
    ['#', '歌名', '歌手', '专辑', '时长'],
    [numWidth, nameWidth, artistWidth, albumWidth, durationWidth]
  ));
  console.log(tableSeparator([numWidth, nameWidth, artistWidth, albumWidth, durationWidth]));
  
  // Rows
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const artist = formatArtists(song.artists);
    const status = song.available ? '' : ' [不可用]';
    
    console.log(tableRow(
      [
        (i + 1).toString(),
        truncate(song.name, nameWidth - status.length) + status,
        truncate(artist, artistWidth),
        truncate(song.album.name, albumWidth),
        formatDuration(song.duration)
      ],
      [numWidth, nameWidth, artistWidth, albumWidth, durationWidth]
    ));
  }
  
  logger.newLine();
  
  // Summary
  const unavailable = songs.filter(s => !s.available).length;
  if (unavailable > 0) {
    logger.warn(`${unavailable} 首歌曲不可用（无版权/地区限制）`);
  }
}

/**
 * Register playlist command
 */
export function registerPlaylistCommand(program: Command): void {
  program
    .command('playlist [id]')
    .description('查看用户歌单')
    .option('-l, --limit <number>', '每页显示数量', '50')
    .option('-o, --offset <number>', '偏移量', '0')
    .option('--json', 'JSON格式输出')
    .action(async (id, options) => {
      const { json } = options;
      
      // Check auth
      const auth = await checkAuth();
      if (!auth.loggedIn) {
        if (json) {
          console.log(formatJsonError('AUTH_REQUIRED', '请先登录'));
        } else {
          logger.error('请先登录: musync login');
        }
        process.exit(1);
        return;
      }
      
      // If no ID, list all playlists
      if (!id) {
        const result = await fetchUserPlaylists();
        
        if (!result.success || !result.playlists) {
          if (json) {
            console.log(formatJsonError('FETCH_FAILED', result.error || '获取歌单失败'));
          } else {
            logger.error(result.error || '获取歌单失败');
          }
          process.exit(1);
          return;
        }
        
        displayPlaylistList(result.playlists, json);
        return;
      }
      
      // Fetch specific playlist
      const result = await getPlaylistWithTracks(id);
      
      if (!result.success || !result.playlist) {
        if (json) {
          console.log(formatJsonError('PLAYLIST_NOT_FOUND', result.error || '歌单不存在'));
        } else {
          logger.error(result.error || '歌单不存在');
        }
        process.exit(2);
        return;
      }
      
      displayPlaylistDetail(result.playlist, result.songs || [], json);
    });
}
