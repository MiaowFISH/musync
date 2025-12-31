# Research: 优化歌曲扫描机制

**Feature**: 002-optimize-song-scan  
**Date**: 2025-12-31

## Research Tasks

### 1. music-metadata 流式读取 vs 全文件读取

**问题**: 当前实现使用 `readFileSync` + `parseBuffer` 读取整个文件到内存

**研究结果**:

- **Decision**: 使用 `parseFile` 函数替代 `parseBuffer`
- **Rationale**: 
  - `music-metadata` 库的官方文档明确指出："Direct file access in Node.js is generally faster because it can 'jump' to various parts of the file without reading intermediate data."
  - `parseFile` 函数专为 Node.js 设计，可以直接从文件系统读取，支持随机访问文件的不同部分
  - 音频元数据通常存储在文件头部（ID3v2）或尾部（ID3v1、APE tag），不需要读取完整文件
- **Alternatives considered**:
  - `parseStream` + `createReadStream`: 流式读取，但无法随机访问，对于某些格式可能需要读取整个流
  - `parseBuffer`: 当前方案，需要将整个文件加载到内存
  - `parseFromTokenizer`: 低级API，灵活但复杂度高

**性能优化选项**:
```typescript
const options = {
  duration: false,      // 不计算精确时长（避免读取整个文件）
  skipCovers: true,     // 跳过封面图片提取（减少内存使用）
  skipPostHeaders: true // 跳过文件尾部的标签（对流式输入有益）
};
```

### 2. 数据库主键设计：支持无 songId 的记录

**问题**: 当前 `SyncRecord` 使用 `songId` 作为主键，无法存储没有在线匹配的本地歌曲

**研究结果**:

- **Decision**: 使用 `localPath` 作为主键，`songId` 改为可选字段
- **Rationale**:
  - 文件路径在文件系统中天然唯一
  - 支持先扫描本地文件，后续再与在线歌曲匹配
  - 匹配后可更新 `songId`，不会产生重复记录
- **Alternatives considered**:
  - 使用内容哈希作为主键：需要读取文件内容，与性能优化目标冲突
  - 使用自增ID：需要额外的ID生成机制，增加复杂度
  - 保持 songId 主键 + 为无 ID 歌曲生成临时负数 ID：hack方案，语义不清晰

**数据模型变更**:
```typescript
interface SyncRecord {
  // 主键：本地文件路径
  localPath: string;
  // 可选：网易云歌曲ID
  songId?: number;
  // 其他字段保持不变...
}
```

### 3. 增量扫描策略

**问题**: 如何检测文件是否需要重新扫描

**研究结果**:

- **Decision**: 使用文件修改时间（mtime）作为判断依据
- **Rationale**:
  - 文件系统原生支持，无需额外IO
  - 对于元数据更新（如修改标签）会触发mtime变化
  - 实现简单，性能开销最小
- **Alternatives considered**:
  - 文件内容哈希：需要读取整个文件，与性能优化目标冲突
  - 文件大小：无法检测元数据变化
  - 组合使用mtime + size：略微增加准确性，但增加复杂度

**数据模型变更**:
```typescript
interface SyncRecord {
  // 新增：文件修改时间（ISO 8601）
  fileModifiedAt: string;
  // 新增：文件大小（字节）
  fileSize: number;
}
```

### 4. Bun 运行时兼容性

**问题**: 项目使用 Bun 运行时，需确认 music-metadata 兼容性

**研究结果**:

- **Decision**: music-metadata 在 Bun 环境下可正常工作
- **Rationale**:
  - Bun 兼容 Node.js API，包括 fs 模块
  - music-metadata 是纯 ESM 模块，Bun 原生支持
  - 项目已在使用 music-metadata，证明基本兼容
- **验证方法**: 现有代码已经使用 music-metadata，只需更换解析方法

## Summary

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 元数据读取方式 | `parseFile` | 官方推荐，支持随机访问，不需加载整个文件 |
| 数据库主键 | `localPath` | 天然唯一，支持无songId记录 |
| 增量扫描检测 | 文件mtime | 系统原生支持，无额外IO |
| 解析选项 | `skipCovers: true` | 减少内存使用，封面通常不需要 |
