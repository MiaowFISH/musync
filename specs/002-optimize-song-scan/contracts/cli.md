# CLI Contract: scan 命令

**Feature**: 002-optimize-song-scan  
**Date**: 2025-12-31

## 命令签名

```
musync scan [path] [options]
```

## 参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| path | string | 否 | 扫描路径，默认使用配置的 musicDir |

## 选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| --no-recursive | flag | false | 不递归扫描子目录 |
| --no-update-db | flag | false | 不更新本地数据库 |
| --incremental | flag | true | 增量扫描（跳过未修改的文件） |
| --full | flag | false | 强制全量扫描 |
| --json | flag | false | JSON格式输出 |

## 输出格式

### 标准输出（Human-readable）

```
扫描目录: /path/to/music

扫描进度: [██████████] 100% (1150/1150) current-file.mp3

✓ 扫描完成

  总文件数: 1150
  识别成功: 1150
  识别失败: 0
  新增文件: 50
  跳过文件: 1100
  格式分布: flac(810), mp3(339), ogg(1)
  音质分布: lossless(810), standard(158), high(182)
  总大小: 35.2 GB
  扫描耗时: 2.35s
```

### JSON输出

```json
{
  "success": true,
  "data": {
    "path": "/path/to/music",
    "totalFiles": 1150,
    "recognized": 1150,
    "failed": 0,
    "newFiles": 50,
    "skippedFiles": 1100,
    "formatDistribution": {
      "flac": 810,
      "mp3": 339,
      "ogg": 1
    },
    "qualityDistribution": {
      "lossless": 810,
      "standard": 158,
      "high": 182
    },
    "totalSizeBytes": 37798682624,
    "scanDurationMs": 2350,
    "tracks": [
      {
        "name": "歌曲名",
        "artist": "艺术家",
        "album": "专辑",
        "quality": "lossless",
        "format": "flac",
        "fileSize": 32456789,
        "bitrate": 1411,
        "source": "metadata",
        "filePath": "/path/to/song.flac",
        "isNew": true
      }
    ]
  }
}
```

### 错误输出

```json
{
  "success": false,
  "error": {
    "code": "NO_PATH",
    "message": "请指定扫描路径或设置 musicDir 配置"
  }
}
```

## 错误码

| 错误码 | 描述 | 退出码 |
|--------|------|--------|
| NO_PATH | 未指定扫描路径且未配置 musicDir | 1 |
| PATH_NOT_FOUND | 指定的路径不存在 | 1 |
| NOT_DIRECTORY | 指定的路径不是目录 | 1 |
| PERMISSION_DENIED | 无权限访问目录 | 1 |

## 行为规范

### 增量扫描模式（默认）

1. 从数据库加载已知文件列表
2. 扫描目录获取当前文件列表
3. 对于每个文件：
   - 如果是新文件（数据库中不存在）：解析元数据
   - 如果文件已存在但 mtime 或 size 变化：重新解析
   - 如果文件未变化：跳过，使用数据库中的信息
4. 检测已删除的文件并标记

### 全量扫描模式（--full）

1. 忽略数据库中的现有记录
2. 重新解析所有文件的元数据
3. 更新数据库

### 数据库更新（默认启用）

- 所有识别成功的文件都会存入数据库
- 无 songId 的文件 status 设为 `pending`
- 已有 songId 的文件保持原有 status

## 兼容性

此命令保持与现有实现的向后兼容：
- 所有现有选项继续工作
- 输出格式保持一致
- 新增选项 `--incremental` 和 `--full` 用于控制扫描模式
