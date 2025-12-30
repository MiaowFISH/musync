/**
 * NCM file decryption service
 * Decrypts NetEase Cloud Music .ncm files to standard audio formats
 */

import { createDecipheriv } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { NCM_MAGIC_HEADER } from '../constants';
import { pathExists, ensureDirectorySync } from '../utils/file';
import { logger } from '../utils/logger';

// NCM AES core key (hardcoded, standard for all NCM files)
const NCM_CORE_KEY = Buffer.from([
  0x68, 0x7a, 0x48, 0x52, 0x41, 0x6d, 0x73, 0x6f,
  0x35, 0x6b, 0x49, 0x6e, 0x62, 0x61, 0x78, 0x57
]);

// NCM meta key for metadata decryption
const NCM_META_KEY = Buffer.from([
  0x23, 0x31, 0x34, 0x6c, 0x6a, 0x6b, 0x5f, 0x21,
  0x5c, 0x5d, 0x26, 0x30, 0x55, 0x3c, 0x27, 0x28
]);

/**
 * NCM file metadata
 */
export interface NcmMetadata {
  musicId: number;
  musicName: string;
  artist: Array<[string, number]>;  // [name, id]
  album: string;
  albumId: number;
  albumPic?: string;
  bitrate: number;
  duration: number;
  format: 'mp3' | 'flac';
}

/**
 * NCM decryption result
 */
export interface NcmDecryptResult {
  success: boolean;
  outputPath?: string;
  metadata?: NcmMetadata;
  error?: string;
}

/**
 * Build RC4 S-box
 */
function buildRc4Sbox(key: Buffer): Uint8Array {
  const sbox = new Uint8Array(256);
  
  // Initialize S-box
  for (let i = 0; i < 256; i++) {
    sbox[i] = i;
  }
  
  // KSA (Key Scheduling Algorithm)
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + sbox[i] + key[i % key.length]) & 0xff;
    // Swap
    [sbox[i], sbox[j]] = [sbox[j], sbox[i]];
  }
  
  return sbox;
}

/**
 * RC4 decryption using the S-box
 * NCM uses a modified RC4 where the keystream is generated differently
 */
function rc4Decrypt(data: Buffer, sbox: Uint8Array): Buffer {
  const result = Buffer.alloc(data.length);
  
  for (let i = 0; i < data.length; i++) {
    // NCM uses a specific formula for keystream generation
    const j = (i + 1) & 0xff;
    const k = (sbox[j] + sbox[(sbox[j] + j) & 0xff]) & 0xff;
    result[i] = data[i] ^ sbox[k];
  }
  
  return result;
}

/**
 * AES-128-ECB decryption
 */
function aesEcbDecrypt(data: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(true);
  
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Parse NCM file and extract components
 */
function parseNcmFile(filePath: string): {
  success: boolean;
  keyData?: Buffer;
  metaData?: Buffer;
  imageData?: Buffer;
  audioData?: Buffer;
  error?: string;
} {
  if (!pathExists(filePath)) {
    return { success: false, error: '文件不存在' };
  }
  
  try {
    const data = readFileSync(filePath);
    let offset = 0;
    
    // Check magic header
    const magic = data.subarray(0, 8);
    if (!magic.equals(NCM_MAGIC_HEADER)) {
      return { success: false, error: '不是有效的 NCM 文件' };
    }
    offset = 10; // Skip magic (8) + gap (2)
    
    // Read key data
    const keyLength = data.readUInt32LE(offset);
    offset += 4;
    const keyData = data.subarray(offset, offset + keyLength);
    offset += keyLength;
    
    // Read meta data
    const metaLength = data.readUInt32LE(offset);
    offset += 4;
    const metaData = metaLength > 0 ? data.subarray(offset, offset + metaLength) : undefined;
    offset += metaLength;
    
    // Skip CRC (4) + gap (5)
    offset += 9;
    
    // Read image data
    const imageLength = data.readUInt32LE(offset);
    offset += 4;
    const imageData = imageLength > 0 ? data.subarray(offset, offset + imageLength) : undefined;
    offset += imageLength;
    
    // Remaining is audio data
    const audioData = data.subarray(offset);
    
    return {
      success: true,
      keyData,
      metaData,
      imageData,
      audioData
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '解析文件失败'
    };
  }
}

/**
 * Decrypt RC4 key from NCM key data
 */
function decryptKey(keyData: Buffer): Buffer {
  // XOR each byte with 0x64
  const xored = Buffer.alloc(keyData.length);
  for (let i = 0; i < keyData.length; i++) {
    xored[i] = keyData[i] ^ 0x64;
  }
  
  // AES decrypt
  const decrypted = aesEcbDecrypt(xored, NCM_CORE_KEY);
  
  // Remove "neteasecloudmusic" prefix (17 bytes)
  return decrypted.subarray(17);
}

/**
 * Decrypt and parse metadata
 */
function decryptMetadata(metaData: Buffer): NcmMetadata | null {
  try {
    // XOR each byte with 0x63
    const xored = Buffer.alloc(metaData.length);
    for (let i = 0; i < metaData.length; i++) {
      xored[i] = metaData[i] ^ 0x63;
    }
    
    // Skip "163 key(Don't modify):" prefix (22 bytes) and decode base64
    const base64Data = xored.subarray(22).toString('utf8');
    const decoded = Buffer.from(base64Data, 'base64');
    
    // AES decrypt
    const decrypted = aesEcbDecrypt(decoded, NCM_META_KEY);
    
    // Parse JSON (skip "music:" prefix)
    const jsonStr = decrypted.toString('utf8').substring(6);
    const json = JSON.parse(jsonStr);
    
    return {
      musicId: json.musicId || 0,
      musicName: json.musicName || '',
      artist: json.artist || [],
      album: json.album || '',
      albumId: json.albumId || 0,
      albumPic: json.albumPic,
      bitrate: json.bitrate || 0,
      duration: json.duration || 0,
      format: json.format || 'mp3'
    };
  } catch (err) {
    logger.debug(`Failed to decrypt metadata: ${err}`);
    return null;
  }
}

/**
 * Decrypt NCM audio data
 */
function decryptAudio(audioData: Buffer, rc4Key: Buffer): Buffer {
  const sbox = buildRc4Sbox(rc4Key);
  return rc4Decrypt(audioData, sbox);
}

/**
 * Detect audio format from decrypted data
 */
function detectFormat(data: Buffer): 'mp3' | 'flac' {
  // FLAC signature: "fLaC"
  if (data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) {
    return 'flac';
  }
  
  // MP3 signatures: 0xFF 0xFB, 0xFF 0xFA, 0xFF 0xF3, 0xFF 0xF2 or ID3
  if ((data[0] === 0xff && (data[1] & 0xe0) === 0xe0) ||
      (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33)) {
    return 'mp3';
  }
  
  // Default to mp3
  return 'mp3';
}

/**
 * Decrypt a NCM file to standard audio format
 */
export function decryptNcmFile(
  inputPath: string,
  options: { outputDir?: string; overwrite?: boolean } = {}
): NcmDecryptResult {
  const { outputDir, overwrite = false } = options;
  
  logger.debug(`Decrypting NCM file: ${inputPath}`);
  
  // Parse NCM file
  const parsed = parseNcmFile(inputPath);
  if (!parsed.success || !parsed.keyData || !parsed.audioData) {
    return {
      success: false,
      error: parsed.error || '无法解析 NCM 文件'
    };
  }
  
  // Decrypt RC4 key
  let rc4Key: Buffer;
  try {
    rc4Key = decryptKey(parsed.keyData);
  } catch (err) {
    return {
      success: false,
      error: '无法解密密钥'
    };
  }
  
  // Decrypt metadata
  const metadata = parsed.metaData ? decryptMetadata(parsed.metaData) : null;
  
  // Decrypt audio
  let audioData: Buffer;
  try {
    audioData = decryptAudio(parsed.audioData, rc4Key);
  } catch (err) {
    return {
      success: false,
      error: '无法解密音频数据'
    };
  }
  
  // Detect format
  const format = metadata?.format || detectFormat(audioData);
  
  // Generate output filename
  const inputDir = dirname(inputPath);
  const inputName = basename(inputPath, '.ncm');
  const outputName = `${inputName}.${format}`;
  const outputPath = join(outputDir || inputDir, outputName);
  
  // Check if output exists
  if (pathExists(outputPath) && !overwrite) {
    logger.debug(`Output file already exists: ${outputPath}`);
    return {
      success: true,
      outputPath,
      metadata: metadata || undefined
    };
  }
  
  // Write output file
  try {
    ensureDirectorySync(dirname(outputPath));
    writeFileSync(outputPath, audioData);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '写入文件失败'
    };
  }
  
  logger.debug(`Decrypted to: ${outputPath}`);
  
  return {
    success: true,
    outputPath,
    metadata: metadata || undefined
  };
}

/**
 * Decrypt multiple NCM files
 */
export async function decryptNcmFiles(
  inputPaths: string[],
  options: { outputDir?: string; overwrite?: boolean; onProgress?: (current: number, total: number, path: string) => void } = {}
): Promise<{
  successful: NcmDecryptResult[];
  failed: NcmDecryptResult[];
}> {
  const { onProgress } = options;
  const successful: NcmDecryptResult[] = [];
  const failed: NcmDecryptResult[] = [];
  
  for (let i = 0; i < inputPaths.length; i++) {
    const inputPath = inputPaths[i];
    onProgress?.(i + 1, inputPaths.length, inputPath);
    
    const result = decryptNcmFile(inputPath, options);
    
    if (result.success) {
      successful.push(result);
    } else {
      failed.push({ ...result, outputPath: inputPath });
    }
  }
  
  return { successful, failed };
}

/**
 * Extract metadata from NCM file without decrypting audio
 */
export function extractNcmMetadata(filePath: string): NcmMetadata | null {
  const parsed = parseNcmFile(filePath);
  if (!parsed.success || !parsed.metaData) {
    return null;
  }
  
  return decryptMetadata(parsed.metaData);
}
