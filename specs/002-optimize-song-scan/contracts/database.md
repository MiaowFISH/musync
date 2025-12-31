# Database API Contract

**Feature**: 002-optimize-song-scan  
**Date**: 2025-12-31

## 新增/修改的数据库操作

### getRecordByPath

按本地路径获取记录（新增为主要查询方式）。

```typescript
/**
 * 按本地路径获取同步记录
 * @param localPath 本地文件绝对路径
 * @returns 同步记录或 undefined
 */
async function getRecordByPath(localPath: string): Promise<SyncRecord | undefined>;
```

### getRecordBySongId

按歌曲ID获取记录（保留，但不再是主键查询）。

```typescript
/**
 * 按网易云歌曲ID获取同步记录
 * @param songId 网易云歌曲ID
 * @returns 同步记录或 undefined（可能返回多条记录中的第一条）
 */
async function getRecordBySongId(songId: number): Promise<SyncRecord | undefined>;
```

### upsertRecord (Modified)

更新或插入记录，使用 localPath 作为主键。

```typescript
/**
 * 更新或插入同步记录
 * 使用 localPath 作为主键判断是否为已存在记录
 * @param record 同步记录
 */
async function upsertRecord(record: SyncRecord): Promise<void>;
```

### upsertRecords (Modified)

批量更新或插入记录。

```typescript
/**
 * 批量更新或插入同步记录
 * @param records 同步记录数组
 */
async function upsertRecords(records: SyncRecord[]): Promise<void>;
```

### updateSongId (New)

为已存在的记录更新 songId。

```typescript
/**
 * 为本地歌曲更新 songId
 * @param localPath 本地文件路径
 * @param songId 网易云歌曲ID
 * @returns 是否更新成功
 */
async function updateSongId(localPath: string, songId: number): Promise<boolean>;
```

### getRecordsByStatus (New)

按状态获取记录列表。

```typescript
/**
 * 按状态获取同步记录
 * @param status 同步状态
 * @returns 同步记录数组
 */
async function getRecordsByStatus(status: SyncStatus): Promise<SyncRecord[]>;
```

### getPendingRecords (New)

获取待匹配的记录（status = 'pending'，即无 songId 的本地歌曲）。

```typescript
/**
 * 获取待匹配的同步记录
 * @returns 待匹配的同步记录数组
 */
async function getPendingRecords(): Promise<SyncRecord[]>;
```

## 索引管理

### 内存索引结构

```typescript
interface DatabaseIndex {
  /** 按路径索引 */
  byPath: Map<string, SyncRecord>;
  /** 按歌曲ID索引（一对多） */
  bySongId: Map<number, SyncRecord[]>;
}
```

### 索引构建

在 `loadDatabase` 时构建索引，在 `saveDatabase` 时更新。

```typescript
/**
 * 构建数据库索引
 * @param db 数据库对象
 * @returns 索引对象
 */
function buildIndex(db: Database): DatabaseIndex;
```

## 迁移 API

### migrateDatabase (New)

数据库版本迁移。

```typescript
/**
 * 迁移数据库到最新版本
 * @param db 旧版本数据库
 * @returns 新版本数据库
 */
async function migrateDatabase(db: Database): Promise<Database>;
```

## 错误处理

所有数据库操作应捕获以下错误：

| 错误类型 | 描述 | 处理方式 |
|----------|------|----------|
| FileNotFound | 数据库文件不存在 | 返回空数据库 |
| ParseError | JSON 解析失败 | 返回空数据库，记录警告 |
| WriteError | 写入失败 | 抛出错误，不静默失败 |
| MigrationError | 迁移失败 | 抛出错误，保留原数据库备份 |
