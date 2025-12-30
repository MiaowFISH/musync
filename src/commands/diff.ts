/**
 * Diff command
 * Compare online playlist with local music library
 */

import { Command } from 'commander';
import { getPlaylistWithTracks } from '../services/playlist';
import { scanDirectory } from '../services/scanner';
import { analyzeDiff } from '../services/matcher';
import { checkAuth } from '../services/auth';
import { loadConfig } from '../storage/config';
import { getAllRecords } from '../storage/database';
import { logger } from '../utils/logger';
import {
  formatJsonSuccess,
  formatJsonError,
  formatArtists,
  formatQuality,
  truncate,
  tableRow,
  tableSeparator
} from '../utils/format';
import type { UserQuality } from '../constants';
import type { Song } from '../models/song';
import type { MatchedPair, UpgradablePair } from '../services/matcher';

/**
 * Display diff results
 */
function displayDiffResults(
  playlistName: string,
  totalSongs: number,
  missing: Song[],
  upgradable: UpgradablePair[],
  matched: MatchedPair[],
  unavailable: Song[],
  json: boolean
): void {
  if (json) {
    console.log(formatJsonSuccess({
      playlist: playlistName,
      totalSongs,
      summary: {
        missing: missing.length,
        upgradable: upgradable.length,
        matched: matched.length,
        unavailable: unavailable.length
      },
      missing: missing.map(s => ({
        id: s.id,
        name: s.name,
        artist: formatArtists(s.artists),
        availableQualities: s.availableQualities
      })),
      upgradable: upgradable.map(u => ({
        id: u.song.id,
        name: u.song.name,
        artist: formatArtists(u.song.artists),
        currentQuality: u.currentQuality,
        targetQuality: u.targetQuality
      })),
      matched: matched.map(m => ({
        id: m.song.id,
        name: m.song.name,
        artist: formatArtists(m.song.artists),
        localPath: m.localTrack.filePath,
        matchMethod: m.matchMethod,
        confidence: m.confidence
      })),
      unavailable: unavailable.map(s => ({
        id: s.id,
        name: s.name,
        artist: formatArtists(s.artists),
        reason: s.needVip ? 'VIP专享' : '无版权'
      }))
    }));
    return;
  }
  
  // Console output
  console.log(`\n对比歌单: ${playlistName} (${totalSongs}首)`);
  console.log();
  
  // Column widths
  const nameWidth = 20;
  const artistWidth = 14;
  const qualityWidth = 12;
  
  // Missing songs
  if (missing.length > 0) {
    logger.group(`缺失歌曲 (${missing.length}首)`);
    console.log(tableRow(['歌名', '歌手', '可用音质'], [nameWidth, artistWidth, qualityWidth]));
    console.log(tableSeparator([nameWidth, artistWidth, qualityWidth]));
    
    for (const song of missing.slice(0, 20)) {
      const quality = song.availableQualities[song.availableQualities.length - 1] || 'standard';
      console.log(tableRow(
        [
          truncate(song.name, nameWidth),
          truncate(formatArtists(song.artists), artistWidth),
          formatQuality(quality as UserQuality)
        ],
        [nameWidth, artistWidth, qualityWidth]
      ));
    }
    
    if (missing.length > 20) {
      console.log(`  ... 还有 ${missing.length - 20} 首`);
    }
    console.log();
  }
  
  // Upgradable songs
  if (upgradable.length > 0) {
    logger.group(`可升级 (${upgradable.length}首)`);
    const currentWidth = 8;
    const targetWidth = 10;
    
    console.log(tableRow(['歌名', '歌手', '当前', '可升级至'], [nameWidth, artistWidth, currentWidth, targetWidth]));
    console.log(tableSeparator([nameWidth, artistWidth, currentWidth, targetWidth]));
    
    for (const item of upgradable.slice(0, 10)) {
      console.log(tableRow(
        [
          truncate(item.song.name, nameWidth),
          truncate(formatArtists(item.song.artists), artistWidth),
          formatQuality(item.currentQuality),
          formatQuality(item.targetQuality)
        ],
        [nameWidth, artistWidth, currentWidth, targetWidth]
      ));
    }
    
    if (upgradable.length > 10) {
      console.log(`  ... 还有 ${upgradable.length - 10} 首`);
    }
    console.log();
  }
  
  // Summary
  console.log(`已匹配 (${matched.length}首)`);
  
  // Unavailable songs
  if (unavailable.length > 0) {
    logger.group(`无法下载 (${unavailable.length}首)`);
    const reasonWidth = 10;
    
    console.log(tableRow(['歌名', '原因'], [nameWidth + artistWidth, reasonWidth]));
    console.log(tableSeparator([nameWidth + artistWidth, reasonWidth]));
    
    for (const song of unavailable.slice(0, 5)) {
      const reason = song.needVip ? 'VIP专享' : '无版权';
      console.log(tableRow(
        [truncate(`${song.name} - ${formatArtists(song.artists)}`, nameWidth + artistWidth), reason],
        [nameWidth + artistWidth, reasonWidth]
      ));
    }
    
    if (unavailable.length > 5) {
      console.log(`  ... 还有 ${unavailable.length - 5} 首`);
    }
    console.log();
  }
  
  // Final summary
  logger.newLine();
  logger.info(`总计: ${missing.length} 缺失, ${upgradable.length} 可升级, ${matched.length} 已匹配, ${unavailable.length} 无法下载`);
}

/**
 * Register diff command
 */
export function registerDiffCommand(program: Command): void {
  program
    .command('diff <playlist>')
    .description('对比歌单与本地差异')
    .option('-q, --quality <level>', '目标音质 (standard/high/lossless)', 'lossless')
    .option('--json', 'JSON格式输出')
    .action(async (playlist, options) => {
      const { quality, json } = options;
      
      // Validate quality option
      const validQualities: UserQuality[] = ['standard', 'high', 'lossless'];
      if (!validQualities.includes(quality as UserQuality)) {
        if (json) {
          console.log(formatJsonError('INVALID_QUALITY', `无效的音质选项: ${quality}`));
        } else {
          logger.error(`无效的音质选项: ${quality}. 可选: ${validQualities.join(', ')}`);
        }
        process.exit(1);
        return;
      }
      
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
      
      // Load config
      const config = await loadConfig();
      
      if (!config.musicDir) {
        if (json) {
          console.log(formatJsonError('NO_MUSIC_DIR', '请先设置音乐目录'));
        } else {
          logger.error('请先设置音乐目录: musync config musicDir <path>');
        }
        process.exit(3);
        return;
      }
      
      // Fetch playlist
      if (!json) {
        logger.info(`正在获取歌单信息...`);
      }
      
      const playlistResult = await getPlaylistWithTracks(playlist);
      
      if (!playlistResult.success || !playlistResult.playlist) {
        if (json) {
          console.log(formatJsonError('PLAYLIST_NOT_FOUND', playlistResult.error || '歌单不存在'));
        } else {
          logger.error(playlistResult.error || '歌单不存在');
        }
        process.exit(2);
        return;
      }
      
      // Scan local music
      if (!json) {
        logger.info(`正在扫描本地音乐库...`);
      }
      
      const scanResult = await scanDirectory(config.musicDir, {
        recursive: true,
        onProgress: json ? undefined : (current, total) => {
          logger.progress(current, total, '扫描中');
        }
      });
      
      // Load sync records
      const syncRecords = await getAllRecords();
      
      // Analyze diff
      if (!json) {
        logger.info(`正在分析差异...`);
      }
      
      const diffResult = analyzeDiff(
        playlistResult.songs || [],
        scanResult.tracks,
        syncRecords,
        quality as UserQuality
      );
      
      // Display results
      displayDiffResults(
        playlistResult.playlist.name,
        playlistResult.songs?.length || 0,
        diffResult.missing,
        diffResult.upgradable,
        diffResult.matched,
        diffResult.unavailable,
        json
      );
    });
}
