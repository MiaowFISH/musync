/**
 * Local track type definitions
 */

import type { AudioFormat, UserQuality } from '../constants';

/**
 * Local track information parsed from filesystem
 */
export interface LocalTrack {
  /** Absolute file path */
  filePath: string;
  /** Parsed song name */
  name: string;
  /** Parsed artist name */
  artist: string;
  /** Album (from metadata) */
  album?: string;
  /** Quality level */
  quality: UserQuality;
  /** File format */
  format: AudioFormat;
  /** File size in bytes */
  fileSize: number;
  /** Bitrate (kbps) */
  bitrate?: number;
  /** Associated NetEase song ID (if matched) */
  songId?: number;
  /** Information source */
  source: 'filename' | 'metadata' | 'database';
}

/**
 * Scan result for a directory
 */
export interface ScanResult {
  /** Total files found */
  totalFiles: number;
  /** Successfully parsed tracks */
  tracks: LocalTrack[];
  /** Failed file paths */
  failedFiles: string[];
  /** Format distribution */
  formatDistribution: Record<string, number>;
  /** Scan duration in ms */
  scanDurationMs: number;
}

/**
 * Determine quality from format and bitrate
 */
export function determineQuality(format: AudioFormat, bitrate?: number): UserQuality {
  // Lossless formats
  if (format === 'flac' || format === 'wav') {
    return 'lossless';
  }
  
  // For MP3 and other formats, use bitrate
  if (bitrate) {
    if (bitrate >= 256) return 'high';
    return 'standard';
  }
  
  // Default to standard if unknown
  return 'standard';
}

/**
 * Create LocalTrack from parsed information
 */
export function createLocalTrack(data: {
  filePath: string;
  name: string;
  artist: string;
  album?: string;
  format: AudioFormat;
  fileSize: number;
  bitrate?: number;
  songId?: number;
  source: 'filename' | 'metadata' | 'database';
}): LocalTrack {
  return {
    ...data,
    quality: determineQuality(data.format, data.bitrate)
  };
}

/**
 * Create empty scan result
 */
export function createEmptyScanResult(): ScanResult {
  return {
    totalFiles: 0,
    tracks: [],
    failedFiles: [],
    formatDistribution: {},
    scanDurationMs: 0
  };
}

/**
 * Merge scan results
 */
export function mergeScanResults(results: ScanResult[]): ScanResult {
  const merged = createEmptyScanResult();
  
  for (const result of results) {
    merged.totalFiles += result.totalFiles;
    merged.tracks.push(...result.tracks);
    merged.failedFiles.push(...result.failedFiles);
    merged.scanDurationMs = Math.max(merged.scanDurationMs, result.scanDurationMs);
    
    // Merge format distribution
    for (const [format, count] of Object.entries(result.formatDistribution)) {
      merged.formatDistribution[format] = (merged.formatDistribution[format] ?? 0) + count;
    }
  }
  
  return merged;
}
