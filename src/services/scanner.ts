/**
 * Local music scanner service
 * Scans directories for audio files and extracts metadata
 */

import { parseFile} from 'music-metadata';
import { basename, extname } from 'path';
import {
  findAudioFiles,
  getFileSize,
  getAudioFormat,
  pathExists,
  isDirectory,
  getFileMtime,
  getFileStats
} from '../utils/file';
import type { LocalTrack, ScanResult } from '../models/local-track';
import { createLocalTrack, createEmptyScanResult } from '../models/local-track';
import type { AudioFormat } from '../constants';
import { FILENAME_PATTERNS } from '../constants';
import { logger } from '../utils/logger';
import { decryptNcmFile, extractNcmMetadata } from './ncm';
import type { SyncRecord } from '../models/config';

/**
 * Parse song info from filename
 * Supports formats: "歌名 - 歌手.ext" and "歌手 - 歌名.ext"
 */
export function parseFilename(filePath: string): { name: string; artist: string } | null {
  const fileName = basename(filePath, extname(filePath));
  
  // Try patterns
  for (const pattern of FILENAME_PATTERNS) {
    const match = fileName.match(pattern);
    if (match && match[1] && match[2]) {
      // Return as "name - artist" format
      // The first part is assumed to be the song name
      return {
        name: match[1].trim(),
        artist: match[2].trim()
      };
    }
  }
  
  // No separator found, use filename as song name
  return {
    name: fileName.trim(),
    artist: 'Unknown Artist'
  };
}

/**
 * Read audio file metadata using music-metadata library
 */
export async function readAudioMetadata(filePath: string): Promise<{
  title?: string;
  artist?: string;
  album?: string;
  bitrate?: number;
  duration?: number;
} | null> {
  try {
    const metadata = await parseFile(filePath, { duration: false, skipCovers: true, skipPostHeaders: true });
    
    return {
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album,
      bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : undefined,
      duration: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : undefined
    };
  } catch (err) {
    logger.debug(`Failed to read metadata for ${filePath}: ${err}`);
    return null;
  }
}

/**
 * Check if a file has changed since it was last recorded
 * Compares mtime and size for quick change detection
 */
export function hasFileChanged(filePath: string, existingRecord: SyncRecord): boolean {
  const stats = getFileStats(filePath);
  
  if (!stats) {
    // File doesn't exist anymore
    return true;
  }
  
  // Compare mtime (primary check)
  if (stats.mtime !== existingRecord.fileModifiedAt) {
    return true;
  }
  
  // Compare size as a sanity check
  if (stats.size !== existingRecord.fileSize) {
    return true;
  }
  
  return false;
}

/**
 * Scan a single audio file
 */
export async function scanAudioFile(filePath: string, decryptNcm = true): Promise<LocalTrack | null> {
  if (!pathExists(filePath)) {
    return null;
  }
  
  let actualPath = filePath;
  let format = getAudioFormat(filePath);
  
  // Handle NCM files
  if (format === 'ncm' && decryptNcm) {
    // Try to extract metadata first
    const ncmMeta = extractNcmMetadata(filePath);
    
    if (ncmMeta) {
      // Return track info from NCM metadata without decrypting
      const fileSize = getFileSize(filePath);
      const fileMtime = getFileMtime(filePath) ?? new Date().toISOString();
      const artists = ncmMeta.artist.map(a => a[0]).join(', ');
      
      return createLocalTrack({
        filePath,
        name: ncmMeta.musicName,
        artist: artists,
        album: ncmMeta.album,
        format: ncmMeta.format as AudioFormat,
        fileSize,
        bitrate: Math.round(ncmMeta.bitrate / 1000),
        songId: ncmMeta.musicId,
        source: 'metadata',
        fileModifiedAt: fileMtime
      });
    }
    
    // If metadata extraction fails, try to decrypt
    const decryptResult = decryptNcmFile(filePath, { overwrite: false });
    if (decryptResult.success && decryptResult.outputPath) {
      actualPath = decryptResult.outputPath;
      format = getAudioFormat(actualPath);
      
      if (decryptResult.metadata) {
        const fileSize = getFileSize(actualPath);
        const fileMtime = getFileMtime(actualPath) ?? new Date().toISOString();
        const artists = decryptResult.metadata.artist.map(a => a[0]).join(', ');
        
        return createLocalTrack({
          filePath: actualPath,
          name: decryptResult.metadata.musicName,
          artist: artists,
          album: decryptResult.metadata.album,
          format,
          fileSize,
          bitrate: Math.round(decryptResult.metadata.bitrate / 1000),
          songId: decryptResult.metadata.musicId,
          source: 'metadata',
          fileModifiedAt: fileMtime
        });
      }
    }
  }
  
  const fileSize = getFileSize(actualPath);
  const fileMtime = getFileMtime(actualPath) ?? new Date().toISOString();
  
  // Try to read metadata first
  const metadata = await readAudioMetadata(filePath);
  
  let name: string;
  let artist: string;
  let album: string | undefined;
  let bitrate: number | undefined;
  let source: 'filename' | 'metadata' | 'database' = 'filename';
  
  if (metadata?.title && metadata?.artist) {
    // Use metadata
    name = metadata.title;
    artist = metadata.artist;
    album = metadata.album;
    bitrate = metadata.bitrate;
    source = 'metadata';
  } else {
    // Fall back to filename parsing
    const parsed = parseFilename(filePath);
    if (!parsed) {
      return null;
    }
    name = parsed.name;
    artist = parsed.artist;
    album = metadata?.album;
    bitrate = metadata?.bitrate;
  }
  
  return createLocalTrack({
    filePath,
    name,
    artist,
    album,
    format,
    fileSize,
    bitrate,
    source,
    fileModifiedAt: fileMtime
  });
}

/**
 * Scan a directory for audio files
 */
export async function scanDirectory(
  dir: string,
  options: {
    recursive?: boolean;
    incremental?: boolean;
    existingRecords?: SyncRecord[];
    onProgress?: (current: number, total: number, file: string) => void;
  } = {}
): Promise<ScanResult> {
  const { recursive = true, incremental = false, existingRecords = [], onProgress } = options;
  const startTime = Date.now();
  
  if (!pathExists(dir)) {
    logger.error(`目录不存在: ${dir}`);
    return {
      ...createEmptyScanResult(),
      scanDurationMs: Date.now() - startTime
    };
  }
  
  if (!isDirectory(dir)) {
    logger.error(`不是目录: ${dir}`);
    return {
      ...createEmptyScanResult(),
      scanDurationMs: Date.now() - startTime
    };
  }
  
  logger.debug(`Scanning directory: ${dir} (incremental: ${incremental})`);
  
  // Find all audio files
  const files = findAudioFiles(dir, recursive);
  const totalFiles = files.length;
  
  logger.debug(`Found ${totalFiles} audio files`);
  
  // Build index for incremental scanning
  const recordsByPath = new Map(
    existingRecords.map(r => [r.localPath, r])
  );
  
  // Track files in current scan to detect deletions
  const currentFilePaths = new Set(files);
  
  const tracks: LocalTrack[] = [];
  const failedFiles: string[] = [];
  const formatDistribution: Record<string, number> = {};
  
  // Incremental scan statistics
  let newFiles = 0;
  let skippedFiles = 0;
  let updatedFiles = 0;
  
  // Process files
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (onProgress) {
      onProgress(i + 1, totalFiles, file);
    }
    
    // Track format distribution
    const ext = extname(file).slice(1).toLowerCase();
    formatDistribution[ext] = (formatDistribution[ext] ?? 0) + 1;
    
    // Incremental mode: check if file has changed
    if (incremental) {
      const existingRecord = recordsByPath.get(file);
      
      if (existingRecord && !hasFileChanged(file, existingRecord)) {
        // File hasn't changed, skip parsing
        skippedFiles++;
        continue;
      }
      
      // Track if this is a new file or an update
      if (existingRecord) {
        updatedFiles++;
      } else {
        newFiles++;
      }
    }
    
    try {
      const track = await scanAudioFile(file);
      
      if (track) {
        tracks.push(track);
      } else {
        failedFiles.push(file);
      }
    } catch (err) {
      logger.debug(`Error scanning ${file}: ${err}`);
      failedFiles.push(file);
    }
  }
  
  // Count deleted files (files in database but no longer on disk)
  let deletedFiles = 0;
  for (const record of existingRecords) {
    if (!currentFilePaths.has(record.localPath) && record.status !== 'deleted') {
      deletedFiles++;
    }
  }
  
  const scanDurationMs = Date.now() - startTime;
  
  // Log performance metrics
  logger.debug(`Scan completed in ${scanDurationMs}ms`);
  logger.debug(`Total files: ${totalFiles}, Parsed: ${tracks.length}, Failed: ${failedFiles.length}`);
  if (incremental) {
    logger.debug(`Incremental stats: new=${newFiles}, skipped=${skippedFiles}, updated=${updatedFiles}, deleted=${deletedFiles}`);
  }
  if (tracks.length > 0) {
    const avgTimePerFile = scanDurationMs / tracks.length;
    logger.debug(`Average time per parsed file: ${avgTimePerFile.toFixed(2)}ms`);
  }
  
  return {
    totalFiles,
    tracks,
    failedFiles,
    formatDistribution,
    scanDurationMs,
    newFiles: incremental ? newFiles : totalFiles,
    skippedFiles: incremental ? skippedFiles : 0,
    updatedFiles: incremental ? updatedFiles : 0,
    deletedFiles: incremental ? deletedFiles : 0
  };
}

/**
 * Quick scan - only count files without parsing metadata
 */
export async function quickScan(
  dir: string,
  recursive = true
): Promise<{
  totalFiles: number;
  formatDistribution: Record<string, number>;
}> {
  if (!pathExists(dir) || !isDirectory(dir)) {
    return {
      totalFiles: 0,
      formatDistribution: {}
    };
  }
  
  const files = findAudioFiles(dir, recursive);
  const formatDistribution: Record<string, number> = {};
  
  for (const file of files) {
    const ext = extname(file).slice(1).toLowerCase();
    formatDistribution[ext] = (formatDistribution[ext] ?? 0) + 1;
  }
  
  return {
    totalFiles: files.length,
    formatDistribution
  };
}

/**
 * Detect quality from bitrate and format
 */
export function detectQuality(format: AudioFormat, bitrate?: number): string {
  if (format === 'flac' || format === 'wav') {
    return 'lossless';
  }
  
  if (bitrate) {
    if (bitrate >= 256) return 'high';
    if (bitrate >= 128) return 'standard';
  }
  
  return 'standard';
}
