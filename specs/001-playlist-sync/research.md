# Research: 网易云音乐歌单同步应用

**Date**: 2025-12-31  
**Feature**: 001-playlist-sync

## 1. NeteaseCloudMusicApiEnhanced 集成方案

### Decision: 使用 @neteasecloudmusicapienhanced/api 作为 npm 依赖直接调用

### Rationale
- NeteaseCloudMusicApiEnhanced 是原版 NeteaseCloudMusicApi 的增强版，提供更多功能
- 支持歌曲解灰（解锁）功能，可从 QQ音乐、酷狗、酷我、咪咕等平台获取音源
- 提供完整的 TypeScript 类型定义 (interface.d.ts)
- 支持直接在 Node.js/Bun 中以模块方式调用，无需启动 HTTP 服务
- v4.29.18 版本已修复密码登录和短信登录问题
- 新增音质等级支持：Hi-Res、高清环绕声、沉浸环绕声、杂比全景声、超清母带

### 官方文档
- GitHub: https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced
- 文档: https://neteasecloudmusicapienhanced.js.org/

### 关键 API 接口

| 功能 | 接口 | 参数 |
|------|------|------|
| 手机登录 | `login_cellphone` | phone, password/md5_password/captcha |
| 二维码key生成 | `login_qr_key` | - |
| 二维码生成 | `login_qr_create` | key, qrimg |
| 二维码状态检测 | `login_qr_check` | key |
| 登录状态 | `login_status` | cookie |
| 刷新登录 | `login_refresh` | - |
| 获取用户歌单 | `user_playlist` | uid, limit, offset |
| 获取歌单详情 | `playlist_detail` | id |
| 获取歌曲详情 | `song_detail` | ids (逗号分隔) |
| 获取音乐URL(v1) | `song_url_v1` | id, level, unblock |
| 获取下载URL(v1) | `song_download_url_v1` | id, level |
| 检查音乐可用 | `check_music` | id, br |
| 歌曲解锁匹配 | `song_url_match` | id, source |

### 音质等级 (level 参数)

| level | 说明 |
|-------|------|
| standard | 标准 |
| higher | 较高 |
| exhigh | 极高 |
| lossless | 无损 |
| hires | Hi-Res |
| jyeffect | 高清环绕声 |
| sky | 沉浸环绕声 |
| dolby | 杂比全景声 |
| jymaster | 超清母带 |

### Node.js/Bun 调用示例

```typescript
import {
  login_cellphone,
  user_playlist,
  playlist_detail,
  song_url_v1,
  song_download_url_v1,
} from '@neteasecloudmusicapienhanced/api'

// 登录
async function login(phone: string, password: string) {
  const result = await login_cellphone({ phone, password })
  return result.body.cookie
}

// 获取歌单
async function getPlaylists(uid: number, cookie: string) {
  const result = await user_playlist({ uid, cookie })
  return result.body.playlist
}

// 获取歌曲下载链接
async function getDownloadUrl(id: number, cookie: string) {
  const result = await song_download_url_v1({
    id,
    level: 'lossless',
    cookie,
  })
  return result.body.data
}
```

### 歌曲解灰功能

Enhanced 版本支持歌曲解灰，当原版歌曲无版权时，可从其他平台获取音源：

```typescript
import { song_url_v1 } from '@neteasecloudmusicapienhanced/api'

// 启用解灰
const result = await song_url_v1({
  id: 123456,
  level: 'exhigh',
  unblock: true,  // 启用解灰
  cookie,
})
```

### 注意事项
- 需要携带 cookie 才能访问大部分接口
- 接口有 2 分钟缓存，避免高频调用
- v4.29.7 后，某些接口需要带上 timestamp 参数
- 二维码登录调用时必须带上时间戳防止缓存

### Alternatives Considered
1. **原版 NeteaseCloudMusicApi**: 功能较少，不支持解灰，类型定义不完整
2. **自建 HTTP 服务**: 增加部署复杂度，不符合"避免过度设计"原则

---

## 2. 音频文件元数据读取

### Decision: 使用 music-metadata 库

### Rationale
- 纯 JavaScript 实现，与 Bun 兼容性好
- 支持所有主流音频格式：MP3(ID3v1/v2), FLAC, WAV, OGG, AAC 等
- 轻量级，无原生依赖
- 活跃维护，npm 周下载量超过百万

### 使用示例
```typescript
import { parseFile } from 'music-metadata';

const metadata = await parseFile('/path/to/song.mp3');
// metadata.common.title - 歌名
// metadata.common.artist - 歌手
// metadata.common.album - 专辑
// metadata.format.bitrate - 比特率
// metadata.format.codec - 编码格式
```

### Alternatives Considered
1. **node-id3**: 仅支持 MP3 格式，功能有限
2. **ffprobe**: 需要安装 FFmpeg，增加用户环境依赖

---

## 3. NCM 文件解密方案

### Decision: 使用纯 JavaScript 实现 NCM 解密

### Rationale
- NCM 格式解密算法已被逆向，可用纯 JS 实现
- 避免依赖外部可执行文件（如 ncmdump）
- 保持跨平台一致性

### NCM 文件结构
```
[Magic Header: 8 bytes] "CTENFDAM"
[Key Length: 4 bytes]
[Key Data: variable] (RC4加密的AES密钥)
[Meta Length: 4 bytes]
[Meta Data: variable] (AES加密的元信息JSON)
[CRC: 4 bytes]
[Gap: 5 bytes]
[Image Length: 4 bytes]
[Image Data: variable] (专辑封面)
[Audio Data: remaining] (RC4加密的音频数据)
```

### 解密流程
1. 读取并验证 Magic Header
2. 解密 RC4 密钥（使用内置 AES 密钥）
3. 解密音频元信息（JSON格式，包含歌曲信息）
4. 使用 RC4 密钥解密音频数据
5. 输出原始音频文件（MP3 或 FLAC）

### 依赖
- Node.js crypto 模块（Bun 内置）

### Alternatives Considered
1. **ncmdump 可执行文件**: 需要用户安装，跨平台兼容性问题
2. **ncm-rs npm 包**: 依赖 Rust 编译，增加构建复杂度

---

## 4. CLI 框架选择

### Decision: 使用 Commander.js

### Rationale
- 成熟稳定，生态完善
- API 简洁，学习成本低
- 自动生成帮助信息
- 支持子命令、选项、参数验证
- TypeScript 类型支持完善

### 命令设计
```
musync login           # 登录网易云账户
musync logout          # 退出登录
musync playlist        # 列出所有歌单
musync playlist <id>   # 查看指定歌单详情
musync scan [path]     # 扫描本地音乐库
musync diff <playlist> # 对比歌单与本地差异
musync sync <playlist> # 同步下载缺失歌曲
musync config          # 查看/修改配置

全局选项:
--data-dir <path>      # 指定数据目录
--verbose, -v          # 详细日志输出
--help, -h             # 显示帮助
--version              # 显示版本
```

### Alternatives Considered
1. **yargs**: 功能类似，但 API 稍显繁琐
2. **oclif**: 过于重量级，适合大型 CLI 框架
3. **cac**: 轻量但生态较小

---

## 5. 歌曲匹配算法

### Decision: 多层次匹配策略

### Rationale
- 单一匹配方式无法覆盖所有情况
- 需要在准确性和性能间平衡

### 匹配策略（按优先级）

1. **精确匹配**：本地数据库中已有网易云歌曲 ID 记录
   - 准确率: 100%

2. **文件名匹配**：解析 "歌名 - 歌手.后缀" 格式
   - 规则: `title - artist.ext` 或 `artist - title.ext`
   - 预处理: 去除空格、标点符号差异
   - 准确率: ~90%

3. **元数据匹配**：读取 ID3 标签
   - 字段: title + artist
   - 模糊匹配: 忽略大小写、处理 feat. / ft. 等变体
   - 准确率: ~85%

4. **模糊匹配**：相似度计算
   - 算法: 编辑距离 (Levenshtein) + 字符串相似度
   - 阈值: 相似度 > 0.8 视为匹配
   - 用途: 处理歌名略有不同的情况

### 字符串规范化
```typescript
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[（(].+[)）]/g, '')  // 移除括号内容
    .replace(/\s+/g, '')           // 移除空格
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ''); // 仅保留中英文和数字
}
```

---

## 6. 下载并发控制

### Decision: 使用 p-limit 限制并发数为 5

### Rationale
- 避免同时发起过多请求导致 IP 被限制
- 5 个并发在速度和稳定性间取得平衡
- 符合 SC-005 成功标准要求

### 实现方案
```typescript
import pLimit from 'p-limit';

const limit = pLimit(5);

const downloads = songs.map(song => 
  limit(() => downloadSong(song))
);

await Promise.all(downloads);
```

### 进度显示
- 使用简单的文本输出显示进度
- 格式: `[当前/总数] 正在下载: 歌名 - 歌手`
- verbose 模式下显示详细信息（URL、大小、速度）

---

## 7. 数据存储结构

### Decision: 单个 JSON 文件 + 配置文件分离

### 数据目录结构
```
~/.musync/
├── config.json      # 用户配置
├── cookie.json      # 登录凭证（敏感数据）
└── database.json    # 歌曲数据库
```

### config.json
```json
{
  "musicDir": "/path/to/music",
  "downloadDir": "/path/to/downloads",
  "preferredQuality": "flac",
  "deleteOldOnUpgrade": false,
  "concurrentDownloads": 5
}
```

### database.json
```json
{
  "version": 1,
  "lastSync": "2025-12-31T00:00:00Z",
  "tracks": [
    {
      "id": "网易云歌曲ID",
      "name": "歌名",
      "artist": "歌手",
      "album": "专辑",
      "localPath": "/path/to/file.mp3",
      "quality": "320k",
      "syncedAt": "2025-12-31T00:00:00Z"
    }
  ]
}
```

### Rationale
- JSON 格式易于调试和手动编辑
- 符合澄清会议决定
- 对于预期数据量（数千首歌）性能足够

---

## 8. 音质等级定义

### Decision: 统一的音质等级枚举（支持 Enhanced API 新等级）

| 等级 | API level | 说明 | 格式 |
|------|-----------|------|------|
| standard | standard | 标准 128kbps | MP3 |
| higher | higher | 较高 192kbps | MP3 |
| high | exhigh | 极高 320kbps | MP3 |
| lossless | lossless | 无损 ~1000kbps | FLAC |
| hires | hires | Hi-Res | FLAC |
| spatial | jyeffect/sky | 环绕声 | FLAC |
| dolby | dolby | 杂比全景声 | EC3 |
| master | jymaster | 超清母带 | FLAC |

### 音质比较逻辑
```typescript
const qualityRank: Record<string, number> = {
  'standard': 1,
  'higher': 2,
  'high': 3,      // exhigh
  'lossless': 4,
  'hires': 5,
  'spatial': 6,   // jyeffect/sky
  'dolby': 7,
  'master': 8,    // jymaster
};

// 简化版：用户常用的三个等级
type UserQuality = 'standard' | 'high' | 'lossless';

function canUpgrade(local: string, online: string): boolean {
  return (qualityRank[online] || 0) > (qualityRank[local] || 0);
}

// API level 映射
const qualityToLevel: Record<UserQuality, string> = {
  'standard': 'standard',
  'high': 'exhigh',
  'lossless': 'lossless',
};
```

---

## 9. 错误处理策略

### Decision: 分级错误处理 + 重试机制

### 错误分类
1. **可恢复错误**: 网络超时、临时限流
   - 策略: 自动重试（最多 3 次，指数退避）
   
2. **业务错误**: 歌曲无版权、需要 VIP
   - 策略: 记录跳过，继续处理其他歌曲
   
3. **致命错误**: 未登录、配置错误
   - 策略: 立即终止，提示用户

### 重试实现
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(baseDelay * Math.pow(2, i));
    }
  }
  throw new Error('Unreachable');
}
```

---

## 10. Bun 兼容性注意事项

### 已验证兼容
- Commander.js ✅
- music-metadata ✅
- Node.js crypto 模块 ✅
- 文件系统操作 ✅

### 需注意
- NeteaseCloudMusicApi 依赖 request/axios，需测试 Bun 兼容性
- 如遇问题可使用 `bun --bun` 强制 Bun 运行时
- 建议 package.json 指定 `"type": "module"` 使用 ESM

### 构建与发布
```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "test": "bun test"
  }
}
```
