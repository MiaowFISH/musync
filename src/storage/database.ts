/**
 * Database storage module for sync records
 */

import { join } from 'path';
import { DATABASE_FILE } from '../constants';
import type { Database, SyncRecord } from '../models/config';
import { createEmptyDatabase } from '../models/config';
import { readJsonFile, writeJsonFile, pathExists, ensureDirectorySync } from '../utils/file';
import { getDataDir } from './config';

/**
 * Get database file path
 */
function getDatabasePath(): string {
  return join(getDataDir(), DATABASE_FILE);
}

/**
 * Load database
 */
export async function loadDatabase(): Promise<Database> {
  const dataDir = getDataDir();
  ensureDirectorySync(dataDir);
  
  const dbPath = getDatabasePath();
  
  if (!pathExists(dbPath)) {
    return createEmptyDatabase();
  }
  
  const db = await readJsonFile<Database>(dbPath);
  if (!db) {
    return createEmptyDatabase();
  }
  
  return db;
}

/**
 * Save database
 */
export async function saveDatabase(db: Database): Promise<void> {
  const dataDir = getDataDir();
  ensureDirectorySync(dataDir);
  await writeJsonFile(getDatabasePath(), db);
}

/**
 * Get all sync records
 */
export async function getAllRecords(): Promise<SyncRecord[]> {
  const db = await loadDatabase();
  return db.tracks;
}

/**
 * Get sync record by song ID
 */
export async function getRecordBySongId(songId: number): Promise<SyncRecord | undefined> {
  const db = await loadDatabase();
  return db.tracks.find(t => t.songId === songId);
}

/**
 * Get sync record by local path
 */
export async function getRecordByPath(localPath: string): Promise<SyncRecord | undefined> {
  const db = await loadDatabase();
  return db.tracks.find(t => t.localPath === localPath);
}

/**
 * Add or update sync record
 */
export async function upsertRecord(record: SyncRecord): Promise<void> {
  const db = await loadDatabase();
  const existingIndex = db.tracks.findIndex(t => t.songId === record.songId);
  
  if (existingIndex >= 0) {
    db.tracks[existingIndex] = record;
  } else {
    db.tracks.push(record);
  }
  
  db.lastSync = new Date().toISOString();
  await saveDatabase(db);
}

/**
 * Add multiple sync records
 */
export async function upsertRecords(records: SyncRecord[]): Promise<void> {
  const db = await loadDatabase();
  
  for (const record of records) {
    const existingIndex = db.tracks.findIndex(t => t.songId === record.songId);
    
    if (existingIndex >= 0) {
      db.tracks[existingIndex] = record;
    } else {
      db.tracks.push(record);
    }
  }
  
  db.lastSync = new Date().toISOString();
  await saveDatabase(db);
}

/**
 * Delete sync record by song ID
 */
export async function deleteRecordBySongId(songId: number): Promise<boolean> {
  const db = await loadDatabase();
  const initialLength = db.tracks.length;
  db.tracks = db.tracks.filter(t => t.songId !== songId);
  
  if (db.tracks.length < initialLength) {
    await saveDatabase(db);
    return true;
  }
  
  return false;
}

/**
 * Delete sync record by local path
 */
export async function deleteRecordByPath(localPath: string): Promise<boolean> {
  const db = await loadDatabase();
  const initialLength = db.tracks.length;
  db.tracks = db.tracks.filter(t => t.localPath !== localPath);
  
  if (db.tracks.length < initialLength) {
    await saveDatabase(db);
    return true;
  }
  
  return false;
}

/**
 * Mark record as deleted (file no longer exists)
 */
export async function markRecordDeleted(songId: number): Promise<void> {
  const db = await loadDatabase();
  const record = db.tracks.find(t => t.songId === songId);
  
  if (record) {
    record.status = 'deleted';
    record.syncedAt = new Date().toISOString();
    await saveDatabase(db);
  }
}

/**
 * Check database integrity (verify local files still exist)
 */
export async function checkIntegrity(): Promise<{
  valid: SyncRecord[];
  deleted: SyncRecord[];
}> {
  const db = await loadDatabase();
  const valid: SyncRecord[] = [];
  const deleted: SyncRecord[] = [];
  
  for (const record of db.tracks) {
    if (record.status === 'deleted') {
      deleted.push(record);
      continue;
    }
    
    if (pathExists(record.localPath)) {
      valid.push(record);
    } else {
      deleted.push(record);
    }
  }
  
  return { valid, deleted };
}

/**
 * Clean up deleted records
 */
export async function cleanupDeletedRecords(): Promise<number> {
  const db = await loadDatabase();
  const initialLength = db.tracks.length;
  db.tracks = db.tracks.filter(t => t.status !== 'deleted');
  
  const removedCount = initialLength - db.tracks.length;
  
  if (removedCount > 0) {
    await saveDatabase(db);
  }
  
  return removedCount;
}

/**
 * Synchronize database with filesystem
 * Marks records as deleted if local files don't exist
 */
export async function syncWithFilesystem(): Promise<{
  updated: number;
  deleted: number;
}> {
  const { valid, deleted } = await checkIntegrity();
  
  if (deleted.length === 0) {
    return { updated: 0, deleted: 0 };
  }
  
  const db = await loadDatabase();
  
  // Update deleted records
  for (const record of deleted) {
    const dbRecord = db.tracks.find(t => t.songId === record.songId);
    if (dbRecord && dbRecord.status !== 'deleted') {
      dbRecord.status = 'deleted';
      dbRecord.syncedAt = new Date().toISOString();
    }
  }
  
  await saveDatabase(db);
  
  return {
    updated: valid.length,
    deleted: deleted.length
  };
}

/**
 * Get database statistics
 */
export async function getStats(): Promise<{
  totalTracks: number;
  syncedTracks: number;
  upgradedTracks: number;
  deletedTracks: number;
  lastSync: string | undefined;
}> {
  const db = await loadDatabase();
  
  return {
    totalTracks: db.tracks.length,
    syncedTracks: db.tracks.filter(t => t.status === 'synced').length,
    upgradedTracks: db.tracks.filter(t => t.status === 'upgraded').length,
    deletedTracks: db.tracks.filter(t => t.status === 'deleted').length,
    lastSync: db.lastSync
  };
}

/**
 * Reset database
 */
export async function resetDatabase(): Promise<void> {
  await saveDatabase(createEmptyDatabase());
}
