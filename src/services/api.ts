/**
 * NetEase Cloud Music API wrapper
 * Wraps @neteasecloudmusicapienhanced/api for consistent interface
 */

import {
  login_cellphone,
  login_qr_key,
  login_qr_create,
  login_qr_check,
  login_status,
  login_refresh,
  user_playlist,
  playlist_detail,
  playlist_track_all,
  song_detail,
  song_url_v1,
  song_download_url,
  check_music,
  captcha_sent
} from '@neteasecloudmusicapienhanced/api';
import { API_RETRY_COUNT, API_RETRY_BASE_DELAY } from '../constants';
import { logger } from '../utils/logger';

// SoundQualityType values - matches the API's const enum
type SoundQualityType = 'standard' | 'exhigh' | 'lossless' | 'hires' | 'jyeffect' | 'jymaster' | 'sky';

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for API calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = API_RETRY_COUNT,
  baseDelay = API_RETRY_BASE_DELAY
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.debug(`API call failed (attempt ${i + 1}/${maxRetries}): ${lastError.message}`);
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Phone login with password
 */
export async function loginWithPhone(
  phone: string,
  password: string,
  countryCode = '86'
): Promise<ApiResponse<{ cookie: string; userId: number; nickname: string }>> {
  try {
    const result = await withRetry(() =>
      login_cellphone({
        phone,
        password,
        countrycode: countryCode
      })
    );
    
    const body = result.body as Record<string, unknown>;
    if (body?.code === 200) {
      const account = body.account as Record<string, unknown> | undefined;
      const profile = body.profile as Record<string, unknown> | undefined;
      return {
        success: true,
        data: {
          cookie: (body.cookie as string) || '',
          userId: (account?.id as number) || (profile?.userId as number) || 0,
          nickname: (profile?.nickname as string) || ''
        }
      };
    }
    
    return {
      success: false,
      error: ((body?.message || body?.msg) as string) || '登录失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '登录失败'
    };
  }
}

/**
 * Phone login with captcha (verification code)
 */
export async function loginWithCaptcha(
  phone: string,
  captcha: string,
  countryCode = '86'
): Promise<ApiResponse<{ cookie: string; userId: number; nickname: string }>> {
  try {
    const result = await withRetry(() =>
      login_cellphone({
        phone,
        captcha,
        countrycode: countryCode
      })
    );
    
    const body = result.body as Record<string, unknown>;
    if (body?.code === 200) {
      const account = body.account as Record<string, unknown> | undefined;
      const profile = body.profile as Record<string, unknown> | undefined;
      return {
        success: true,
        data: {
          cookie: (body.cookie as string) || '',
          userId: (account?.id as number) || (profile?.userId as number) || 0,
          nickname: (profile?.nickname as string) || ''
        }
      };
    }
    
    return {
      success: false,
      error: ((body?.message || body?.msg) as string) || '登录失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '登录失败'
    };
  }
}

/**
 * Send captcha to phone
 */
export async function sendCaptcha(
  phone: string,
  countryCode = '86'
): Promise<ApiResponse<void>> {
  try {
    const result = await withRetry(() =>
      captcha_sent({
        phone,
        ctcode: countryCode
      })
    );
    
    const body = result.body as Record<string, unknown>;
    if (body?.code === 200) {
      return { success: true };
    }
    
    return {
      success: false,
      error: (body?.message as string) || '发送验证码失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '发送验证码失败'
    };
  }
}

/**
 * Generate QR code key for login
 */
export async function generateQRKey(): Promise<ApiResponse<{ key: string; url: string }>> {
  try {
    const result = await login_qr_key({});
    
    const body = result.body as Record<string, unknown>;
    const data = body?.data as Record<string, unknown> | undefined;
    if (body?.code === 200 && data?.unikey) {
      const key = data.unikey as string;
      return {
        success: true,
        data: {
          key,
          url: `https://music.163.com/login?codekey=${key}`
        }
      };
    }
    
    return {
      success: false,
      error: '生成二维码失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '生成二维码失败'
    };
  }
}

/**
 * Create QR code image
 */
export async function createQRCode(
  key: string,
  qrimg = true
): Promise<ApiResponse<{ qrimg?: string; qrurl: string }>> {
  try {
    const result = await login_qr_create({
      key,
      qrimg
    });
    
    const body = result.body as Record<string, unknown>;
    const data = body?.data as Record<string, unknown> | undefined;
    if (body?.code === 200) {
      return {
        success: true,
        data: {
          qrimg: data?.qrimg as string | undefined,
          qrurl: (data?.qrurl as string) || `https://music.163.com/login?codekey=${key}`
        }
      };
    }
    
    return {
      success: false,
      error: '创建二维码失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '创建二维码失败'
    };
  }
}

/**
 * Check QR code scan status
 */
export async function checkQRStatus(
  key: string
): Promise<ApiResponse<{ status: number; cookie?: string; nickname?: string; userId?: number }>> {
  try {
    const result = await login_qr_check({
      key
    });
    
    const body = result.body as Record<string, unknown>;
    const code = body?.code as number | undefined;
    const account = body?.account as Record<string, unknown> | undefined;
    
    return {
      success: true,
      data: {
        status: code || 0,
        cookie: body?.cookie as string | undefined,
        nickname: body?.nickname as string | undefined,
        userId: account?.id as number | undefined
      },
      code
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '检查二维码状态失败'
    };
  }
}

/**
 * Check login status
 */
export async function checkLoginStatus(
  cookie: string
): Promise<ApiResponse<{ isLoggedIn: boolean; userId?: number; nickname?: string }>> {
  try {
    const result = await login_status({ cookie });
    
    const body = result.body as Record<string, unknown>;
    const data = body?.data as Record<string, unknown> | undefined;
    const profile = data?.profile as Record<string, unknown> | undefined;
    
    return {
      success: true,
      data: {
        isLoggedIn: !!profile,
        userId: profile?.userId as number | undefined,
        nickname: profile?.nickname as string | undefined
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '检查登录状态失败'
    };
  }
}

/**
 * Refresh login
 */
export async function refreshLogin(
  cookie: string
): Promise<ApiResponse<{ cookie: string }>> {
  try {
    const result = await login_refresh({ cookie });
    
    if (result.body?.code === 200) {
      return {
        success: true,
        data: {
          cookie: result.body.cookie || cookie
        }
      };
    }
    
    return {
      success: false,
      error: '刷新登录失败',
      code: result.body?.code
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '刷新登录失败'
    };
  }
}

/**
 * Get user playlists
 */
export async function getUserPlaylists(
  uid: number,
  cookie: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ApiResponse<{ playlists: unknown[] }>> {
  try {
    const result = await withRetry(() =>
      user_playlist({
        uid,
        limit: options.limit || 50,
        offset: options.offset || 0,
        cookie
      })
    );
    
    const body = result.body as Record<string, unknown>;
    if (body?.code === 200) {
      return {
        success: true,
        data: {
          playlists: (body.playlist as unknown[]) || []
        }
      };
    }
    
    return {
      success: false,
      error: (body?.message as string) || '获取歌单失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌单失败'
    };
  }
}

/**
 * Get playlist detail
 */
export async function getPlaylistDetail(
  id: number,
  cookie: string
): Promise<ApiResponse<{ playlist: unknown }>> {
  try {
    const result = await withRetry(() =>
      playlist_detail({
        id,
        cookie
      })
    );
    
    const body = result.body as Record<string, unknown>;
    if (body?.code === 200) {
      return {
        success: true,
        data: {
          playlist: body.playlist
        }
      };
    }
    
    return {
      success: false,
      error: (body?.message as string) || '获取歌单详情失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌单详情失败'
    };
  }
}

/**
 * Get all tracks in a playlist
 */
export async function getPlaylistTracks(
  id: number,
  cookie: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ApiResponse<{ songs: unknown[]; privileges?: unknown[] }>> {
  try {
    const result = await withRetry(() =>
      playlist_track_all({
        id,
        limit: options.limit || 500,
        offset: options.offset || 0,
        cookie
      })
    );
    
    const body = result.body as Record<string, unknown>;
    if (body?.code === 200) {
      return {
        success: true,
        data: {
          songs: (body.songs as unknown[]) || [],
          privileges: body.privileges as unknown[] | undefined
        }
      };
    }
    
    return {
      success: false,
      error: (body?.message as string) || '获取歌曲列表失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌曲列表失败'
    };
  }
}

/**
 * Get song details by IDs
 */
export async function getSongDetails(
  ids: number[],
  cookie: string
): Promise<ApiResponse<{ songs: unknown[]; privileges?: unknown[] }>> {
  try {
    const result = await withRetry(() =>
      song_detail({
        ids: ids.join(','),
        cookie
      })
    );
    
    const body = result.body as Record<string, unknown>;
    if (body?.code === 200) {
      return {
        success: true,
        data: {
          songs: (body.songs as unknown[]) || [],
          privileges: body.privileges as unknown[] | undefined
        }
      };
    }
    
    return {
      success: false,
      error: (body?.message as string) || '获取歌曲详情失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌曲详情失败'
    };
  }
}

/**
 * Get song URL for streaming/download
 */
export async function getSongUrl(
  id: number,
  cookie: string,
  options: { level?: SoundQualityType; unblock?: boolean } = {}
): Promise<ApiResponse<{ url: string | null; br: number; size: number; type: string; level: string }>> {
  try {
    const level = options.level ?? 'lossless';
    const result = await withRetry(() =>
      song_url_v1({
        id,
        // Use type assertion to match the const enum expected by the API
        level: level as unknown as Parameters<typeof song_url_v1>[0]['level'],
        cookie
      })
    );
    
    const body = result.body as Record<string, unknown>;
    const data = body?.data as Array<Record<string, unknown>> | undefined;
    if (body?.code === 200 && data?.[0]) {
      const item = data[0];
      return {
        success: true,
        data: {
          url: item.url as string | null,
          br: (item.br as number) || 0,
          size: (item.size as number) || 0,
          type: (item.type as string) || 'mp3',
          level: (item.level as string) || level || 'standard'
        }
      };
    }
    
    return {
      success: false,
      error: '获取歌曲链接失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取歌曲链接失败'
    };
  }
}

/**
 * Get song download URL
 */
export async function getSongDownloadUrl(
  id: number,
  cookie: string,
  br = 999000
): Promise<ApiResponse<{ url: string | null; br: number; size: number; type: string }>> {
  try {
    const result = await withRetry(() =>
      song_download_url({
        id,
        br,
        cookie
      })
    );
    
    const body = result.body as Record<string, unknown>;
    const data = body?.data as Record<string, unknown> | undefined;
    if (body?.code === 200 && data) {
      return {
        success: true,
        data: {
          url: data.url as string | null,
          br: (data.br as number) || 0,
          size: (data.size as number) || 0,
          type: (data.type as string) || 'mp3'
        }
      };
    }
    
    return {
      success: false,
      error: '获取下载链接失败',
      code: body?.code as number | undefined
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '获取下载链接失败'
    };
  }
}

/**
 * Check if song is available
 */
export async function checkSongAvailable(
  id: number,
  br = 999000
): Promise<ApiResponse<{ available: boolean }>> {
  try {
    const result = await check_music({ id, br });
    
    return {
      success: true,
      data: {
        available: result.body?.success === true
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '检查歌曲可用性失败'
    };
  }
}
