/**
 * Logout command
 * Clears stored credentials
 */

import { Command } from 'commander';
import { logout, checkAuth } from '../services/auth';
import { logger } from '../utils/logger';
import { formatJsonSuccess } from '../utils/format';

/**
 * Register logout command
 */
export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('退出当前登录')
    .option('--json', 'JSON格式输出')
    .action(async (options) => {
      const { json } = options;
      
      // Check if logged in
      const auth = await checkAuth();
      
      if (!auth.loggedIn) {
        if (json) {
          console.log(formatJsonSuccess({ message: '未登录' }));
        } else {
          logger.info('当前未登录');
        }
        return;
      }
      
      // Perform logout
      await logout();
      
      if (json) {
        console.log(formatJsonSuccess({ message: '已退出登录' }));
      } else {
        logger.success('已退出登录');
      }
    });
}
