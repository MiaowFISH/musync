# Quickstart: 优化歌曲扫描机制

**Feature**: 002-optimize-song-scan  
**Date**: 2025-12-31

## 概述

本功能优化了歌曲扫描机制，解决两个核心问题：
1. **性能问题**：使用 `parseFile` 替代全文件读取，显著减少 IO 操作
2. **数据存储问题**：支持存储无 songId 的本地歌曲

## 快速开始

### 1. 扫描本地音乐库

```bash
# 扫描配置的音乐目录
musync scan

# 扫描指定目录
musync scan /path/to/music

# 强制全量扫描（忽略增量检测）
musync scan --full
```

### 2. 查看扫描结果

```bash
# JSON 格式输出
musync scan --json
```

输出示例：
```
✓ 扫描完成

  总文件数: 1150
  识别成功: 1150
  新增文件: 50
  跳过文件: 1100
  扫描耗时: 2.35s
```

### 3. 数据库记录

扫描后，所有识别成功的歌曲都会存入数据库：
- 有 songId 的歌曲：status = `synced`
- 无 songId 的歌曲：status = `pending`（等待匹配）

## 关键变更

### Scanner 服务

**Before**:
```typescript
// 读取整个文件到内存
const buf = readFileSync(filePath);
const metadata = await mm.parseBuffer(buf);
```

**After**:
```typescript
// 使用 parseFile 只读取必要的头部数据
const metadata = await mm.parseFile(filePath, {
  duration: false,
  skipCovers: true
});
```

### Database 记录

**Before**:
```typescript
// 只存储有 songId 的歌曲
const records = tracks.filter(t => t.songId !== undefined);
```

**After**:
```typescript
// 存储所有识别成功的歌曲
const records = tracks.map(t => ({
  localPath: t.filePath,  // 主键
  songId: t.songId,       // 可选
  status: t.songId ? 'synced' : 'pending',
  // ...
}));
```

### SyncRecord 结构

新增字段：
```typescript
interface SyncRecord {
  // 新增：文件修改时间
  fileModifiedAt: string;
  // 新增：文件大小
  fileSize: number;
  // songId 改为可选
  songId?: number;
}
```

## 开发指南

### 1. 修改 Scanner 服务

编辑 `src/services/scanner.ts`：

```typescript
import { parseFile } from 'music-metadata';

export async function readAudioMetadata(filePath: string) {
  try {
    const metadata = await parseFile(filePath, {
      duration: false,
      skipCovers: true
    });
    return {
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album,
      bitrate: metadata.format.bitrate 
        ? Math.round(metadata.format.bitrate / 1000) 
        : undefined
    };
  } catch (err) {
    logger.debug(`Failed to read metadata: ${err}`);
    return null;
  }
}
```

### 2. 修改 Database 模块

编辑 `src/storage/database.ts`：

```typescript
// 使用 localPath 作为主键查找
export async function upsertRecord(record: SyncRecord): Promise<void> {
  const db = await loadDatabase();
  const existingIndex = db.tracks.findIndex(t => t.localPath === record.localPath);
  
  if (existingIndex >= 0) {
    db.tracks[existingIndex] = record;
  } else {
    db.tracks.push(record);
  }
  
  await saveDatabase(db);
}
```

### 3. 修改 Scan 命令

编辑 `src/commands/scan.ts`：

```typescript
// 存储所有识别成功的歌曲（不再过滤 songId）
const records: SyncRecord[] = result.tracks.map(t => ({
  localPath: t.filePath,
  songId: t.songId,
  name: t.name,
  artist: t.artist,
  quality: t.quality,
  status: t.songId ? 'synced' : 'pending',
  syncedAt: new Date().toISOString(),
  fileModifiedAt: t.fileModifiedAt,
  fileSize: t.fileSize,
  format: t.format,
  bitrate: t.bitrate,
  source: t.source
}));

await upsertRecords(records);
```

## 测试验证

### 性能测试

```bash
# 运行扫描并记录时间
time musync scan /path/to/large/library

# 期望：1000 首歌曲 < 10 秒
```

### 功能测试

```bash
# 1. 扫描包含无 ID3 标签的文件
musync scan /path/to/untagged/music

# 2. 验证数据库记录
# 检查 ~/.musync/database.json 中是否包含所有歌曲

# 3. 增量扫描测试
musync scan  # 第一次完整扫描
musync scan  # 第二次应该大部分被跳过
```

## 故障排除

### 问题：扫描后数据库为空

检查：
1. 确认音频文件格式受支持（mp3, flac, ogg 等）
2. 查看详细日志：`musync scan --verbose`
3. 确认文件权限

### 问题：增量扫描不工作

检查：
1. 确认使用的是最新版本数据库（version: 2）
2. 如需强制全量扫描：`musync scan --full`

### 问题：某些文件解析失败

原因可能是：
- 文件损坏
- 元数据格式不标准
- 文件被其他程序占用

解决方案：这些文件会被添加到 `failedFiles` 列表，使用 `--json` 查看详情。
