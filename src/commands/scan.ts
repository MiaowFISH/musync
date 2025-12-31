/**
 * Scan command
 * Scan local music directories for audio files
 */

import { Command } from 'commander';
import { scanDirectory } from '../services/scanner';
import { loadConfig } from '../storage/config';
import { upsertRecords, getAllRecords } from '../storage/database';
import { logger } from '../utils/logger';
import {
  formatJsonSuccess,
  formatJsonError,
  truncate
} from '../utils/format';
import { formatFileSize, pathExists } from '../utils/file';
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
    .option('--incremental', '增量扫描（跳过未修改的文件）', true)
    .option('--full', '强制全量扫描')
    .option('--json', 'JSON格式输出')
    .action(async (path, options) => {
      const { recursive, updateDb, json, incremental, full } = options;
      
      // Determine scan mode: --full overrides --incremental
      const isIncremental = !full && incremental;
      
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
        if (isIncremental) {
          logger.info('模式: 增量扫描');
        } else {
          logger.info('模式: 全量扫描');
        }
        logger.newLine();
      }
      
      // Load existing records for incremental comparison
      const existingRecords = isIncremental ? await getAllRecords() : [];
      
      // Perform scan
      const result = await scanDirectory(scanPath, {
        recursive,
        incremental: isIncremental,
        existingRecords,
        onProgress: json ? undefined : (current, total, file) => {
          logger.progress(current, total, truncate(file, 50));
        }
      });
      
      // Update database if requested
      if (updateDb) {
        const now = new Date().toISOString();
        
        // Convert scanned tracks to sync records
        // All tracks are stored, those without songId get status='pending'
        if (result.tracks.length > 0) {
          const records: SyncRecord[] = result.tracks.map(t => ({
            localPath: t.filePath,
            songId: t.songId,
            name: t.name,
            artist: t.artist,
            album: t.album,
            quality: t.quality,
            syncedAt: now,
            status: t.songId !== undefined ? 'synced' as const : 'pending' as const,
            fileModifiedAt: t.fileModifiedAt,
            fileSize: t.fileSize,
            format: t.format,
            bitrate: t.bitrate,
            source: t.source
          }));
          
          await upsertRecords(records);
          logger.debug(`Updated ${records.length} records in database`);
        }
        
        // Mark deleted files in database (incremental scan only)
        if (isIncremental && result.deletedFiles > 0) {
          // Find records where the file no longer exists on disk
          const deletedRecords: SyncRecord[] = existingRecords
            .filter(r => !pathExists(r.localPath) && r.status !== 'deleted')
            .map(r => ({
              ...r,
              status: 'deleted' as const,
              syncedAt: now
            }));
          
          if (deletedRecords.length > 0) {
            await upsertRecords(deletedRecords);
            logger.debug(`Marked ${deletedRecords.length} records as deleted`);
          }
        }
      }
      
      // Display results
      if (json) {
        console.log(formatJsonSuccess({
          path: scanPath,
          mode: isIncremental ? 'incremental' : 'full',
          totalFiles: result.totalFiles,
          recognized: result.tracks.length,
          failed: result.failedFiles.length,
          newFiles: result.newFiles,
          skippedFiles: result.skippedFiles,
          updatedFiles: result.updatedFiles,
          deletedFiles: result.deletedFiles,
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
            filePath: t.filePath,
            fileModifiedAt: t.fileModifiedAt,
            isNew: !existingRecords.some(r => r.localPath === t.filePath)
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
      
      // Incremental scan statistics
      if (isIncremental) {
        console.log(`  新增文件: ${result.newFiles}`);
        console.log(`  跳过文件: ${result.skippedFiles}`);
        if (result.updatedFiles > 0) {
          console.log(`  更新文件: ${result.updatedFiles}`);
        }
        if (result.deletedFiles > 0) {
          console.log(`  删除文件: ${result.deletedFiles}`);
        }
      }
      
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
