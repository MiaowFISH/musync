/**
 * Song matching service
 * Matches online songs with local tracks using various strategies
 */

import type { Song } from '../models/song';
import type { LocalTrack } from '../models/local-track';
import type { SyncRecord } from '../models/config';
import type { UserQuality } from '../constants';
import { QUALITY_RANK } from '../constants';
import { stringSimilarity } from '../utils/format';
import { logger } from '../utils/logger';

/**
 * Match result types
 */
export interface MatchResult {
  /** Matched song-track pairs */
  matched: MatchedPair[];
  /** Songs missing locally */
  missing: Song[];
  /** Local tracks that can be upgraded */
  upgradable: UpgradablePair[];
  /** Songs that are unavailable for download */
  unavailable: Song[];
}

export interface MatchedPair {
  song: Song;
  localTrack: LocalTrack;
  matchMethod: 'id' | 'exact' | 'fuzzy';
  confidence: number;
}

export interface UpgradablePair {
  song: Song;
  localTrack: LocalTrack;
  currentQuality: UserQuality;
  targetQuality: UserQuality;
}

/**
 * Normalize string for matching
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[（(].+[)）]/g, '') // Remove parenthetical content
    .replace(/\s+/g, '')         // Remove whitespace
    .replace(/feat\.?/gi, '')    // Remove "feat." variations
    .replace(/ft\.?/gi, '')      // Remove "ft." variations
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ''); // Keep only CJK and alphanumeric
}

/**
 * Check if artist names match
 */
export function artistsMatch(
  songArtists: Array<{ name: string }>,
  localArtist: string
): { match: boolean; confidence: number } {
  const normalizedLocal = normalizeString(localArtist);
  
  // Check if any song artist matches
  for (const artist of songArtists) {
    const normalizedSong = normalizeString(artist.name);
    
    // Exact match
    if (normalizedSong === normalizedLocal) {
      return { match: true, confidence: 1.0 };
    }
    
    // One contains the other
    if (normalizedSong.includes(normalizedLocal) || normalizedLocal.includes(normalizedSong)) {
      return { match: true, confidence: 0.9 };
    }
    
    // Fuzzy match
    const similarity = stringSimilarity(artist.name, localArtist);
    if (similarity > 0.8) {
      return { match: true, confidence: similarity };
    }
  }
  
  return { match: false, confidence: 0 };
}

/**
 * Check if song names match
 */
export function songNamesMatch(
  songName: string,
  localName: string
): { match: boolean; confidence: number } {
  const normalizedSong = normalizeString(songName);
  const normalizedLocal = normalizeString(localName);
  
  // Exact match
  if (normalizedSong === normalizedLocal) {
    return { match: true, confidence: 1.0 };
  }
  
  // One contains the other
  if (normalizedSong.includes(normalizedLocal) || normalizedLocal.includes(normalizedSong)) {
    // Prefer if the shorter one is mostly contained
    const shorter = normalizedSong.length < normalizedLocal.length ? normalizedSong : normalizedLocal;
    const longer = normalizedSong.length >= normalizedLocal.length ? normalizedSong : normalizedLocal;
    const containRatio = shorter.length / longer.length;
    
    if (containRatio > 0.5) {
      return { match: true, confidence: 0.85 + containRatio * 0.1 };
    }
  }
  
  // Fuzzy match
  const similarity = stringSimilarity(songName, localName);
  if (similarity > 0.8) {
    return { match: true, confidence: similarity };
  }
  
  return { match: false, confidence: 0 };
}

/**
 * Match a song against local tracks
 */
export function matchSong(
  song: Song,
  localTracks: LocalTrack[],
  syncRecords: SyncRecord[]
): { matched: boolean; track?: LocalTrack; method: 'id' | 'exact' | 'fuzzy'; confidence: number } {
  // 1. ID match from sync records
  const record = syncRecords.find(r => r.songId === song.id);
  if (record) {
    const track = localTracks.find(t => t.filePath === record.localPath);
    if (track) {
      return { matched: true, track, method: 'id', confidence: 1.0 };
    }
  }
  
  // 2. Tracks with songId already set
  const idTrack = localTracks.find(t => t.songId === song.id);
  if (idTrack) {
    return { matched: true, track: idTrack, method: 'id', confidence: 1.0 };
  }
  
  // 3. Name + Artist exact/fuzzy match
  let bestMatch: LocalTrack | undefined;
  let bestConfidence = 0;
  let bestMethod: 'exact' | 'fuzzy' = 'fuzzy';
  
  for (const track of localTracks) {
    // Check song name
    const nameMatch = songNamesMatch(song.name, track.name);
    if (!nameMatch.match) continue;
    
    // Check artist
    const artistMatch = artistsMatch(song.artists, track.artist);
    if (!artistMatch.match) continue;
    
    // Calculate overall confidence
    const confidence = (nameMatch.confidence + artistMatch.confidence) / 2;
    
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = track;
      bestMethod = confidence >= 0.95 ? 'exact' : 'fuzzy';
    }
  }
  
  if (bestMatch && bestConfidence > 0.75) {
    return { matched: true, track: bestMatch, method: bestMethod, confidence: bestConfidence };
  }
  
  return { matched: false, method: 'fuzzy', confidence: 0 };
}

/**
 * Compare quality levels
 */
export function compareQuality(
  localQuality: UserQuality,
  onlineQuality: string
): 'better' | 'same' | 'worse' {
  const localRank = QUALITY_RANK[localQuality] ?? 0;
  const onlineRank = QUALITY_RANK[onlineQuality] ?? 0;
  
  if (onlineRank > localRank) return 'better';
  if (onlineRank < localRank) return 'worse';
  return 'same';
}

/**
 * Get best available quality for a song
 */
export function getBestQuality(song: Song, preferredQuality: UserQuality): UserQuality {
  const available = song.availableQualities;
  
  // Check if preferred quality is available
  if (available.includes(preferredQuality)) {
    return preferredQuality;
  }
  
  // Check for lossless variants
  if (preferredQuality === 'lossless') {
    if (available.includes('lossless') || available.includes('hires')) {
      return 'lossless';
    }
    // Fall back to high
    if (available.includes('exhigh') || available.includes('high')) {
      return 'high';
    }
  }
  
  // Check for high variants
  if (preferredQuality === 'high') {
    if (available.includes('exhigh') || available.includes('high')) {
      return 'high';
    }
  }
  
  // Default to standard
  return 'standard';
}

/**
 * Match songs against local tracks and categorize results
 */
export function matchSongsWithTracks(
  songs: Song[],
  localTracks: LocalTrack[],
  syncRecords: SyncRecord[],
  targetQuality: UserQuality = 'lossless'
): MatchResult {
  const result: MatchResult = {
    matched: [],
    missing: [],
    upgradable: [],
    unavailable: []
  };
  
  const matchedTrackPaths = new Set<string>();
  
  for (const song of songs) {
    // Check availability
    if (!song.available) {
      result.unavailable.push(song);
      continue;
    }
    
    // Try to match
    const match = matchSong(song, localTracks, syncRecords);
    
    if (match.matched && match.track) {
      // Check if quality can be upgraded
      const bestOnline = getBestQuality(song, targetQuality);
      const qualityComparison = compareQuality(match.track.quality, bestOnline);
      
      if (qualityComparison === 'better') {
        result.upgradable.push({
          song,
          localTrack: match.track,
          currentQuality: match.track.quality,
          targetQuality: bestOnline
        });
      } else {
        result.matched.push({
          song,
          localTrack: match.track,
          matchMethod: match.method,
          confidence: match.confidence
        });
      }
      
      matchedTrackPaths.add(match.track.filePath);
    } else {
      result.missing.push(song);
    }
  }
  
  logger.debug(`Match results: ${result.matched.length} matched, ${result.missing.length} missing, ${result.upgradable.length} upgradable, ${result.unavailable.length} unavailable`);
  
  return result;
}

/**
 * Simple diff analysis between playlist and local tracks
 */
export function analyzeDiff(
  songs: Song[],
  localTracks: LocalTrack[],
  syncRecords: SyncRecord[],
  targetQuality: UserQuality = 'lossless'
): MatchResult {
  return matchSongsWithTracks(songs, localTracks, syncRecords, targetQuality);
}
