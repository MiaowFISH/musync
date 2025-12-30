/**
 * Sync command
 * Download missing songs from playlist
 */

import { Command } from 'commander';
import { getPlaylistWithTracks } from '../services/playlist';
import { scanDirectory } from '../services/scanner';
import { analyzeDiff } from '../services/matcher';
import { downloadSongs, upgradeSong } from '../services/downloader';
import { checkAuth } from '../services/auth';
import { loadConfig } from '../storage/config';
import { getAllRecords } from '../storage/database';
import { logger } from '../utils/logger';
import {
  formatJsonSuccess,
  formatJsonError,
  formatArtists,
  formatQuality,
  formatFileSize,
  truncate
} from '../utils/format';
import type { UserQuality } from '../constants';
import type { Song } from '../models/song';
import type { DownloadResult } from '../services/downloader';

/**
 * Display sync results
 */
function displaySyncResults(
  playlistName: string,
  successful: DownloadResult[],
  failed: DownloadResult[],
  skipped: number,
  dryRun: boolean,
  json: boolean
): void {
  if (json) {
    console.log(formatJsonSuccess({
      playlist: playlistName,
      dryRun,
      summary: {
        successful: successful.length,
        failed: failed.length,
        skipped
      },
      successful: successful.map(r => ({
        id: r.song.id,
        name: r.song.name,
        artist: formatArtists(r.song.artists),
        localPath: r.localPath,
        quality: r.quality,
        fileSize: r.fileSize
      })),
      failed: failed.map(r => ({
        id: r.song.id,
        name: r.song.name,
        artist: formatArtists(r.song.artists),
        error: r.error
      }))
    }));
    return;
  }
  
  // Console output
  logger.newLine();
  
  if (dryRun) {
    logger.success('预览完成（未实际下载）');
  } else {
    logger.success('同步完成');
  }
  
  console.log(`  下载成功: ${successful.length}`);
  console.log(`  下载失败: ${failed.length}`);
  console.log(`  已跳过: ${skipped}`);
  
  // Total download size
  const totalSize = successful.reduce((sum, r) => sum + (r.fileSize || 0), 0);
  if (totalSize > 0) {
    console.log(`  总大小: ${formatFileSize(totalSize)}`);
  }
  
  // Show failures
  if (failed.length > 0 && !json) {
    logger.newLine();
    logger.warn('下载失败的歌曲:');
    for (const result of failed.slice(0, 5)) {
      console.log(`  ${result.song.name} - ${formatArtists(result.song.artists)}: ${result.error}`);
    }
    if (failed.length > 5) {
      console.log(`  ... 还有 ${failed.length - 5} 首`);
    }
  }
}

/**
 * Register sync command
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync <playlist>')
    .description('同步下载歌曲')
    .option('-q, --quality <level>', '下载音质 (standard/high/lossless)', 'lossless')
    .option('-u, --upgrade', '同时升级已有歌曲')
    .option('--dry-run', '仅显示计划，不实际下载')
    .option('-l, --limit <number>', '限制下载数量')
    .option('-o, --output <path>', '指定输出目录')
    .option('--json', 'JSON格式输出')
    .action(async (playlist, options) => {
      const { quality, upgrade, dryRun, limit, output, json } = options;
      
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
        process.exit(1);
        return;
      }
      
      const downloadDir = output || config.downloadDir || config.musicDir;
      
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
      
      const scanResult = await scanDirectory(config.musicDir, { recursive: true });
      
      // Load sync records
      const syncRecords = await getAllRecords();
      
      // Analyze diff
      const diffResult = analyzeDiff(
        playlistResult.songs || [],
        scanResult.tracks,
        syncRecords,
        quality as UserQuality
      );
      
      // Determine what to download
      let songsToDownload: Song[] = [...diffResult.missing];
      
      // Apply limit
      const downloadLimit = limit ? parseInt(limit, 10) : undefined;
      if (downloadLimit && songsToDownload.length > downloadLimit) {
        songsToDownload = songsToDownload.slice(0, downloadLimit);
      }
      
      // Show summary
      if (!json) {
        console.log(`\n同步歌单: ${playlistResult.playlist.name}`);
        console.log();
        console.log(`  缺失歌曲: ${diffResult.missing.length}`);
        console.log(`  可升级: ${diffResult.upgradable.length}`);
        console.log(`  已匹配: ${diffResult.matched.length}`);
        console.log(`  无法下载: ${diffResult.unavailable.length}`);
        console.log();
        
        if (dryRun) {
          logger.info('预览模式 - 不会实际下载');
          console.log();
        }
      }
      
      // Nothing to download
      if (songsToDownload.length === 0 && !upgrade) {
        if (json) {
          console.log(formatJsonSuccess({
            playlist: playlistResult.playlist.name,
            message: '没有需要下载的歌曲'
          }));
        } else {
          logger.success('没有需要下载的歌曲');
        }
        return;
      }
      
      // Download missing songs
      if (!json && songsToDownload.length > 0) {
        logger.info(`开始下载 ${songsToDownload.length} 首歌曲...`);
        console.log();
      }
      
      const { successful, failed } = await downloadSongs(songsToDownload, downloadDir, {
        quality: quality as UserQuality,
        fileNameTemplate: config.fileNameTemplate,
        concurrency: config.concurrentDownloads,
        dryRun,
        onProgress: json ? undefined : (current, total, song, status) => {
          const statusIcon = status === 'completed' ? '✓' : status === 'failed' ? '✗' : '↓';
          logger.progress(current, total, `${statusIcon} ${truncate(song.name, 30)}`);
        }
      });
      
      // Handle upgrades if requested
      let upgradedCount = 0;
      let upgradeFailedCount = 0;
      
      if (upgrade && diffResult.upgradable.length > 0 && !dryRun) {
        if (!json) {
          logger.newLine();
          logger.info(`开始升级 ${diffResult.upgradable.length} 首歌曲...`);
        }
        
        for (const item of diffResult.upgradable) {
          const result = await upgradeSong(
            item.song,
            item.localTrack.filePath,
            downloadDir,
            {
              targetQuality: item.targetQuality,
              fileNameTemplate: config.fileNameTemplate,
              deleteOld: config.deleteOldOnUpgrade
            }
          );
          
          if (result.success) {
            upgradedCount++;
            successful.push(result);
          } else {
            upgradeFailedCount++;
            failed.push(result);
          }
          
          if (!json) {
            const status = result.success ? '✓' : '✗';
            console.log(`  ${status} ${truncate(item.song.name, 30)}: ${formatQuality(item.currentQuality)} → ${formatQuality(item.targetQuality)}`);
          }
        }
      }
      
      // Display results
      displaySyncResults(
        playlistResult.playlist.name,
        successful,
        failed,
        diffResult.matched.length + diffResult.unavailable.length,
        dryRun,
        json
      );
      
      // Exit code based on results
      if (failed.length > 0 && successful.length === 0) {
        process.exit(2); // All failed
      } else if (failed.length > 0) {
        process.exit(1); // Partial failure
      }
    });
}
