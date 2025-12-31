# Data Model: 优化歌曲扫描机制

**Feature**: 002-optimize-song-scan  
**Date**: 2025-12-31

## Entity Changes

### SyncRecord (Modified)

同步记录，存储本地歌曲与在线歌曲的关联关系。

**变更说明**: 
- 主键从 `songId` 改为 `localPath`
- `songId` 改为可选字段
- 新增 `fileModifiedAt` 和 `fileSize` 字段用于增量扫描

```typescript
interface SyncRecord {
  /** 本地文件路径（主键） */
  localPath: string;
  
  /** 网易云歌曲ID（可选，匹配后填充） */
  songId?: number;
  
  /** 歌曲名称 */
  name: string;
  
  /** 艺术家 */
  artist: string;
  
  /** 专辑（可选） */
  album?: string;
  
  /** 音质等级 */
  quality: 'standard' | 'high' | 'lossless';
  
  /** 同步状态 */
  status: 'synced' | 'upgraded' | 'deleted' | 'pending';
  
  /** 同步时间（ISO 8601） */
  syncedAt: string;
  
  /** 文件修改时间（ISO 8601），用于增量扫描 */
  fileModifiedAt: string;
  
  /** 文件大小（字节），用于快速比较 */
  fileSize: number;
  
  /** 音频格式 */
  format: 'mp3' | 'flac' | 'wav' | 'ogg' | 'm4a' | 'aac' | 'ncm' | 'other';
  
  /** 比特率（kbps，可选） */
  bitrate?: number;
  
  /** 信息来源 */
  source: 'filename' | 'metadata' | 'database';
}
```

### Database (Modified)

数据库结构，版本号升级。

```typescript
interface Database {
  /** 数据库版本（升级为 2） */
  version: 2;
  
  /** 最后同步时间 */
  lastSync?: string;
  
  /** 同步记录列表 */
  tracks: SyncRecord[];
}
```

## State Transitions

### SyncRecord Status

```
┌─────────┐     扫描发现新文件     ┌─────────┐
│ (none)  │ ─────────────────────> │ pending │
└─────────┘                        └────┬────┘
                                        │
                                        │ 匹配在线歌曲成功
                                        ▼
┌─────────┐     质量升级后         ┌─────────┐
│upgraded │ <───────────────────── │ synced  │
└─────────┘                        └────┬────┘
                                        │
                                        │ 本地文件被删除
                                        ▼
                                   ┌─────────┐
                                   │ deleted │
                                   └─────────┘
```

状态说明：
- `pending`: 新扫描到的本地文件，尚未与在线歌曲匹配
- `synced`: 已与在线歌曲匹配同步
- `upgraded`: 歌曲质量已升级（下载了更高质量版本）
- `deleted`: 本地文件已被删除

## Validation Rules

### SyncRecord

| 字段 | 规则 |
|------|------|
| localPath | 必填，非空字符串，绝对路径 |
| songId | 可选，正整数 |
| name | 必填，非空字符串 |
| artist | 必填，非空字符串 |
| quality | 必填，枚举值 |
| status | 必填，枚举值 |
| fileModifiedAt | 必填，有效的 ISO 8601 日期字符串 |
| fileSize | 必填，非负整数 |

## Migration Strategy

### 从 v1 升级到 v2

1. 加载现有数据库
2. 对于每条现有记录：
   - 保留 `localPath` 作为新主键
   - 保留现有 `songId`（如果存在）
   - 从文件系统读取 `fileModifiedAt` 和 `fileSize`
   - 如果文件不存在，标记 status 为 `deleted`
3. 更新 version 为 2
4. 保存数据库

```typescript
async function migrateV1ToV2(db: DatabaseV1): Promise<DatabaseV2> {
  const newTracks: SyncRecord[] = [];
  
  for (const track of db.tracks) {
    const stats = await getFileStats(track.localPath);
    
    newTracks.push({
      ...track,
      fileModifiedAt: stats?.mtime.toISOString() ?? track.syncedAt,
      fileSize: stats?.size ?? 0,
      status: stats ? track.status : 'deleted'
    });
  }
  
  return {
    version: 2,
    lastSync: db.lastSync,
    tracks: newTracks
  };
}
```

## Index Strategy

为支持高效查询，建议建立以下逻辑索引：

| 查询场景 | 索引字段 |
|----------|----------|
| 按路径查找 | localPath (主键) |
| 按在线ID查找 | songId |
| 按状态筛选 | status |

注：由于使用 JSON 文件存储，索引为内存中的 Map 结构，在加载数据库时构建。
