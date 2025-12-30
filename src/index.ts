#!/usr/bin/env bun
/**
 * musync - NetEase Cloud Music Playlist Sync Tool
 * CLI entry point
 */

import { Command } from 'commander';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION, DEFAULT_DATA_DIR } from './constants';
import { logger } from './utils/logger';
import { setDataDir } from './storage/config';

// Create main program
const program = new Command();

program
  .name(APP_NAME)
  .version(APP_VERSION, '-V, --version', '显示版本号')
  .description(APP_DESCRIPTION)
  .option('-d, --data-dir <path>', '数据目录路径', DEFAULT_DATA_DIR)
  .option('-v, --verbose', '启用详细日志')
  .helpOption('-h, --help', '显示帮助信息')
  .hook('preAction', (thisCommand) => {
    // Configure global options before any command runs
    const opts = thisCommand.opts();
    
    if (opts.verbose) {
      logger.configure({ verbose: true });
    }
    
    if (opts.dataDir && opts.dataDir !== DEFAULT_DATA_DIR) {
      setDataDir(opts.dataDir);
      logger.debug(`Using data directory: ${opts.dataDir}`);
    }
  });

// Import and register commands
async function registerCommands() {
  // Login command
  const { registerLoginCommand } = await import('./commands/login');
  registerLoginCommand(program);
  
  // Logout command
  const { registerLogoutCommand } = await import('./commands/logout');
  registerLogoutCommand(program);
  
  // Playlist command
  const { registerPlaylistCommand } = await import('./commands/playlist');
  registerPlaylistCommand(program);
  
  // Scan command
  const { registerScanCommand } = await import('./commands/scan');
  registerScanCommand(program);
  
  // Diff command
  const { registerDiffCommand } = await import('./commands/diff');
  registerDiffCommand(program);
  
  // Sync command
  const { registerSyncCommand } = await import('./commands/sync');
  registerSyncCommand(program);
  
  // Config command
  const { registerConfigCommand } = await import('./commands/config');
  registerConfigCommand(program);
}

// Main entry
async function main() {
  try {
    await registerCommands();
    await program.parseAsync(process.argv);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : '发生未知错误');
    process.exit(1);
  }
}

main();
