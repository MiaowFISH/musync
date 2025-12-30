# Quickstart: musync

网易云音乐歌单同步工具

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd musync

# 安装依赖 (使用 Bun)
bun install

# 全局链接（开发时）
bun link
```

## 依赖说明

- **@neteasecloudmusicapienhanced/api**: 增强版网易云API，支持歌曲解灰
- **music-metadata**: 读取音频文件元数据
- **commander**: CLI命令行解析

## 初始化配置

```bash
# 设置音乐目录
musync config musicDir "/path/to/your/music"

# 设置首选音质 (standard/high/lossless)
musync config preferredQuality lossless
```

## 基本使用流程

### 1. 登录

```bash
# 使用手机号登录
musync login --phone 13800138000

# 输入密码后完成登录
Password: ********
✓ 登录成功，欢迎回来 用户昵称
```

### 2. 查看歌单

```bash
# 列出所有歌单
musync playlist

# 查看指定歌单内容
musync playlist 705123491
```

### 3. 扫描本地音乐

```bash
# 扫描配置的音乐目录
musync scan

# 或扫描指定目录
musync scan /path/to/music
```

### 4. 对比差异

```bash
# 对比歌单与本地差异
musync diff 705123491

# 或使用歌单名称
musync diff "我喜欢的音乐"
```

### 5. 同步下载

```bash
# 下载缺失歌曲
musync sync 705123491

# 同时升级低音质歌曲
musync sync 705123491 --upgrade

# 预览模式（不实际下载）
musync sync 705123491 --dry-run
```

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `musync login` | 登录网易云账户 |
| `musync logout` | 退出登录 |
| `musync playlist` | 查看歌单 |
| `musync scan` | 扫描本地音乐 |
| `musync diff <playlist>` | 对比差异 |
| `musync sync <playlist>` | 同步下载 |
| `musync config` | 配置管理 |

## 全局选项

| 选项 | 说明 |
|------|------|
| `--data-dir, -d` | 指定数据目录 |
| `--verbose, -v` | 详细日志输出 |
| `--help, -h` | 显示帮助 |
| `--version, -V` | 显示版本 |

## 数据目录

默认位置: `~/.musync/`

```
~/.musync/
├── config.json      # 用户配置
├── cookie.json      # 登录凭证
└── database.json    # 歌曲数据库
```

## 文件命名规则

默认模板: `{name} - {artist}`

示例: `晴天 - 周杰伦.flac`

可通过配置修改:
```bash
musync config fileNameTemplate "{artist} - {name}"
```

## 音质等级

| 等级 | 码率 | 格式 |
|------|------|------|
| standard | 128kbps | MP3 |
| high | 320kbps | MP3 |
| lossless | ~1000kbps | FLAC |

## 故障排除

### 登录失败

- 确认手机号/邮箱和密码正确
- 尝试使用网易云 App 刷新登录状态
- 检查网络连接

### 下载失败

- 检查是否有版权限制（部分歌曲需要 VIP）
- 检查磁盘空间
- 使用 `--verbose` 查看详细错误信息

### 歌曲匹配不准确

- 确保本地文件命名规范（歌名 - 歌手.后缀）
- 确保音频文件包含正确的 ID3 标签
- 重新扫描: `musync scan --update-db`

## 开发

```bash
# 开发模式运行
bun run dev

# 运行测试
bun test

# 构建
bun run build
```
