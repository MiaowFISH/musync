/**
 * Download service
 * Handles song downloads with concurrent queue and retry logic
 */

import { join } from 'path';
import pLimit from 'p-limit';
import { getSongUrl, getSongDownloadUrl } from './api';
import { requireAuth } from './auth';
import type { Song } from '../models/song';
import type { SyncRecord } from '../models/config';
import type { UserQuality, ApiLevel } from '../constants';
import {
  QUALITY_TO_LEVEL,
  LEVEL_TO_BITRATE,
  API_RETRY_COUNT,
  API_RETRY_BASE_DELAY,
  DEFAULT_CONCURRENT_DOWNLOADS
} from '../constants';
import {
  ensureDirectory,
  pathExists,
  getAvailableDiskSpace,
  sanitizeFileName,
  generateUniqueFileName,
  deleteFile,
  getFileMtime,
  getFileSize,
  getExtension
} from '../utils/file';
import { formatArtists } from '../utils/format';
import { logger } from '../utils/logger';
import { upsertRecord } from '../storage/database';

/**
 * Download result for a single song
 */
export interface DownloadResult {
  song: Song;
  success: boolean;
  localPath?: string;
  quality?: UserQuality;
  fileSize?: number;
  error?: string;
}

/**
 * Download progress callback
 */
export type DownloadProgressCallback = (
  current: number,
  total: number,
  song: Song,
  status: 'downloading' | 'completed' | 'failed' | 'skipped'
) => void;

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate filename from song info
 */
export function generateFileName(
  song: Song,
  template: string,
  extension: string
): string {
  const artist = formatArtists(song.artists);
  
  let fileName = template
    .replace('{name}', song.name)
    .replace('{artist}', artist)
    .replace('{album}', song.album.name)
    .replace('{id}', song.id.toString());
  
  return sanitizeFileName(fileName) + '.' + extension;
}

/**
 * Get song download URL with retry
 */
async function fetchDownloadUrl(
  songId: number,
  cookie: string,
  level: ApiLevel
): Promise<{ url: string | null; type: string; size: number; br: number } | null> {
  let lastError: Error | undefined;
  
  // Convert level to bitrate for download URL API
  const bitrate = LEVEL_TO_BITRATE[level] || 999000;
  
  // Map level to streaming quality type
  type StreamLevel = 'standard' | 'exhigh' | 'lossless' | 'hires';
  const soundLevel: StreamLevel = 
    level === 'standard' ? 'standard' :
    level === 'exhigh' || level === 'higher' ? 'exhigh' :
    level === 'hires' ? 'hires' :
    'lossless';
  
  for (let i = 0; i < API_RETRY_COUNT; i++) {
    try {
      // Try download URL first (higher quality)
      const downloadResult = await getSongDownloadUrl(songId, cookie, bitrate);
      
      if (downloadResult.success && downloadResult.data?.url) {
        return {
          url: downloadResult.data.url,
          type: downloadResult.data.type || 'mp3',
          size: downloadResult.data.size || 0,
          br: downloadResult.data.br || 0
        };
      }
      
      // Fall back to streaming URL
      const streamResult = await getSongUrl(songId, cookie, { level: soundLevel });
      
      if (streamResult.success && streamResult.data?.url) {
        return {
          url: streamResult.data.url,
          type: streamResult.data.type || 'mp3',
          size: streamResult.data.size || 0,
          br: streamResult.data.br || 0
        };
      }
      
      lastError = new Error(downloadResult.error || streamResult.error || '获取下载链接失败');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    
    if (i < API_RETRY_COUNT - 1) {
      await sleep(API_RETRY_BASE_DELAY * Math.pow(2, i));
    }
  }
  
  logger.debug(`Failed to get download URL for song ${songId}: ${lastError?.message}`);
  return null;
}

/**
 * Download a file from URL
 */
async function downloadFile(
  url: string,
  destPath: string,
  _onProgress?: (downloaded: number, total: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    
    // Note: contentLength available for progress reporting if needed
    // const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const arrayBuffer = await response.arrayBuffer();
    
    // Write file using Bun's native API
    await Bun.write(destPath, arrayBuffer);
    
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '下载失败'
    };
  }
}

/**
 * Download a single song
 */
export async function downloadSong(
  song: Song,
  outputDir: string,
  options: {
    quality?: UserQuality;
    fileNameTemplate?: string;
    overwrite?: boolean;
  } = {}
): Promise<DownloadResult> {
  const {
    quality = 'lossless',
    fileNameTemplate = '{name} - {artist}',
    overwrite = false
  } = options;
  
  try {
    const { cookie } = await requireAuth();
    
    // Check if song is available
    if (!song.available) {
      return {
        song,
        success: false,
        error: song.needVip ? 'VIP专享' : '歌曲不可用'
      };
    }
    
    // Get download URL
    const level = QUALITY_TO_LEVEL[quality];
    const urlInfo = await fetchDownloadUrl(song.id, cookie, level);
    
    if (!urlInfo || !urlInfo.url) {
      return {
        song,
        success: false,
        error: '无法获取下载链接'
      };
    }
    
    // Ensure output directory exists
    await ensureDirectory(outputDir);
    
    // Generate filename
    const extension = urlInfo.type || 'mp3';
    const fileName = generateFileName(song, fileNameTemplate, extension);
    let destPath = join(outputDir, fileName);
    
    // Handle existing files
    if (pathExists(destPath) && !overwrite) {
      destPath = generateUniqueFileName(outputDir, fileName.replace(`.${extension}`, ''), extension);
    }
    
    // Download file
    logger.debug(`Downloading ${song.name} to ${destPath}`);
    const downloadResult = await downloadFile(urlInfo.url, destPath);
    
    if (!downloadResult.success) {
      return {
        song,
        success: false,
        error: downloadResult.error
      };
    }
    
    // Determine actual quality based on bitrate
    let actualQuality: UserQuality = 'standard';
    if (extension === 'flac' || urlInfo.br >= 900000) {
      actualQuality = 'lossless';
    } else if (urlInfo.br >= 256000) {
      actualQuality = 'high';
    }
    
    // Get file stats for the new SyncRecord
    const downloadedFileSize = getFileSize(destPath);
    const downloadedFileMtime = getFileMtime(destPath) ?? new Date().toISOString();
    const downloadedFormat = getExtension(destPath);
    
    // Save to database
    const record: SyncRecord = {
      localPath: destPath,
      songId: song.id,
      name: song.name,
      artist: formatArtists(song.artists),
      quality: actualQuality,
      syncedAt: new Date().toISOString(),
      status: 'synced',
      fileModifiedAt: downloadedFileMtime,
      fileSize: downloadedFileSize,
      format: downloadedFormat as 'mp3' | 'flac' | 'wav' | 'ogg' | 'm4a' | 'aac' | 'ncm' | 'other',
      bitrate: Math.round(urlInfo.br / 1000),
      source: 'metadata'
    };
    
    await upsertRecord(record);
    
    return {
      song,
      success: true,
      localPath: destPath,
      quality: actualQuality,
      fileSize: urlInfo.size
    };
  } catch (err) {
    return {
      song,
      success: false,
      error: err instanceof Error ? err.message : '下载失败'
    };
  }
}

/**
 * Download multiple songs with concurrency control
 */
export async function downloadSongs(
  songs: Song[],
  outputDir: string,
  options: {
    quality?: UserQuality;
    fileNameTemplate?: string;
    concurrency?: number;
    onProgress?: DownloadProgressCallback;
    dryRun?: boolean;
  } = {}
): Promise<{
  successful: DownloadResult[];
  failed: DownloadResult[];
}> {
  const {
    quality = 'lossless',
    fileNameTemplate = '{name} - {artist}',
    concurrency = DEFAULT_CONCURRENT_DOWNLOADS,
    onProgress,
    dryRun = false
  } = options;
  
  // Check disk space
  const estimatedSize = songs.length * 30 * 1024 * 1024; // Estimate 30MB per song
  const availableSpace = await getAvailableDiskSpace(outputDir);
  
  if (availableSpace < estimatedSize) {
    logger.warn(`磁盘空间可能不足 (预计需要: ${Math.round(estimatedSize / 1024 / 1024)}MB)`);
  }
  
  const successful: DownloadResult[] = [];
  const failed: DownloadResult[] = [];
  
  if (dryRun) {
    // Dry run - just report what would be downloaded
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      onProgress?.(i + 1, songs.length, song, 'skipped');
      successful.push({
        song,
        success: true,
        quality
      });
    }
    return { successful, failed };
  }
  
  // Create concurrency limiter
  const limit = pLimit(concurrency);
  let completed = 0;
  
  // Download tasks
  const tasks = songs.map(song =>
    limit(async () => {
      onProgress?.(completed + 1, songs.length, song, 'downloading');
      
      const result = await downloadSong(song, outputDir, {
        quality,
        fileNameTemplate
      });
      
      completed++;
      
      if (result.success) {
        successful.push(result);
        onProgress?.(completed, songs.length, song, 'completed');
      } else {
        failed.push(result);
        onProgress?.(completed, songs.length, song, 'failed');
      }
      
      return result;
    })
  );
  
  await Promise.all(tasks);
  
  return { successful, failed };
}

/**
 * Upgrade a local track to higher quality
 */
export async function upgradeSong(
  song: Song,
  currentPath: string,
  outputDir: string,
  options: {
    targetQuality: UserQuality;
    fileNameTemplate?: string;
    deleteOld?: boolean;
  }
): Promise<DownloadResult> {
  const { targetQuality, fileNameTemplate = '{name} - {artist}', deleteOld = false } = options;
  
  // Download new version
  const result = await downloadSong(song, outputDir, {
    quality: targetQuality,
    fileNameTemplate,
    overwrite: false
  });
  
  if (result.success && deleteOld && currentPath !== result.localPath) {
    // Delete old file
    const deleted = await deleteFile(currentPath);
    if (deleted) {
      logger.debug(`Deleted old file: ${currentPath}`);
    }
  }
  
  // Update database record status
  if (result.success) {
    // Get file stats for the new SyncRecord
    const upgradedFileSize = getFileSize(result.localPath!);
    const upgradedFileMtime = getFileMtime(result.localPath!) ?? new Date().toISOString();
    const upgradedFormat = getExtension(result.localPath!);
    
    const record: SyncRecord = {
      localPath: result.localPath!,
      songId: song.id,
      name: song.name,
      artist: formatArtists(song.artists),
      quality: result.quality!,
      syncedAt: new Date().toISOString(),
      status: 'upgraded',
      fileModifiedAt: upgradedFileMtime,
      fileSize: upgradedFileSize,
      format: upgradedFormat as 'mp3' | 'flac' | 'wav' | 'ogg' | 'm4a' | 'aac' | 'ncm' | 'other',
      source: 'metadata'
    };
    
    await upsertRecord(record);
  }
  
  return result;
}
