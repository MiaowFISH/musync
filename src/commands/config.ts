/**
 * Config command
 * View and modify application configuration
 */

import { Command } from 'commander';
import {
  loadConfig,
  resetConfig,
  getConfigValue,
  setConfigValue
} from '../storage/config';
import { getStats, cleanupDeletedRecords, syncWithFilesystem } from '../storage/database';
import { logger } from '../utils/logger';
import { formatJsonSuccess, formatJsonError, formatDateTime } from '../utils/format';
import type { Config, ConfigKey } from '../models/config';
import { CONFIG_KEYS, CONFIG_DESCRIPTIONS, validateConfig } from '../models/config';

/**
 * Display all configuration
 */
async function displayAllConfig(json: boolean): Promise<void> {
  const config = await loadConfig();
  
  if (json) {
    console.log(formatJsonSuccess({ config }));
    return;
  }
  
  logger.group('当前配置');
  
  for (const key of CONFIG_KEYS) {
    const value = config[key];
    const description = CONFIG_DESCRIPTIONS[key];
    const displayValue = value === undefined || value === '' ? '(未设置)' : String(value);
    console.log(`  ${key}: ${displayValue}`);
    console.log(`    ${description}`);
    console.log();
  }
}

/**
 * Display single config value
 */
async function displayConfigValue(key: ConfigKey, json: boolean): Promise<void> {
  const value = await getConfigValue(key);
  
  if (json) {
    console.log(formatJsonSuccess({ [key]: value }));
    return;
  }
  
  const displayValue = value === undefined || value === '' ? '(未设置)' : String(value);
  console.log(`${key}: ${displayValue}`);
}

/**
 * Set config value
 */
async function setConfig(key: ConfigKey, value: string, json: boolean): Promise<void> {
  // Parse value based on key type
  let parsedValue: unknown = value;
  
  if (key === 'concurrentDownloads') {
    parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue as number)) {
      if (json) {
        console.log(formatJsonError('INVALID_VALUE', '请输入有效的数字'));
      } else {
        logger.error('请输入有效的数字');
      }
      process.exit(1);
      return;
    }
  } else if (key === 'deleteOldOnUpgrade') {
    parsedValue = value.toLowerCase() === 'true' || value === '1';
  }
  
  // Validate
  const errors = validateConfig({ [key]: parsedValue } as Partial<Config>);
  if (errors.length > 0) {
    if (json) {
      console.log(formatJsonError('VALIDATION_ERROR', errors.join(', ')));
    } else {
      logger.error(errors.join('\n'));
    }
    process.exit(1);
    return;
  }
  
  // Save
  await setConfigValue(key, parsedValue as Config[ConfigKey]);
  
  if (json) {
    console.log(formatJsonSuccess({ message: '配置已更新', [key]: parsedValue }));
  } else {
    logger.success(`已设置 ${key} = ${parsedValue}`);
  }
}

/**
 * Reset all configuration
 */
async function resetAllConfig(json: boolean): Promise<void> {
  const config = await resetConfig();
  
  if (json) {
    console.log(formatJsonSuccess({ message: '配置已重置', config }));
  } else {
    logger.success('配置已重置为默认值');
  }
}

/**
 * Display database stats
 */
async function displayDatabaseStats(json: boolean): Promise<void> {
  const stats = await getStats();
  
  if (json) {
    console.log(formatJsonSuccess({ database: stats }));
    return;
  }
  
  logger.group('数据库状态');
  console.log(`  总记录数: ${stats.totalTracks}`);
  console.log(`  已同步: ${stats.syncedTracks}`);
  console.log(`  已升级: ${stats.upgradedTracks}`);
  console.log(`  已删除: ${stats.deletedTracks}`);
  console.log(`  最后同步: ${stats.lastSync ? formatDateTime(stats.lastSync) : '从未'}`);
}

/**
 * Clean database
 */
async function cleanDatabase(json: boolean): Promise<void> {
  // First sync with filesystem
  const syncResult = await syncWithFilesystem();
  
  // Then cleanup deleted records
  const cleanedCount = await cleanupDeletedRecords();
  
  if (json) {
    console.log(formatJsonSuccess({
      message: '数据库已清理',
      deleted: syncResult.deleted,
      cleaned: cleanedCount
    }));
  } else {
    logger.success(`数据库已清理`);
    console.log(`  检测到删除的文件: ${syncResult.deleted}`);
    console.log(`  清理的记录: ${cleanedCount}`);
  }
}

/**
 * Register config command
 */
export function registerConfigCommand(program: Command): void {
  program
    .command('config [key] [value]')
    .description('查看或修改配置')
    .option('--list', '列出所有配置')
    .option('--reset', '重置为默认值')
    .option('--db', '显示数据库状态')
    .option('--clean', '清理数据库（删除无效记录）')
    .option('--json', 'JSON格式输出')
    .action(async (key, value, options) => {
      const { list, reset, db, clean, json } = options;
      
      // Database operations
      if (db) {
        await displayDatabaseStats(json);
        return;
      }
      
      if (clean) {
        await cleanDatabase(json);
        return;
      }
      
      // Reset all config
      if (reset) {
        await resetAllConfig(json);
        return;
      }
      
      // List all config
      if (list || (!key && !value)) {
        await displayAllConfig(json);
        return;
      }
      
      // Validate key
      if (key && !CONFIG_KEYS.includes(key as ConfigKey)) {
        if (json) {
          console.log(formatJsonError('INVALID_KEY', `无效的配置键: ${key}`));
        } else {
          logger.error(`无效的配置键: ${key}`);
          logger.info(`可用的配置键: ${CONFIG_KEYS.join(', ')}`);
        }
        process.exit(1);
        return;
      }
      
      // Get or set
      if (key && !value) {
        await displayConfigValue(key as ConfigKey, json);
      } else if (key && value) {
        await setConfig(key as ConfigKey, value, json);
      }
    });
}
