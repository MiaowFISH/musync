/**
 * Scan command
 * Scan local music directories for audio files
 */

import { Command } from 'commander';
import { scanDirectory } from '../services/scanner';
import { loadConfig } from '../storage/config';
import { upsertRecords } from '../storage/database';
import { logger } from '../utils/logger';
import {
  formatJsonSuccess,
  formatJsonError,
  truncate
} from '../utils/format';
import { formatFileSize } from '../utils/file';
import type { SyncRecord } from '../models/config';

/**
 * Register scan command
 */
export function registerScanCommand(program: Command): void {
  program
    .command('scan [path]')
    .description('扫描本地音乐库')
    .option('--no-recursive', '不递归扫描子目录')
    .option('--no-update-db', '不更新本地数据库')
    .option('--json', 'JSON格式输出')
    .action(async (path, options) => {
      const { recursive, updateDb, json } = options;
      
      // Determine scan path
      let scanPath = path;
      
      if (!scanPath) {
        const config = await loadConfig();
        scanPath = config.musicDir;
      }
      
      if (!scanPath) {
        if (json) {
          console.log(formatJsonError('NO_PATH', '请指定扫描路径或设置 musicDir 配置'));
        } else {
          logger.error('请指定扫描路径或运行 musync config musicDir <path> 设置音乐目录');
        }
        process.exit(1);
        return;
      }
      
      // Display scan start
      if (!json) {
        logger.info(`扫描目录: ${scanPath}`);
        logger.newLine();
      }
      
      // Perform scan
      const result = await scanDirectory(scanPath, {
        recursive,
        onProgress: json ? undefined : (current, total, file) => {
          logger.progress(current, total, truncate(file, 50));
        }
      });
      
      // Update database if requested
      if (updateDb && result.tracks.length > 0) {
        // Convert tracks to sync records (without songId for now)
        const records: SyncRecord[] = result.tracks
          .filter(t => t.songId !== undefined)
          .map(t => ({
            songId: t.songId!,
            name: t.name,
            artist: t.artist,
            localPath: t.filePath,
            quality: t.quality,
            syncedAt: new Date().toISOString(),
            status: 'synced' as const
          }));
        
        if (records.length > 0) {
          await upsertRecords(records);
          logger.debug(`Updated ${records.length} records in database`);
        }
      }
      
      // Display results
      if (json) {
        console.log(formatJsonSuccess({
          path: scanPath,
          totalFiles: result.totalFiles,
          recognized: result.tracks.length,
          failed: result.failedFiles.length,
          formatDistribution: result.formatDistribution,
          scanDurationMs: result.scanDurationMs,
          tracks: result.tracks.map(t => ({
            name: t.name,
            artist: t.artist,
            album: t.album,
            quality: t.quality,
            format: t.format,
            fileSize: t.fileSize,
            bitrate: t.bitrate,
            source: t.source,
            filePath: t.filePath
          }))
        }));
        return;
      }
      
      // Console output
      logger.newLine();
      logger.success('扫描完成');
      logger.newLine();
      
      console.log(`  总文件数: ${result.totalFiles}`);
      console.log(`  识别成功: ${result.tracks.length}`);
      console.log(`  识别失败: ${result.failedFiles.length}`);
      
      // Format distribution
      if (Object.keys(result.formatDistribution).length > 0) {
        const formats = Object.entries(result.formatDistribution)
          .map(([format, count]) => `${format}(${count})`)
          .join(', ');
        console.log(`  格式分布: ${formats}`);
      }
      
      // Quality distribution
      const qualityDist: Record<string, number> = {};
      for (const track of result.tracks) {
        qualityDist[track.quality] = (qualityDist[track.quality] ?? 0) + 1;
      }
      
      if (Object.keys(qualityDist).length > 0) {
        const qualities = Object.entries(qualityDist)
          .map(([q, count]) => `${q}(${count})`)
          .join(', ');
        console.log(`  音质分布: ${qualities}`);
      }
      
      // Total size
      const totalSize = result.tracks.reduce((sum, t) => sum + t.fileSize, 0);
      console.log(`  总大小: ${formatFileSize(totalSize)}`);
      
      // Scan time
      console.log(`  扫描耗时: ${(result.scanDurationMs / 1000).toFixed(2)}s`);
      
      // Show failed files in verbose mode
      if (logger.isVerbose() && result.failedFiles.length > 0) {
        logger.newLine();
        logger.group('识别失败的文件');
        for (const file of result.failedFiles.slice(0, 10)) {
          console.log(`  ${file}`);
        }
        if (result.failedFiles.length > 10) {
          console.log(`  ... 还有 ${result.failedFiles.length - 10} 个文件`);
        }
      }
    });
}
