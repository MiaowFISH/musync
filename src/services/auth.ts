/**
 * Authentication service
 * Handles login flows, cookie management, and session state
 */

import {
  loginWithPhone,
  loginWithCaptcha,
  sendCaptcha,
  generateQRKey,
  createQRCode,
  checkQRStatus,
  checkLoginStatus,
  refreshLogin
} from './api';
import { loadCookie, saveCookie, clearCookie } from '../storage/config';
import type { CookieStore, QRLoginState } from '../models/config';
import { QR_CHECK_STATUS } from '../constants';
import { logger } from '../utils/logger';

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  userId?: number;
  nickname?: string;
  error?: string;
}

/**
 * Login with phone and password
 */
export async function phoneLogin(
  phone: string,
  password: string,
  countryCode = '86'
): Promise<LoginResult> {
  logger.debug(`Attempting phone login for ${phone}`);
  
  const result = await loginWithPhone(phone, password, countryCode);
  
  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || '登录失败'
    };
  }
  
  // Save cookie
  const cookieStore: CookieStore = {
    userId: result.data.userId,
    nickname: result.data.nickname,
    cookie: result.data.cookie,
    loginAt: new Date().toISOString(),
    loginMethod: 'phone'
  };
  
  await saveCookie(cookieStore);
  
  return {
    success: true,
    userId: result.data.userId,
    nickname: result.data.nickname
  };
}

/**
 * Login with phone and captcha (verification code)
 */
export async function captchaLogin(
  phone: string,
  captcha: string,
  countryCode = '86'
): Promise<LoginResult> {
  logger.debug(`Attempting captcha login for ${phone}`);
  
  const result = await loginWithCaptcha(phone, captcha, countryCode);
  
  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || '登录失败'
    };
  }
  
  // Save cookie
  const cookieStore: CookieStore = {
    userId: result.data.userId,
    nickname: result.data.nickname,
    cookie: result.data.cookie,
    loginAt: new Date().toISOString(),
    loginMethod: 'phone'
  };
  
  await saveCookie(cookieStore);
  
  return {
    success: true,
    userId: result.data.userId,
    nickname: result.data.nickname
  };
}

/**
 * Request captcha to be sent to phone
 */
export async function requestCaptcha(
  phone: string,
  countryCode = '86'
): Promise<{ success: boolean; error?: string }> {
  logger.debug(`Requesting captcha for ${phone}`);
  
  const result = await sendCaptcha(phone, countryCode);
  
  return {
    success: result.success,
    error: result.error
  };
}

/**
 * Start QR code login flow
 */
export async function startQRLogin(): Promise<{
  success: boolean;
  state?: QRLoginState;
  qrimg?: string;
  error?: string;
}> {
  logger.debug('Starting QR code login flow');
  
  // Generate key
  const keyResult = await generateQRKey();
  if (!keyResult.success || !keyResult.data) {
    return {
      success: false,
      error: keyResult.error || '生成二维码失败'
    };
  }
  
  // Create QR code
  const qrResult = await createQRCode(keyResult.data.key, true);
  if (!qrResult.success || !qrResult.data) {
    return {
      success: false,
      error: qrResult.error || '创建二维码失败'
    };
  }
  
  const now = Date.now();
  const state: QRLoginState = {
    key: keyResult.data.key,
    qrimg: qrResult.data.qrimg,
    qrurl: qrResult.data.qrurl,
    createdAt: now,
    expiresAt: now + 2 * 60 * 1000 // 2 minutes
  };
  
  return {
    success: true,
    state,
    qrimg: qrResult.data.qrimg
  };
}

/**
 * Poll QR code login status
 */
export async function pollQRLogin(
  key: string
): Promise<{
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired';
  result?: LoginResult;
}> {
  const result = await checkQRStatus(key);
  
  if (!result.success || !result.data) {
    return { status: 'expired' };
  }
  
  const status = result.data.status;
  
  switch (status) {
    case QR_CHECK_STATUS.EXPIRED:
      return { status: 'expired' };
    
    case QR_CHECK_STATUS.WAITING:
      return { status: 'waiting' };
    
    case QR_CHECK_STATUS.SCANNED:
      return { status: 'scanned' };
    
    case QR_CHECK_STATUS.CONFIRMED:
      if (result.data.cookie) {
        // Save cookie
        const cookieStore: CookieStore = {
          userId: result.data.userId || 0,
          nickname: result.data.nickname || '',
          cookie: result.data.cookie,
          loginAt: new Date().toISOString(),
          loginMethod: 'qr'
        };
        
        await saveCookie(cookieStore);
        
        return {
          status: 'confirmed',
          result: {
            success: true,
            userId: result.data.userId,
            nickname: result.data.nickname
          }
        };
      }
      return { status: 'expired' };
    
    default:
      return { status: 'waiting' };
  }
}

/**
 * Email login (placeholder - uses phone login API)
 */
export async function emailLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  logger.debug(`Attempting email login for ${email}`);
  
  // Note: NetEase Cloud Music API uses phone login API for email too
  // Email is used as username
  const result = await loginWithPhone(email, password);
  
  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || '登录失败'
    };
  }
  
  // Save cookie
  const cookieStore: CookieStore = {
    userId: result.data.userId,
    nickname: result.data.nickname,
    cookie: result.data.cookie,
    loginAt: new Date().toISOString(),
    loginMethod: 'email'
  };
  
  await saveCookie(cookieStore);
  
  return {
    success: true,
    userId: result.data.userId,
    nickname: result.data.nickname
  };
}

/**
 * Logout - clear stored credentials
 */
export async function logout(): Promise<void> {
  await clearCookie();
  logger.debug('Logged out, credentials cleared');
}

/**
 * Check if user is currently logged in
 */
export async function checkAuth(): Promise<{
  loggedIn: boolean;
  userId?: number;
  nickname?: string;
}> {
  const cookie = await loadCookie();
  
  if (!cookie || !cookie.cookie) {
    return { loggedIn: false };
  }
  
  // Verify login status with API
  const status = await checkLoginStatus(cookie.cookie);
  
  if (status.success && status.data?.isLoggedIn) {
    return {
      loggedIn: true,
      userId: status.data.userId || cookie.userId,
      nickname: status.data.nickname || cookie.nickname
    };
  }
  
  return { loggedIn: false };
}

/**
 * Get stored cookie for API calls
 */
export async function getCookie(): Promise<string | null> {
  const cookie = await loadCookie();
  return cookie?.cookie || null;
}

/**
 * Get current user ID
 */
export async function getUserId(): Promise<number | null> {
  const cookie = await loadCookie();
  return cookie?.userId || null;
}

/**
 * Refresh login session
 */
export async function refreshSession(): Promise<boolean> {
  const cookie = await loadCookie();
  
  if (!cookie || !cookie.cookie) {
    return false;
  }
  
  const result = await refreshLogin(cookie.cookie);
  
  if (result.success && result.data?.cookie) {
    cookie.cookie = result.data.cookie;
    cookie.loginAt = new Date().toISOString();
    await saveCookie(cookie);
    return true;
  }
  
  return false;
}

/**
 * Ensure user is logged in, throw error if not
 */
export async function requireAuth(): Promise<{
  userId: number;
  cookie: string;
}> {
  const cookie = await loadCookie();
  
  if (!cookie || !cookie.cookie) {
    throw new Error('请先登录: musync login');
  }
  
  return {
    userId: cookie.userId,
    cookie: cookie.cookie
  };
}
