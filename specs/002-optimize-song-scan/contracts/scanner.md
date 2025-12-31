# Scanner Service Contract

**Feature**: 002-optimize-song-scan  
**Date**: 2025-12-31

## 核心变更

### readAudioMetadata (Modified)

使用 `parseFile` 替代 `parseBuffer`，避免全文件读取。

```typescript
/**
 * 读取音频文件元数据
 * 使用 parseFile 进行流式读取，只读取必要的头部数据
 * 
 * @param filePath 文件绝对路径
 * @param options 解析选项
 * @returns 元数据对象或 null
 */
async function readAudioMetadata(
  filePath: string,
  options?: {
    skipCovers?: boolean;  // 默认 true
  }
): Promise<{
  title?: string;
  artist?: string;
  album?: string;
  bitrate?: number;
  duration?: number;
} | null>;
```

**实现要点**:
```typescript
import { parseFile } from 'music-metadata';

const metadata = await parseFile(filePath, {
  duration: false,       // 不需要精确时长
  skipCovers: true,      // 跳过封面，减少内存
  skipPostHeaders: true  // 跳过尾部标签（如有需要可调整）
});
```

### scanAudioFile (Modified)

增加文件统计信息的获取。

```typescript
/**
 * 扫描单个音频文件
 * 
 * @param filePath 文件绝对路径
 * @param options 扫描选项
 * @returns LocalTrack 或 null
 */
async function scanAudioFile(
  filePath: string,
  options?: {
    decryptNcm?: boolean;
  }
): Promise<LocalTrack | null>;
```

**返回的 LocalTrack 新增字段**:
```typescript
interface LocalTrack {
  // ... 现有字段 ...
  
  /** 文件修改时间（ISO 8601） */
  fileModifiedAt: string;
}
```

### scanDirectory (Modified)

支持增量扫描模式。

```typescript
/**
 * 扫描目录获取音频文件
 * 
 * @param dir 目录路径
 * @param options 扫描选项
 * @returns 扫描结果
 */
async function scanDirectory(
  dir: string,
  options?: {
    recursive?: boolean;
    incremental?: boolean;           // 新增：增量扫描模式
    existingRecords?: SyncRecord[];  // 新增：现有记录（用于增量比较）
    onProgress?: (current: number, total: number, file: string) => void;
  }
): Promise<ScanResult>;
```

### ScanResult (Modified)

扩展扫描结果以支持增量扫描统计。

```typescript
interface ScanResult {
  /** 总文件数 */
  totalFiles: number;
  
  /** 成功解析的轨道 */
  tracks: LocalTrack[];
  
  /** 解析失败的文件 */
  failedFiles: string[];
  
  /** 格式分布 */
  formatDistribution: Record<string, number>;
  
  /** 扫描耗时（毫秒） */
  scanDurationMs: number;
  
  // 新增字段
  
  /** 新增文件数 */
  newFiles: number;
  
  /** 跳过的文件数（增量扫描时未变化的文件） */
  skippedFiles: number;
  
  /** 更新的文件数（文件已变化需重新解析） */
  updatedFiles: number;
  
  /** 删除的文件数（数据库中存在但文件系统中不存在） */
  deletedFiles: number;
}
```

## 增量扫描算法

```typescript
async function incrementalScan(
  dir: string,
  existingRecords: SyncRecord[]
): Promise<ScanResult> {
  // 1. 构建现有记录索引
  const recordsByPath = new Map(
    existingRecords.map(r => [r.localPath, r])
  );
  
  // 2. 获取目录中所有音频文件
  const currentFiles = findAudioFiles(dir, recursive);
  
  // 3. 分类处理
  const newFiles: string[] = [];
  const changedFiles: string[] = [];
  const unchangedFiles: string[] = [];
  
  for (const file of currentFiles) {
    const existing = recordsByPath.get(file);
    
    if (!existing) {
      // 新文件
      newFiles.push(file);
    } else {
      const stats = getFileStats(file);
      if (hasFileChanged(existing, stats)) {
        // 文件已修改
        changedFiles.push(file);
      } else {
        // 文件未变化
        unchangedFiles.push(file);
      }
      recordsByPath.delete(file);
    }
  }
  
  // 4. 剩余的记录对应已删除的文件
  const deletedFiles = Array.from(recordsByPath.keys());
  
  // 5. 只解析新文件和变化的文件
  const filesToParse = [...newFiles, ...changedFiles];
  
  // 6. 返回结果
  return {
    tracks: await parseFiles(filesToParse),
    newFiles: newFiles.length,
    updatedFiles: changedFiles.length,
    skippedFiles: unchangedFiles.length,
    deletedFiles: deletedFiles.length,
    // ...
  };
}

function hasFileChanged(record: SyncRecord, stats: FileStats): boolean {
  return (
    record.fileSize !== stats.size ||
    record.fileModifiedAt !== stats.mtime.toISOString()
  );
}
```

## 性能保证

| 指标 | 要求 |
|------|------|
| 单文件解析内存 | < 10MB |
| 1000 文件扫描时间（SSD） | < 10s |
| 1000 文件增量扫描时间 | < 2s（无变化时） |
| 并发解析 | 串行处理，避免内存峰值 |

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 文件读取失败 | 加入 failedFiles，继续处理下一个 |
| 元数据解析失败 | 回退到文件名解析 |
| 文件被占用 | 跳过，记录警告 |
| 权限不足 | 跳过，记录警告 |
