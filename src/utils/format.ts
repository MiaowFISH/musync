/**
 * Format utility functions for musync
 * Handles output formatting for CLI display
 */

import type { UserQuality } from '../constants';
import { QUALITY_CONFIG } from '../constants';

/**
 * Format duration from milliseconds to mm:ss
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration from seconds to mm:ss
 */
export function formatDurationSec(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format quality level for display
 */
export function formatQuality(quality: UserQuality): string {
  return QUALITY_CONFIG[quality]?.label ?? quality;
}

/**
 * Format bitrate for display
 */
export function formatBitrate(bitrate: number): string {
  if (bitrate >= 1000) {
    return `${(bitrate / 1000).toFixed(0)}kbps`;
  }
  return `${bitrate}kbps`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Pad string to fixed width (handling CJK characters)
 */
export function padString(str: string, width: number, align: 'left' | 'right' = 'left'): string {
  // Calculate visual width (CJK characters take 2 spaces)
  const visualWidth = getVisualWidth(str);
  const padLength = Math.max(0, width - visualWidth);

  if (align === 'right') {
    return ' '.repeat(padLength) + str;
  }
  return str + ' '.repeat(padLength);
}

/**
 * Get visual width of string (CJK characters count as 2)
 */
export function getVisualWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    const code = char.charCodeAt(0);
    // CJK characters: U+4E00-U+9FFF
    // Full-width characters: U+FF00-U+FFEF
    // CJK extensions and symbols
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0x3000 && code <= 0x303F) ||
      (code >= 0x3040 && code <= 0x309F) || // Hiragana
      (code >= 0x30A0 && code <= 0x30FF) || // Katakana
      (code >= 0xAC00 && code <= 0xD7AF)    // Korean
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Format artist list to string
 */
export function formatArtists(artists: { name: string }[]): string {
  return artists.map(a => a.name).join(', ');
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/**
 * Create a simple table row
 */
export function tableRow(columns: string[], widths: number[]): string {
  return columns.map((col, i) => padString(col, widths[i])).join('  ');
}

/**
 * Create a table separator line
 */
export function tableSeparator(widths: number[]): string {
  return widths.map(w => '─'.repeat(w)).join('──');
}

/**
 * Normalize string for comparison
 * Removes parenthetical content, normalizes whitespace, lowercases
 */
export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[（(].+[)）]/g, '') // Remove parenthetical content
    .replace(/\s+/g, '')         // Remove all whitespace
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ''); // Keep only CJK, alphanumeric
}

/**
 * Calculate string similarity (0-1)
 * Uses a simple character-based comparison
 */
export function stringSimilarity(a: string, b: string): number {
  const na = normalizeForComparison(a);
  const nb = normalizeForComparison(b);
  
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(na, nb);
  const maxLength = Math.max(na.length, nb.length);
  
  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Format CLI response for JSON output
 */
export function formatJsonResponse<T>(success: boolean, data: T | null, error?: { code: string; message: string }): string {
  return JSON.stringify({
    success,
    data,
    error: error ?? null
  }, null, 2);
}

/**
 * Format error response for JSON output
 */
export function formatJsonError(code: string, message: string): string {
  return formatJsonResponse(false, null, { code, message });
}

/**
 * Format success response for JSON output
 */
export function formatJsonSuccess<T>(data: T): string {
  return formatJsonResponse(true, data);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}
