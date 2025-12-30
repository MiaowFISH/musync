# CLI Contract: musync

**Version**: 1.0.0  
**Date**: 2025-12-31

## Global Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| --data-dir | -d | string | ~/.musync | 数据目录路径 |
| --verbose | -v | boolean | false | 启用详细日志 |
| --help | -h | boolean | - | 显示帮助信息 |
| --version | -V | boolean | - | 显示版本号 |

## Commands

### login

登录网易云音乐账户。支持手机号密码登录、验证码登录和二维码登录。

```bash
musync login [options]
```

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| --phone | string | Yes* | 手机号码 |
| --password | string | No | 密码（交互式输入更安全） |
| --captcha | string | No | 验证码（与password二选一） |
| --qr | boolean | No | 使用二维码登录 |
| --email | string | Yes* | 邮箱地址（与phone/qr三选一） |

**Examples:**
```bash
musync login --phone 13800138000           # 手机号+密码登录
musync login --phone 13800138000 --captcha 1234  # 手机号+验证码登录
musync login --qr                          # 二维码登录（推荐）
musync login --email user@163.com          # 邮箱登录
```

**二维码登录流程:**
1. 执行 `musync login --qr`
2. 终端显示二维码（ASCII艺术或URL）
3. 使用网易云音乐 App 扫码确认
4. 登录成功后自动保存凭证

**Exit Codes:**
- 0: 登录成功
- 1: 登录失败（凭证错误）
- 2: 网络错误
- 3: 二维码已过期

---

### logout

退出当前登录。

```bash
musync logout
```

**Exit Codes:**
- 0: 成功退出

---

### playlist

查看用户歌单。

```bash
musync playlist [id] [options]
```

**Arguments:**
- `id` (optional): 歌单ID，不提供则列出所有歌单

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| --limit | number | 50 | 每页显示数量 |
| --offset | number | 0 | 偏移量 |
| --json | boolean | false | JSON格式输出 |

**Examples:**
```bash
musync playlist                    # 列出所有歌单
musync playlist 705123491          # 查看指定歌单详情
musync playlist --json             # JSON格式输出
```

**Output (列表模式):**
```
您的歌单:
  ID          名称                歌曲数
  705123491   我喜欢的音乐        128
  123456789   日语歌              45
  ...
```

**Output (详情模式):**
```
歌单: 我喜欢的音乐 (128首)

  #   歌名              歌手          专辑            时长
  1   晴天              周杰伦        叶惠美          4:29
  2   七里香            周杰伦        七里香          4:59
  ...
```

**Exit Codes:**
- 0: 成功
- 1: 未登录
- 2: 歌单不存在

---

### scan

扫描本地音乐库。

```bash
musync scan [path] [options]
```

**Arguments:**
- `path` (optional): 扫描路径，默认使用配置的 musicDir

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| --recursive | boolean | true | 递归扫描子目录 |
| --update-db | boolean | true | 更新本地数据库 |
| --json | boolean | false | JSON格式输出 |

**Examples:**
```bash
musync scan                        # 扫描配置的音乐目录
musync scan /path/to/music         # 扫描指定目录
musync scan --no-recursive         # 不扫描子目录
```

**Output:**
```
扫描目录: /path/to/music

扫描完成:
  总文件数: 1024
  识别成功: 1000
  识别失败: 24
  格式分布: mp3(800), flac(200), ncm(24)
```

**Exit Codes:**
- 0: 扫描成功
- 1: 路径不存在
- 2: 权限错误

---

### diff

对比歌单与本地差异。

```bash
musync diff <playlist> [options]
```

**Arguments:**
- `playlist` (required): 歌单ID或名称

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| --quality | string | lossless | 目标音质 (standard/high/lossless) |
| --json | boolean | false | JSON格式输出 |

**Examples:**
```bash
musync diff 705123491              # 对比指定歌单
musync diff "我喜欢的音乐"          # 通过名称对比
musync diff 705123491 --quality high
```

**Output:**
```
对比歌单: 我喜欢的音乐 (128首)

缺失歌曲 (15首):
  歌名              歌手          可用音质
  稻香              周杰伦        lossless
  告白气球          周杰伦        high
  ...

可升级 (8首):
  歌名              歌手          当前    可升级至
  晴天              周杰伦        high    lossless
  ...

已匹配 (100首)
无法下载 (5首):
  歌名              原因
  某歌曲            无版权
```

**Exit Codes:**
- 0: 成功
- 1: 未登录
- 2: 歌单不存在
- 3: 本地未扫描

---

### sync

同步下载歌曲。

```bash
musync sync <playlist> [options]
```

**Arguments:**
- `playlist` (required): 歌单ID或名称

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| --quality | string | lossless | 下载音质 |
| --upgrade | boolean | false | 同时升级已有歌曲 |
| --dry-run | boolean | false | 仅显示计划，不实际下载 |
| --limit | number | - | 限制下载数量 |
| --output | string | - | 指定输出目录 |

**Examples:**
```bash
musync sync 705123491              # 同步歌单
musync sync 705123491 --upgrade    # 同时升级音质
musync sync 705123491 --dry-run    # 预览模式
musync sync 705123491 --limit 10   # 仅下载10首
```

**Output:**
```
同步歌单: 我喜欢的音乐

[1/15] 下载中: 稻香 - 周杰伦 (lossless)
[2/15] 下载中: 告白气球 - 周杰伦 (high)
...

同步完成:
  下载成功: 13
  下载失败: 2
  跳过: 0
```

**Exit Codes:**
- 0: 全部成功
- 1: 部分失败
- 2: 全部失败

---

### config

查看或修改配置。

```bash
musync config [key] [value] [options]
```

**Arguments:**
- `key` (optional): 配置键名
- `value` (optional): 配置值（设置时需要）

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| --list | boolean | 列出所有配置 |
| --reset | boolean | 重置为默认值 |

**Examples:**
```bash
musync config --list               # 列出所有配置
musync config musicDir             # 查看指定配置
musync config musicDir /new/path   # 设置配置
musync config --reset              # 重置所有配置
```

**Available Keys:**
- `musicDir`: 音乐目录路径
- `downloadDir`: 下载目录路径
- `preferredQuality`: 首选音质
- `deleteOldOnUpgrade`: 升级时删除旧文件
- `concurrentDownloads`: 并发下载数
- `fileNameTemplate`: 文件名模板

**Exit Codes:**
- 0: 成功
- 1: 无效的配置键

---

## Output Formats

### Standard Output

人类可读格式，默认输出。

### JSON Output

使用 `--json` 选项启用。所有命令的 JSON 输出遵循统一结构：

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

错误时：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "请先登录"
  }
}
```

### Verbose Output

使用 `--verbose` 选项启用。额外输出：
- API 请求/响应详情
- 文件操作日志
- 性能计时信息
