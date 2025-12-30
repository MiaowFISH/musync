/**
 * Configuration storage module
 */

import { join } from 'path';
import { DEFAULT_DATA_DIR, CONFIG_FILE, COOKIE_FILE } from '../constants';
import type { Config, CookieStore } from '../models/config';
import { createDefaultConfig } from '../models/config';
import { readJsonFile, writeJsonFile, pathExists, ensureDirectorySync } from '../utils/file';

let dataDir = DEFAULT_DATA_DIR;

/**
 * Set custom data directory
 */
export function setDataDir(dir: string): void {
  dataDir = dir;
  ensureDirectorySync(dataDir);
}

/**
 * Get current data directory
 */
export function getDataDir(): string {
  return dataDir;
}

/**
 * Get config file path
 */
function getConfigPath(): string {
  return join(dataDir, CONFIG_FILE);
}

/**
 * Get cookie file path
 */
function getCookiePath(): string {
  return join(dataDir, COOKIE_FILE);
}

/**
 * Load configuration
 */
export async function loadConfig(): Promise<Config> {
  ensureDirectorySync(dataDir);
  const configPath = getConfigPath();
  
  if (!pathExists(configPath)) {
    return createDefaultConfig();
  }
  
  const config = await readJsonFile<Config>(configPath);
  if (!config) {
    return createDefaultConfig();
  }
  
  // Merge with defaults to ensure all keys exist
  return {
    ...createDefaultConfig(),
    ...config
  };
}

/**
 * Save configuration
 */
export async function saveConfig(config: Config): Promise<void> {
  ensureDirectorySync(dataDir);
  await writeJsonFile(getConfigPath(), config);
}

/**
 * Update specific config values
 */
export async function updateConfig(updates: Partial<Config>): Promise<Config> {
  const config = await loadConfig();
  const newConfig = { ...config, ...updates };
  await saveConfig(newConfig);
  return newConfig;
}

/**
 * Get a specific config value
 */
export async function getConfigValue<K extends keyof Config>(key: K): Promise<Config[K]> {
  const config = await loadConfig();
  return config[key];
}

/**
 * Set a specific config value
 */
export async function setConfigValue<K extends keyof Config>(
  key: K,
  value: Config[K]
): Promise<void> {
  const config = await loadConfig();
  config[key] = value;
  await saveConfig(config);
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(): Promise<Config> {
  const defaultConfig = createDefaultConfig();
  await saveConfig(defaultConfig);
  return defaultConfig;
}

/**
 * Load cookie/auth data
 */
export async function loadCookie(): Promise<CookieStore | null> {
  ensureDirectorySync(dataDir);
  const cookiePath = getCookiePath();
  
  if (!pathExists(cookiePath)) {
    return null;
  }
  
  return readJsonFile<CookieStore>(cookiePath);
}

/**
 * Save cookie/auth data
 */
export async function saveCookie(cookie: CookieStore): Promise<void> {
  ensureDirectorySync(dataDir);
  await writeJsonFile(getCookiePath(), cookie);
}

/**
 * Clear cookie/auth data
 */
export async function clearCookie(): Promise<void> {
  const cookiePath = getCookiePath();
  if (pathExists(cookiePath)) {
    const { unlink } = await import('fs/promises');
    await unlink(cookiePath);
  }
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const cookie = await loadCookie();
  return cookie !== null && cookie.cookie.length > 0;
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<{ userId: number; nickname: string } | null> {
  const cookie = await loadCookie();
  if (!cookie) return null;
  return {
    userId: cookie.userId,
    nickname: cookie.nickname
  };
}
