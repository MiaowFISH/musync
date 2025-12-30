# Data Model: 网易云音乐歌单同步应用

**Date**: 2025-12-31  
**Feature**: 001-playlist-sync

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐
│     User        │     │    Playlist     │
├─────────────────┤     ├─────────────────┤
│ id: number      │────<│ id: number      │
│ nickname: string│     │ name: string    │
│ avatarUrl: string     │ userId: number  │
│ vipType: number │     │ trackCount: int │
└─────────────────┘     │ coverUrl: string│
                        └────────┬────────┘
                                 │
                                 │ contains
                                 ▼
┌─────────────────┐     ┌─────────────────┐
│   LocalTrack    │     │      Song       │
├─────────────────┤     ├─────────────────┤
│ filePath: string│◄───►│ id: number      │
│ name: string    │     │ name: string    │
│ artist: string  │     │ artists: Artist[]
│ album: string   │     │ album: Album    │
│ quality: Quality│     │ duration: number│
│ format: string  │     │ qualities: []   │
│ songId?: number │     │ available: bool │
└─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
            ┌───────────────┐
            │  SyncRecord   │
            ├───────────────┤
            │ songId: number│
            │ localPath: str│
            │ quality: str  │
            │ syncedAt: Date│
            │ status: Status│
            └───────────────┘
```

## Core Types

### User (用户)

```typescript
interface User {
  /** 网易云用户ID */
  id: number;
  /** 用户昵称 */
  nickname: string;
  /** 头像URL */
  avatarUrl?: string;
  /** VIP类型: 0=非VIP, 11=黑胶VIP */
  vipType: number;
}
```

### Playlist (歌单)

```typescript
interface Playlist {
  /** 歌单ID */
  id: number;
  /** 歌单名称 */
  name: string;
  /** 创建者用户ID */
  userId: number;
  /** 创建者昵称 */
  creator: string;
  /** 歌曲数量 */
  trackCount: number;
  /** 封面图URL */
  coverUrl?: string;
  /** 描述 */
  description?: string;
  /** 歌曲ID列表（完整） */
  trackIds: number[];
  /** 歌曲详情（可能不完整，需通过song/detail获取） */
  tracks?: Song[];
}
```

### Song (歌曲)

```typescript
interface Song {
  /** 歌曲ID */
  id: number;
  /** 歌曲名称 */
  name: string;
  /** 歌手列表 */
  artists: Artist[];
  /** 专辑信息 */
  album: Album;
  /** 时长（毫秒） */
  duration: number;
  /** 可用音质列表 */
  availableQualities: Quality[];
  /** 是否可用（版权/地区限制） */
  available: boolean;
  /** 需要VIP才能播放 */
  needVip: boolean;
}

interface Artist {
  /** 歌手ID */
  id: number;
  /** 歌手名称 */
  name: string;
}

interface Album {
  /** 专辑ID */
  id: number;
  /** 专辑名称 */
  name: string;
  /** 封面URL */
  picUrl?: string;
}
```

### LocalTrack (本地曲目)

```typescript
interface LocalTrack {
  /** 文件绝对路径 */
  filePath: string;
  /** 解析出的歌名 */
  name: string;
  /** 解析出的歌手 */
  artist: string;
  /** 专辑（从元数据获取） */
  album?: string;
  /** 音质等级 */
  quality: Quality;
  /** 文件格式 */
  format: AudioFormat;
  /** 文件大小（字节） */
  fileSize: number;
  /** 比特率 */
  bitrate?: number;
  /** 关联的网易云歌曲ID（如已匹配） */
  songId?: number;
  /** 信息来源 */
  source: 'filename' | 'metadata' | 'database';
}

type AudioFormat = 'mp3' | 'flac' | 'wav' | 'ncm' | 'other';
```

### Quality (音质)

```typescript
// 用户配置使用的简化音质等级
type UserQuality = 'standard' | 'high' | 'lossless';

// API 支持的完整音质等级
type ApiLevel = 
  | 'standard'   // 标准 128kbps
  | 'higher'     // 较高 192kbps
  | 'exhigh'     // 极高 320kbps
  | 'lossless'   // 无损
  | 'hires'      // Hi-Res
  | 'jyeffect'   // 高清环绕声
  | 'sky'        // 沉浸环绕声
  | 'dolby'      // 杜比全景声
  | 'jymaster';  // 超清母带

// 用户音质到API level的映射
const QualityToLevel: Record<UserQuality, ApiLevel> = {
  standard: 'standard',
  high: 'exhigh',
  lossless: 'lossless'
};

// 音质等级配置
const QualityConfig = {
  standard: { label: '标准', format: 'mp3', rank: 1 },
  high:     { label: '高品质', format: 'mp3', rank: 2 },
  lossless: { label: '无损', format: 'flac', rank: 3 }
} as const;
```

### SyncRecord (同步记录)

```typescript
interface SyncRecord {
  /** 网易云歌曲ID */
  songId: number;
  /** 歌曲名称（冗余，便于显示） */
  name: string;
  /** 歌手名称（冗余，便于显示） */
  artist: string;
  /** 本地文件路径 */
  localPath: string;
  /** 已同步的音质 */
  quality: Quality;
  /** 同步时间 */
  syncedAt: string; // ISO 8601 格式
  /** 同步状态 */
  status: SyncStatus;
}

type SyncStatus = 
  | 'synced'      // 已同步
  | 'upgraded'    // 已升级音质
  | 'deleted';    // 本地文件已删除
```

### DiffResult (差异结果)

```typescript
interface DiffResult {
  /** 待下载的歌曲（本地缺失） */
  missing: Song[];
  /** 可升级音质的歌曲 */
  upgradable: UpgradableTrack[];
  /** 已匹配的歌曲 */
  matched: MatchedTrack[];
  /** 无法下载的歌曲（无版权等） */
  unavailable: Song[];
}

interface UpgradableTrack {
  song: Song;
  localTrack: LocalTrack;
  currentQuality: Quality;
  targetQuality: Quality;
}

interface MatchedTrack {
  song: Song;
  localTrack: LocalTrack;
}
```

## Storage Schema

### config.json

```typescript
interface Config {
  /** 本地音乐目录 */
  musicDir: string;
  /** 下载保存目录（默认同musicDir） */
  downloadDir?: string;
  /** 首选音质 */
  preferredQuality: Quality;
  /** 升级时是否删除旧文件 */
  deleteOldOnUpgrade: boolean;
  /** 并发下载数 */
  concurrentDownloads: number;
  /** 文件命名模板 */
  fileNameTemplate: string; // 默认: "{name} - {artist}"
}

const DEFAULT_CONFIG: Config = {
  musicDir: '',
  preferredQuality: 'lossless',
  deleteOldOnUpgrade: false,
  concurrentDownloads: 5,
  fileNameTemplate: '{name} - {artist}'
};
```

### cookie.json

```typescript
interface CookieStore {
  /** 用户ID */
  userId: number;
  /** 用户昵称 */
  nickname: string;
  /** Cookie字符串 */
  cookie: string;
  /** 登录时间 */
  loginAt: string;
  /** 过期时间（预估） */
  expiresAt?: string;
  /** 登录方式 */
  loginMethod: 'phone' | 'email' | 'qr';
}

/** 二维码登录状态 */
interface QRLoginState {
  /** 二维码唯一key */
  key: string;
  /** 二维码图片base64 (如果请求了qrimg参数) */
  qrimg?: string;
  /** 二维码URL */
  qrurl?: string;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间（通常2分钟） */
  expiresAt: number;
}

/** 二维码检测状态码 */
type QRCheckStatus = 
  | 800   // 二维码已过期
  | 801   // 等待扫码
  | 802   // 待确认（已扫码）
  | 803;  // 授权成功
```

### database.json

```typescript
interface Database {
  /** 数据库版本 */
  version: number;
  /** 最后同步时间 */
  lastSync?: string;
  /** 同步记录列表 */
  tracks: SyncRecord[];
}
```

## Validation Rules

### Song Matching

1. **歌曲ID匹配**：优先级最高，精确匹配
2. **歌名+歌手匹配**：
   - 歌名规范化后完全相等
   - 歌手名至少有一个匹配
3. **模糊匹配**：
   - 歌名相似度 > 0.8
   - 歌手相似度 > 0.8

### File Name Parsing

支持的文件名格式：
- `歌名 - 歌手.ext`
- `歌手 - 歌名.ext`
- `歌名.ext` (仅歌名)

规范化处理：
- 移除括号内容：`(Live)`, `（现场版）`
- 移除 feat 信息后缀
- 统一为小写比较
- 移除特殊字符

### Quality Detection

| 条件 | 判定音质 |
|------|----------|
| format=flac | lossless |
| format=mp3 && bitrate>=256 | high |
| format=mp3 && bitrate<256 | standard |
| format=wav | lossless |

## State Transitions

### Sync Status Flow

```
                    ┌──────────────┐
                    │   (new)      │
                    └──────┬───────┘
                           │ 首次同步
                           ▼
                    ┌──────────────┐
        ┌──────────►│   synced     │◄──────────┐
        │           └──────┬───────┘           │
        │                  │                   │
        │                  │ 发现更高音质       │
        │                  ▼                   │
        │           ┌──────────────┐           │
        │           │  upgraded    │───────────┘
        │           └──────────────┘  保留历史
        │
        │           ┌──────────────┐
        └───────────│   deleted    │
         重新下载    └──────────────┘
                           ▲
                           │ 本地文件被删除
                           │
```
