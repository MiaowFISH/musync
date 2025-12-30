# Implementation Plan: 网易云音乐歌单同步应用

**Branch**: `001-playlist-sync` | **Date**: 2025-12-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-playlist-sync/spec.md`

## Summary

构建一个基于 Bun + TypeScript 的命令行工具，用于同步网易云音乐歌单到本地。核心功能包括：通过内置 NeteaseCloudMusicApi 进行用户认证和歌单获取、扫描本地音乐库并解析文件信息、对比在线与本地歌曲差异、下载缺失歌曲并支持音质升级、NCM 格式解密。采用简洁的项目结构，避免过度抽象。

## Technical Context

**Language/Version**: TypeScript 5.x + Bun 1.x  
**Primary Dependencies**:
- @neteasecloudmusicapienhanced/api (增强版网易云API，支持歌曲解灰)
- music-metadata (读取音频文件ID3标签)
- commander (CLI参数解析)
- p-limit (并发控制)
- 内置NCM解密 (纯JS实现)

**Storage**: JSON 文件 (~/.musync/)  
**Testing**: bun:test (Bun 内置测试框架)  
**Target Platform**: Windows/macOS/Linux (跨平台CLI)  
**Project Type**: single (单一CLI应用)  
**Performance Goals**: 5个并发下载、1000首歌曲10秒内加载  
**Constraints**: 避免过度设计，保持项目结构清晰  
**Scale/Scope**: 支持10个歌单、5000首歌曲的同步任务

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution 为模板状态，无特定项目约束。遵循用户要求：
- ✅ 使用 Bun + TypeScript 开发
- ✅ 项目结构清晰规范，确保可维护
- ✅ 不要过度设计，避免不必要的抽象

## Project Structure

### Documentation (this feature)

```text
specs/001-playlist-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── index.ts             # CLI入口，命令注册
├── commands/            # 子命令实现
│   ├── login.ts         # 登录命令
│   ├── logout.ts        # 登出命令
│   ├── playlist.ts      # 歌单查看命令
│   ├── scan.ts          # 本地扫描命令
│   ├── diff.ts          # 差异对比命令
│   ├── sync.ts          # 同步下载命令
│   └── config.ts        # 配置管理命令
├── services/            # 业务逻辑服务
│   ├── api.ts           # NeteaseCloudMusicApi封装
│   ├── auth.ts          # 认证与cookie管理
│   ├── playlist.ts      # 歌单数据获取
│   ├── scanner.ts       # 本地文件扫描
│   ├── matcher.ts       # 歌曲匹配算法
│   ├── downloader.ts    # 下载管理
│   └── ncm.ts           # NCM解密
├── models/              # 数据类型定义
│   ├── song.ts          # 歌曲相关类型
│   ├── playlist.ts      # 歌单相关类型
│   ├── local-track.ts   # 本地曲目类型
│   └── config.ts        # 配置类型
├── storage/             # 数据持久化
│   ├── database.ts      # JSON数据库操作
│   └── config.ts        # 配置文件读写
├── utils/               # 工具函数
│   ├── logger.ts        # 日志工具
│   ├── file.ts          # 文件操作
│   └── format.ts        # 格式化输出
└── constants.ts         # 常量定义

tests/
├── unit/                # 单元测试
│   ├── matcher.test.ts
│   ├── scanner.test.ts
│   └── ncm.test.ts
└── integration/         # 集成测试
    └── sync.test.ts

package.json
tsconfig.json
bunfig.toml
README.md
```

**Structure Decision**: 采用 Single Project 结构，按功能分层（commands/services/models/storage/utils），每层职责清晰，避免过度抽象。

## Complexity Tracking

无复杂度违规需要记录。项目采用简单直接的架构设计。
