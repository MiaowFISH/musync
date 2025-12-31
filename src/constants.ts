/**
 * Constants for musync application
 */

import { homedir } from 'os';
import { join } from 'path';

// Application metadata
export const APP_NAME = 'musync';
export const APP_VERSION = '1.3.0';
export const APP_DESCRIPTION = '网易云音乐歌单同步工具';

// Default data directory
export const DEFAULT_DATA_DIR = join(homedir(), '.musync');

// File names
export const CONFIG_FILE = 'config.json';
export const COOKIE_FILE = 'cookie.json';
export const DATABASE_FILE = 'database.json';

// Audio formats
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'flac', 'wav', 'ncm', 'ogg', 'm4a', 'aac'] as const;
export type AudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number] | 'other';

// User-facing quality levels (simplified)
export type UserQuality = 'standard' | 'high' | 'lossless';

// API quality levels (complete)
export type ApiLevel =
  | 'standard'   // 标准 128kbps
  | 'higher'     // 较高 192kbps
  | 'exhigh'     // 极高 320kbps
  | 'lossless'   // 无损
  | 'hires'      // Hi-Res
  | 'jyeffect'   // 高清环绕声
  | 'sky'        // 沉浸环绕声
  | 'dolby'      // 杜比全景声
  | 'jymaster';  // 超清母带

// Map user quality to API level
export const QUALITY_TO_LEVEL: Record<UserQuality, ApiLevel> = {
  standard: 'standard',
  high: 'exhigh',
  lossless: 'lossless'
};

// Map API level to bitrate (for download URL)
export const LEVEL_TO_BITRATE: Record<ApiLevel, number> = {
  standard: 128000,
  higher: 192000,
  exhigh: 320000,
  lossless: 999000,
  hires: 999000,
  jyeffect: 999000,
  sky: 999000,
  dolby: 999000,
  jymaster: 999000
};

// Quality ranking for comparison
export const QUALITY_RANK: Record<string, number> = {
  standard: 1,
  higher: 2,
  high: 3,      // Maps to exhigh
  exhigh: 3,
  lossless: 4,
  hires: 5,
  jyeffect: 6,
  sky: 6,
  spatial: 6,
  dolby: 7,
  jymaster: 8,
  master: 8
};

// Quality configuration for display
export const QUALITY_CONFIG = {
  standard: { label: '标准', format: 'mp3' as const, rank: 1, bitrate: 128 },
  high: { label: '高品质', format: 'mp3' as const, rank: 2, bitrate: 320 },
  lossless: { label: '无损', format: 'flac' as const, rank: 3, bitrate: 1000 }
} as const;

// Sync status types
export type SyncStatus = 'synced' | 'upgraded' | 'deleted' | 'pending';

// QR code check status
export const QR_CHECK_STATUS = {
  EXPIRED: 800,
  WAITING: 801,
  SCANNED: 802,
  CONFIRMED: 803
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  musicDir: '',
  downloadDir: undefined as string | undefined,
  preferredQuality: 'lossless' as UserQuality,
  deleteOldOnUpgrade: false,
  concurrentDownloads: 5,
  fileNameTemplate: '{name} - {artist}'
};

// Concurrent download limits
export const MAX_CONCURRENT_DOWNLOADS = 10;
export const DEFAULT_CONCURRENT_DOWNLOADS = 5;

// API rate limiting
export const API_RETRY_COUNT = 3;
export const API_RETRY_BASE_DELAY = 1000;

// File name patterns for parsing
export const FILENAME_PATTERNS = [
  // "歌名 - 歌手.ext"
  /^(.+?)\s*-\s*(.+)$/,
  // "歌手 - 歌名.ext" (alternative)
  /^(.+?)\s*[-–—]\s*(.+)$/
] as const;

// NCM file magic header
export const NCM_MAGIC_HEADER = Buffer.from('CTENFDAM');
