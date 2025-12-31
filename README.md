# musync

网易云音乐歌单同步工具 - Sync NetEase Cloud Music playlists to local

[![Bun](https://img.shields.io/badge/Bun-1.x-black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 功能特性

- 🔐 **多种登录方式** - 支持手机号、邮箱、二维码登录
- 📋 **歌单管理** - 查看和浏览您的网易云音乐歌单
- 🔍 **本地扫描** - 扫描本地音乐库，自动识别歌曲信息
- ⚡ **增量扫描** - 智能跳过未修改的文件，大幅提升扫描速度
- 📊 **差异对比** - 对比在线歌单与本地音乐的差异
- ⬇️ **智能下载** - 下载缺失歌曲，支持多种音质选择
- ⬆️ **音质升级** - 自动检测并升级低音质歌曲
- 🔓 **NCM解密** - 自动解密网易云音乐 .ncm 格式文件
- 📦 **数据库管理** - 维护本地同步记录，支持所有本地歌曲

## 安装

### 方式一：直接使用（推荐）

无需安装，直接通过 `bunx` 或 `npx` 运行：

```bash
# 使用 bunx（推荐，更快）
bunx musync --help
bunx musync login --qr
bunx musync scan /path/to/music

# 使用 npx
npx musync --help
npx musync login --qr
npx musync scan /path/to/music
```

### 方式二：全局安装

```bash
# 使用 bun 全局安装
bun install -g musync

# 或使用 npm
npm install -g musync

# 然后直接使用
musync --help
```

### 方式三：从源码安装

#### 前置要求

- [Bun](https://bun.sh) 1.x 或更高版本

#### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd musync

# 安装依赖
bun install

# 全局链接（可选，用于全局使用 musync 命令）
bun link
```

## 快速开始

### 1. 登录

```bash
# 二维码登录（推荐）
musync login --qr

# 手机号登录
musync login --phone 13800138000

# 邮箱登录
musync login --email user@163.com
```

### 2. 配置音乐目录

```bash
# 设置本地音乐目录
musync config musicDir "/path/to/your/music"

# 设置首选音质
musync config preferredQuality lossless
```

### 3. 查看歌单

```bash
# 列出所有歌单
musync playlist

# 查看指定歌单详情
musync playlist 705123491
```

### 4. 扫描本地音乐

```bash
# 扫描配置的音乐目录（默认增量扫描）
musync scan

# 扫描指定目录
musync scan /path/to/music

# 强制全量扫描
musync scan --full
```

### 5. 对比差异

```bash
# 对比歌单与本地差异
musync diff 705123491

# 或使用歌单名称
musync diff "我喜欢的音乐"
```

### 6. 同步下载

```bash
# 下载缺失歌曲
musync sync 705123491

# 同时升级低音质歌曲
musync sync 705123491 --upgrade

# 预览模式（不实际下载）
musync sync 705123491 --dry-run
```

## 命令参考

### 全局选项

| 选项 | 别名 | 说明 |
|------|------|------|
| --data-dir | -d | 数据目录路径（默认: ~/.musync） |
| --verbose | -v | 启用详细日志 |
| --help | -h | 显示帮助信息 |
| --version | -V | 显示版本号 |

### login

登录网易云音乐账户。

```bash
musync login [选项]
```

| 选项 | 说明 |
|------|------|
| --phone \<phone\> | 手机号码 |
| --password \<password\> | 密码 |
| --captcha \<code\> | 验证码 |
| --qr | 使用二维码登录 |
| --email \<email\> | 邮箱地址 |
| --json | JSON格式输出 |

### logout

退出当前登录。

```bash
musync logout
```

### playlist

查看用户歌单。

```bash
musync playlist [id] [选项]
```

| 选项 | 说明 |
|------|------|
| --limit \<number\> | 每页显示数量 |
| --offset \<number\> | 偏移量 |
| --json | JSON格式输出 |

### scan

扫描本地音乐库。

```bash
musync scan [path] [选项]
```

| 选项 | 说明 |
|------|------|
| --no-recursive | 不递归扫描子目录 |
| --no-update-db | 不更新本地数据库 |
| --incremental | 增量扫描，跳过未修改的文件（默认启用） |
| --full | 强制全量扫描 |
| --json | JSON格式输出 |

**示例：**

```bash
# 增量扫描（默认，跳过未修改的文件）
musync scan /path/to/music

# 强制全量扫描
musync scan /path/to/music --full

# JSON格式输出
musync scan /path/to/music --json
```

### diff

对比歌单与本地差异。

```bash
musync diff <playlist> [选项]
```

| 选项 | 说明 |
|------|------|
| --quality \<level\> | 目标音质 (standard/high/lossless) |
| --json | JSON格式输出 |

### sync

同步下载歌曲。

```bash
musync sync <playlist> [选项]
```

| 选项 | 说明 |
|------|------|
| --quality \<level\> | 下载音质 |
| --upgrade | 同时升级已有歌曲 |
| --dry-run | 仅显示计划，不实际下载 |
| --limit \<number\> | 限制下载数量 |
| --output \<path\> | 指定输出目录 |
| --json | JSON格式输出 |

### config

查看或修改配置。

```bash
musync config [key] [value] [选项]
```

| 选项 | 说明 |
|------|------|
| --list | 列出所有配置 |
| --reset | 重置为默认值 |
| --db | 显示数据库状态 |
| --clean | 清理数据库 |
| --json | JSON格式输出 |

**可用配置项：**

| 配置项 | 说明 |
|--------|------|
| musicDir | 本地音乐目录路径 |
| downloadDir | 下载保存目录路径 |
| preferredQuality | 首选音质 (standard/high/lossless) |
| deleteOldOnUpgrade | 升级时是否删除旧文件 |
| concurrentDownloads | 并发下载数 (1-10) |
| fileNameTemplate | 文件命名模板 |

## 音质说明

| 等级 | 说明 | 格式 |
|------|------|------|
| standard | 标准 128kbps | MP3 |
| high | 高品质 320kbps | MP3 |
| lossless | 无损 | FLAC |

## 数据存储

所有数据默认存储在 `~/.musync/` 目录：

```
~/.musync/
├── config.json      # 用户配置
├── cookie.json      # 登录凭证
└── database.json    # 同步记录数据库
```

## 开发

```bash
# 开发模式运行
bun run dev

# 构建
bun run build

# 运行测试
bun test

# 类型检查
bun run typecheck
```

## 依赖

- [@neteasecloudmusicapienhanced/api](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) - 增强版网易云API
- [music-metadata](https://github.com/borewit/music-metadata) - 音频元数据读取
- [commander](https://github.com/tj/commander.js) - CLI命令行解析
- [p-limit](https://github.com/sindresorhus/p-limit) - 并发控制

## 注意事项

- 请遵守网易云音乐的使用条款
- 仅供个人学习和研究使用
- 下载的音乐仅限于个人收藏，请支持正版

## 许可证

MIT License
