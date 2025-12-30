/**
 * Login command
 * Handles user authentication with NetEase Cloud Music
 */

import { Command } from 'commander';
import { createInterface } from 'readline';
import {
  phoneLogin,
  captchaLogin,
  startQRLogin,
  pollQRLogin,
  emailLogin,
  checkAuth
} from '../services/auth';
import { logger } from '../utils/logger';
import { formatJsonSuccess, formatJsonError } from '../utils/format';

/**
 * Prompt user for input
 */
function prompt(question: string, hidden = false): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      // For password input, we need to handle it differently
      process.stdout.write(question);
      let input = '';
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      const onData = (char: string) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          console.log();
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (char === '\u007f' || char === '\b') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += char;
        }
      };
      
      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle phone login
 */
async function handlePhoneLogin(
  phone: string,
  options: { password?: string; captcha?: string; json?: boolean }
): Promise<void> {
  const { json } = options;
  
  // Determine login method
  if (options.captcha) {
    // Login with captcha
    logger.debug('Using captcha login');
    const result = await captchaLogin(phone, options.captcha);
    
    if (result.success) {
      if (json) {
        console.log(formatJsonSuccess({ userId: result.userId, nickname: result.nickname }));
      } else {
        logger.success(`登录成功，欢迎回来 ${result.nickname}`);
      }
    } else {
      if (json) {
        console.log(formatJsonError('LOGIN_FAILED', result.error || '登录失败'));
      } else {
        logger.error(result.error || '登录失败');
      }
      process.exit(1);
    }
    return;
  }
  
  // Login with password
  let password = options.password;
  
  if (!password) {
    // Prompt for password
    password = await prompt('Password: ', true);
  }
  
  if (!password) {
    if (json) {
      console.log(formatJsonError('MISSING_PASSWORD', '请提供密码'));
    } else {
      logger.error('请提供密码');
    }
    process.exit(1);
    return;
  }
  
  const result = await phoneLogin(phone, password);
  
  if (result.success) {
    if (json) {
      console.log(formatJsonSuccess({ userId: result.userId, nickname: result.nickname }));
    } else {
      logger.success(`登录成功，欢迎回来 ${result.nickname}`);
    }
  } else {
    if (json) {
      console.log(formatJsonError('LOGIN_FAILED', result.error || '登录失败'));
    } else {
      logger.error(result.error || '登录失败');
    }
    process.exit(1);
  }
}

/**
 * Handle QR code login
 */
async function handleQRLogin(json: boolean): Promise<void> {
  // Start QR login
  const qr = await startQRLogin();
  
  if (!qr.success || !qr.state) {
    if (json) {
      console.log(formatJsonError('QR_FAILED', qr.error || '生成二维码失败'));
    } else {
      logger.error(qr.error || '生成二维码失败');
    }
    process.exit(1);
    return;
  }
  
  // Display QR code
  if (!json) {
    console.log('\n请使用网易云音乐 App 扫描以下二维码登录:\n');
    
    if (qr.state.qrurl) {
      console.log(`链接: ${qr.state.qrurl}\n`);
    }
    
    // If we have a base64 image, we can't display it in terminal
    // Just show the URL
    console.log('(请在浏览器打开上方链接获取二维码图片)\n');
    console.log('等待扫描...\n');
  }
  
  // Poll for status
  const startTime = Date.now();
  const timeout = 2 * 60 * 1000; // 2 minutes
  
  while (Date.now() - startTime < timeout) {
    const status = await pollQRLogin(qr.state.key);
    
    switch (status.status) {
      case 'expired':
        if (json) {
          console.log(formatJsonError('QR_EXPIRED', '二维码已过期'));
        } else {
          logger.error('二维码已过期，请重新运行命令');
        }
        process.exit(3);
        return;
      
      case 'scanned':
        if (!json) {
          process.stdout.write('\r已扫描，请在手机上确认...');
        }
        break;
      
      case 'confirmed':
        if (status.result?.success) {
          if (json) {
            console.log(formatJsonSuccess({
              userId: status.result.userId,
              nickname: status.result.nickname
            }));
          } else {
            console.log();
            logger.success(`登录成功，欢迎回来 ${status.result.nickname}`);
          }
          return;
        }
        break;
      
      case 'waiting':
      default:
        // Continue polling
        break;
    }
    
    await sleep(2000);
  }
  
  // Timeout
  if (json) {
    console.log(formatJsonError('QR_TIMEOUT', '登录超时'));
  } else {
    logger.error('登录超时，请重新运行命令');
  }
  process.exit(3);
}

/**
 * Handle email login
 */
async function handleEmailLogin(
  email: string,
  options: { password?: string; json?: boolean }
): Promise<void> {
  const { json } = options;
  
  let password = options.password;
  
  if (!password) {
    password = await prompt('Password: ', true);
  }
  
  if (!password) {
    if (json) {
      console.log(formatJsonError('MISSING_PASSWORD', '请提供密码'));
    } else {
      logger.error('请提供密码');
    }
    process.exit(1);
    return;
  }
  
  const result = await emailLogin(email, password);
  
  if (result.success) {
    if (json) {
      console.log(formatJsonSuccess({ userId: result.userId, nickname: result.nickname }));
    } else {
      logger.success(`登录成功，欢迎回来 ${result.nickname}`);
    }
  } else {
    if (json) {
      console.log(formatJsonError('LOGIN_FAILED', result.error || '登录失败'));
    } else {
      logger.error(result.error || '登录失败');
    }
    process.exit(1);
  }
}

/**
 * Register login command
 */
export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('登录网易云音乐账户')
    .option('--phone <phone>', '手机号码')
    .option('--password <password>', '密码')
    .option('--captcha <code>', '验证码')
    .option('--qr', '使用二维码登录')
    .option('--email <email>', '邮箱地址')
    .option('--json', 'JSON格式输出')
    .action(async (options) => {
      const { phone, qr, email, json } = options;
      
      // Check if already logged in
      const auth = await checkAuth();
      if (auth.loggedIn) {
        if (json) {
          console.log(formatJsonSuccess({
            message: '已登录',
            userId: auth.userId,
            nickname: auth.nickname
          }));
        } else {
          logger.info(`已登录为: ${auth.nickname}`);
        }
        return;
      }
      
      // Determine login method
      if (qr) {
        await handleQRLogin(json);
      } else if (phone) {
        await handlePhoneLogin(phone, options);
      } else if (email) {
        await handleEmailLogin(email, options);
      } else {
        // Default to QR login
        if (!json) {
          logger.info('未指定登录方式，使用二维码登录...');
        }
        await handleQRLogin(json);
      }
    });
}
