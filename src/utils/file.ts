/**
 * File utility functions for musync
 */

import { existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join, extname, dirname, parse as parsePath } from 'path';
import { SUPPORTED_AUDIO_FORMATS, type AudioFormat } from '../constants';

/**
 * Check if a path exists
 */
export function pathExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Check if path is a directory
 */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if path is a file
 */
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/**
 * Get file extension (lowercase, without dot)
 */
export function getExtension(path: string): string {
  return extname(path).slice(1).toLowerCase();
}

/**
 * Check if file is a supported audio format
 */
export function isAudioFile(path: string): boolean {
  const ext = getExtension(path);
  return (SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(ext);
}

/**
 * Get audio format from file path
 */
export function getAudioFormat(path: string): AudioFormat {
  const ext = getExtension(path);
  if ((SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(ext)) {
    return ext as AudioFormat;
  }
  return 'other';
}

/**
 * Recursively walk a directory and yield file paths
 */
export function* walkDirectory(
  dir: string,
  options: { recursive?: boolean; filter?: (path: string) => boolean } = {}
): Generator<string> {
  const { recursive = true, filter } = options;

  if (!isDirectory(dir)) {
    return;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory() && recursive) {
      yield* walkDirectory(fullPath, options);
    } else if (entry.isFile()) {
      if (!filter || filter(fullPath)) {
        yield fullPath;
      }
    }
  }
}

/**
 * Find all audio files in a directory
 */
export function findAudioFiles(dir: string, recursive = true): string[] {
  return [...walkDirectory(dir, { recursive, filter: isAudioFile })];
}

/**
 * Ensure a directory exists (create if not)
 */
export async function ensureDirectory(path: string): Promise<void> {
  if (!pathExists(path)) {
    await mkdir(path, { recursive: true });
  }
}

/**
 * Ensure directory exists (sync)
 */
export function ensureDirectorySync(path: string): void {
  if (!pathExists(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Read JSON file
 */
export async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON file
 */
export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await ensureDirectory(dirname(path));
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Delete file if exists
 */
export async function deleteFile(path: string): Promise<boolean> {
  try {
    if (pathExists(path)) {
      await unlink(path);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Parse filename into components
 */
export function parseFileName(filePath: string): {
  name: string;
  extension: string;
  directory: string;
  fullName: string;
} {
  const parsed = parsePath(filePath);
  return {
    name: parsed.name,
    extension: parsed.ext.slice(1).toLowerCase(),
    directory: parsed.dir,
    fullName: parsed.base
  };
}

/**
 * Sanitize filename for filesystem
 * Removes or replaces characters that are not allowed in filenames
 */
export function sanitizeFileName(name: string): string {
  // Replace characters not allowed in Windows/macOS/Linux filenames
  return name
    .replace(/[<>:"/\\|?*]/g, '_') // Windows reserved characters
    .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Control characters
    .replace(/\.+$/g, '') // Trailing dots
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .trim();
}

/**
 * Generate a unique filename in directory
 */
export function generateUniqueFileName(
  dir: string,
  baseName: string,
  extension: string
): string {
  let fileName = `${baseName}.${extension}`;
  let filePath = join(dir, fileName);
  let counter = 1;

  while (pathExists(filePath)) {
    fileName = `${baseName} (${counter}).${extension}`;
    filePath = join(dir, fileName);
    counter++;
  }

  return filePath;
}

/**
 * Get available disk space (in bytes)
 * Note: This is a simplified implementation
 */
export async function getAvailableDiskSpace(_path: string): Promise<number> {
  // Bun/Node don't have a direct API for this
  // In a real implementation, we might use OS-specific commands
  // For now, return a large number (10GB) as a placeholder
  return 10 * 1024 * 1024 * 1024;
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
