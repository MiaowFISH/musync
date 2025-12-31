/**
 * Configuration and sync record type definitions
 */

import type { UserQuality, SyncStatus, AudioFormat } from '../constants';
import { DEFAULT_CONFIG } from '../constants';

/**
 * Application configuration
 */
export interface Config {
  /** Local music directory */
  musicDir: string;
  /** Download save directory (defaults to musicDir) */
  downloadDir?: string;
  /** Preferred quality */
  preferredQuality: UserQuality;
  /** Delete old file when upgrading */
  deleteOldOnUpgrade: boolean;
  /** Concurrent download count */
  concurrentDownloads: number;
  /** Filename template */
  fileNameTemplate: string;
}

/**
 * Cookie storage for authentication
 */
export interface CookieStore {
  /** User ID */
  userId: number;
  /** User nickname */
  nickname: string;
  /** Cookie string */
  cookie: string;
  /** Login timestamp */
  loginAt: string;
  /** Expiration timestamp (estimated) */
  expiresAt?: string;
  /** Login method used */
  loginMethod: 'phone' | 'email' | 'qr';
}

/**
 * QR code login state
 */
export interface QRLoginState {
  /** QR code unique key */
  key: string;
  /** QR code image base64 */
  qrimg?: string;
  /** QR code URL */
  qrurl?: string;
  /** Created timestamp */
  createdAt: number;
  /** Expiration timestamp (usually 2 minutes) */
  expiresAt: number;
}

/**
 * Sync record for a track
 */
export interface SyncRecord {
  /** Local file path (primary key) */
  localPath: string;
  /** NetEase song ID (optional, filled after matching) */
  songId?: number;
  /** Song name */
  name: string;
  /** Artist name */
  artist: string;
  /** Album (optional) */
  album?: string;
  /** Quality level */
  quality: UserQuality;
  /** Sync timestamp (ISO 8601) */
  syncedAt: string;
  /** Sync status */
  status: SyncStatus;
  /** File modification time (ISO 8601), for incremental scanning */
  fileModifiedAt: string;
  /** File size in bytes, for quick comparison */
  fileSize: number;
  /** Audio format */
  format: AudioFormat;
  /** Bitrate in kbps (optional) */
  bitrate?: number;
  /** Information source */
  source: 'filename' | 'metadata' | 'database';
}

/**
 * Database schema
 */
export interface Database {
  /** Database version */
  version: number;
  /** Last sync timestamp */
  lastSync?: string;
  /** Sync records */
  tracks: SyncRecord[];
}

/**
 * Create default config
 */
export function createDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

/**
 * Create empty database
 */
export function createEmptyDatabase(): Database {
  return {
    version: 2,
    lastSync: undefined,
    tracks: []
  };
}

/**
 * Validate config values
 */
export function validateConfig(config: Partial<Config>): string[] {
  const errors: string[] = [];
  
  if (config.concurrentDownloads !== undefined) {
    if (config.concurrentDownloads < 1 || config.concurrentDownloads > 10) {
      errors.push('concurrentDownloads must be between 1 and 10');
    }
  }
  
  if (config.preferredQuality !== undefined) {
    const validQualities: UserQuality[] = ['standard', 'high', 'lossless'];
    if (!validQualities.includes(config.preferredQuality)) {
      errors.push(`preferredQuality must be one of: ${validQualities.join(', ')}`);
    }
  }
  
  return errors;
}

/**
 * Get config key type
 */
export type ConfigKey = keyof Config;

/**
 * Available config keys for CLI
 */
export const CONFIG_KEYS: ConfigKey[] = [
  'musicDir',
  'downloadDir',
  'preferredQuality',
  'deleteOldOnUpgrade',
  'concurrentDownloads',
  'fileNameTemplate'
];

/**
 * Config key descriptions
 */
export const CONFIG_DESCRIPTIONS: Record<ConfigKey, string> = {
  musicDir: '本地音乐目录路径',
  downloadDir: '下载保存目录路径',
  preferredQuality: '首选音质 (standard/high/lossless)',
  deleteOldOnUpgrade: '升级时是否删除旧文件',
  concurrentDownloads: '并发下载数 (1-10)',
  fileNameTemplate: '文件命名模板'
};
