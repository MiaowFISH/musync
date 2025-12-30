# Tasks: 网易云音乐歌单同步应用

**Input**: Design documents from `/specs/001-playlist-sync/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/cli.md ✓

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize Bun project with TypeScript in project root (package.json, tsconfig.json, bunfig.toml)
- [X] T002 [P] Install dependencies: @neteasecloudmusicapienhanced/api, music-metadata, commander, p-limit
- [X] T003 [P] Create project directory structure per plan.md (src/commands, services, models, storage, utils)
- [X] T004 [P] Create constants and types in src/constants.ts
- [X] T005 [P] Implement logger utility in src/utils/logger.ts
- [X] T006 [P] Implement file utility functions in src/utils/file.ts
- [X] T007 [P] Implement format utility functions in src/utils/format.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Define core type interfaces in src/models/song.ts (Song, Artist, Album)
- [X] T009 [P] Define Playlist types in src/models/playlist.ts
- [X] T010 [P] Define LocalTrack types in src/models/local-track.ts
- [X] T011 [P] Define Config and SyncRecord types in src/models/config.ts
- [X] T012 Implement config storage (read/write) in src/storage/config.ts
- [X] T013 Implement database storage (CRUD for SyncRecord) in src/storage/database.ts
- [X] T014 Create CLI entry point with global options in src/index.ts
- [X] T015 Implement NeteaseCloudMusicApi wrapper in src/services/api.ts

**Checkpoint**: Foundation ready - user story implementation can begin ✓

---

## Phase 3: User Story 1 - 首次登录与认证 (Priority: P1) 🎯 MVP

**Goal**: 用户可以登录网易云音乐账户，支持手机号/邮箱/二维码登录

**Independent Test**: 执行 `musync login --qr` 或 `musync login --phone <phone>` 验证登录成功

### Implementation for User Story 1

- [X] T016 [US1] Implement cookie storage (save/load/clear) in src/services/auth.ts
- [X] T017 [US1] Implement phone login with password/captcha in src/services/auth.ts
- [X] T018 [US1] Implement QR code login flow (generate, poll, confirm) in src/services/auth.ts
- [X] T019 [US1] Implement email login in src/services/auth.ts
- [X] T020 [US1] Implement login status check and refresh in src/services/auth.ts
- [X] T021 [US1] Create login command in src/commands/login.ts
- [X] T022 [US1] Create logout command in src/commands/logout.ts
- [X] T023 [US1] Register login/logout commands in src/index.ts

**Checkpoint**: User Story 1 complete - 用户可以登录/退出，凭证正确保存 ✓

---

## Phase 4: User Story 2 - 获取并查看在线歌单 (Priority: P1)

**Goal**: 用户可以查看自己的歌单列表和歌单详情

**Independent Test**: 登录后执行 `musync playlist` 验证歌单列表，`musync playlist <id>` 验证详情

### Implementation for User Story 2

- [X] T024 [US2] Implement user playlist fetching in src/services/playlist.ts
- [X] T025 [US2] Implement playlist detail fetching (with track info) in src/services/playlist.ts
- [X] T026 [US2] Implement song detail batch fetching in src/services/playlist.ts
- [X] T027 [US2] Create playlist command (list and detail views) in src/commands/playlist.ts
- [X] T028 [US2] Add JSON output format support in src/commands/playlist.ts
- [X] T029 [US2] Register playlist command in src/index.ts

**Checkpoint**: User Story 2 complete - 用户可以查看歌单列表和详情 ✓

---

## Phase 5: User Story 3 - 扫描本地音乐库 (Priority: P1)

**Goal**: 应用可以扫描本地文件夹，识别音频文件并解析歌曲信息

**Independent Test**: 执行 `musync scan /path/to/music` 验证扫描结果

### Implementation for User Story 3

- [X] T030 [US3] Implement file discovery (recursive dir walk) in src/services/scanner.ts
- [X] T031 [US3] Implement filename parsing ("歌名 - 歌手.ext") in src/services/scanner.ts
- [X] T032 [US3] Implement audio metadata reading (ID3 tags) in src/services/scanner.ts
- [X] T033 [US3] Implement quality detection from bitrate/format in src/services/scanner.ts
- [X] T034 [US3] Create scan command in src/commands/scan.ts
- [X] T035 [US3] Integrate scanner with database update in src/commands/scan.ts
- [X] T036 [US3] Register scan command in src/index.ts

**Checkpoint**: User Story 3 complete - 用户可以扫描本地音乐库 ✓

---

## Phase 6: User Story 4 - 对比分析与差异报告 (Priority: P1)

**Goal**: 对比在线歌单与本地音乐，生成差异报告（缺失、可升级、已匹配）

**Independent Test**: 执行 `musync diff <playlist_id>` 验证差异报告内容

### Implementation for User Story 4

- [X] T037 [US4] Implement song matching algorithm (ID, name+artist, fuzzy) in src/services/matcher.ts
- [X] T038 [US4] Implement string normalization for matching in src/services/matcher.ts
- [X] T039 [US4] Implement diff analysis (missing, upgradable, matched) in src/services/matcher.ts
- [X] T040 [US4] Create diff command in src/commands/diff.ts
- [X] T041 [US4] Add formatted diff report output in src/commands/diff.ts
- [X] T042 [US4] Register diff command in src/index.ts

**Checkpoint**: User Story 4 complete - 用户可以查看在线与本地的差异 ✓

---

## Phase 7: User Story 5 - 下载缺失歌曲 (Priority: P2)

**Goal**: 下载歌单中本地缺失的歌曲，支持并发下载和进度显示

**Independent Test**: 执行 `musync sync <playlist_id> --dry-run` 预览，`musync sync <playlist_id>` 实际下载

### Implementation for User Story 5

- [X] T043 [US5] Implement song URL fetching (with unblock support) in src/services/downloader.ts
- [X] T044 [US5] Implement single file download with progress in src/services/downloader.ts
- [X] T045 [US5] Implement concurrent download queue (p-limit) in src/services/downloader.ts
- [X] T046 [US5] Implement download filename generation (handle special characters) in src/services/downloader.ts
- [X] T047 [US5] Implement retry mechanism with exponential backoff in src/services/downloader.ts
- [X] T048 [US5] Implement disk space check before download in src/services/downloader.ts
- [X] T049 [US5] Implement download result recording to database in src/services/downloader.ts
- [X] T050 [US5] Create sync command in src/commands/sync.ts
- [X] T051 [US5] Add dry-run mode and progress display in src/commands/sync.ts
- [X] T052 [US5] Register sync command in src/index.ts

**Checkpoint**: User Story 5 complete - 用户可以下载缺失歌曲 ✓

---

## Phase 8: User Story 6 - 音质升级 (Priority: P2)

**Goal**: 当在线有更高音质版本时，允许用户升级本地歌曲

**Independent Test**: 执行 `musync sync <playlist_id> --upgrade` 验证音质升级功能

### Implementation for User Story 6

- [X] T053 [US6] Implement quality comparison logic in src/services/downloader.ts
- [X] T054 [US6] Implement upgrade download (with optional old file deletion) in src/services/downloader.ts
- [X] T055 [US6] Add --upgrade flag to sync command in src/commands/sync.ts
- [X] T056 [US6] Update database with upgraded track info in src/services/downloader.ts

**Checkpoint**: User Story 6 complete - 用户可以升级歌曲音质 ✓

---

## Phase 9: User Story 7 - NCM文件解密 (Priority: P2)

**Goal**: 自动解密 NCM 格式文件为标准音频格式

**Independent Test**: 扫描包含 NCM 文件的目录，验证自动解密

### Implementation for User Story 7

- [X] T057 [US7] Implement NCM file structure parsing in src/services/ncm.ts
- [X] T058 [US7] Implement AES key decryption in src/services/ncm.ts
- [X] T059 [US7] Implement RC4 audio data decryption in src/services/ncm.ts
- [X] T060 [US7] Implement NCM metadata extraction in src/services/ncm.ts
- [X] T061 [US7] Integrate NCM decryption into scanner in src/services/scanner.ts
- [X] T062 [US7] Add NCM handling to download flow in src/services/downloader.ts

**Checkpoint**: User Story 7 complete - NCM 文件自动解密 ✓

---

## Phase 10: User Story 8 - 本地歌曲数据库管理 (Priority: P2)

**Goal**: 维护本地数据库，记录已同步歌曲，加快后续对比

**Independent Test**: 多次运行 scan/sync 验证数据库正确更新

### Implementation for User Story 8

- [X] T063 [US8] Implement database integrity check (detect deleted files) in src/storage/database.ts
- [X] T064 [US8] Implement database cleanup command in src/storage/database.ts
- [X] T065 [US8] Create config command (view/set/reset) in src/commands/config.ts
- [X] T066 [US8] Register config command in src/index.ts

**Checkpoint**: User Story 8 complete - 数据库管理功能完整 ✓

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T067 [P] Add comprehensive error handling across all commands
- [X] T068 [P] Add --verbose mode logging throughout application
- [X] T069 [P] Add --json output format to all applicable commands
- [X] T070 [P] Create README.md with installation and usage instructions
- [ ] T071 Run quickstart.md validation (manual test all commands)
- [ ] T072 [P] Performance optimization: implement API response caching

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────► Phase 2 (Foundational) ─────┬──► Phase 3 (US1: Login)
                                                           │
                                                           ├──► Phase 4 (US2: Playlist) ──┐
                                                           │                              │
                                                           ├──► Phase 5 (US3: Scan) ──────┼──► Phase 6 (US4: Diff)
                                                           │                              │
                                                           └──────────────────────────────┴──► Phase 7+ (US5-8)
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Login) | Phase 2 | Foundational complete |
| US2 (Playlist) | US1 | User can login |
| US3 (Scan) | Phase 2 | Foundational complete |
| US4 (Diff) | US2, US3 | Playlist + Scan complete |
| US5 (Download) | US4 | Diff complete |
| US6 (Upgrade) | US5 | Download complete |
| US7 (NCM) | US3 | Scan complete |
| US8 (Database) | Phase 2 | Foundational complete |

### Parallel Opportunities

**Within Phase 1 (Setup):**
- T002, T003, T004, T005, T006, T007 can run in parallel

**Within Phase 2 (Foundational):**
- T009, T010, T011 can run in parallel after T008

**Independent Stories (after Phase 2):**
- US1 (Login) and US3 (Scan) and US8 (Database) can start in parallel
- US7 (NCM) can develop independently after US3

**Within Each Story:**
- Tasks marked [P] within a story can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# All these can run simultaneously:
Task T002: "Install dependencies"
Task T003: "Create project directory structure"
Task T004: "Create constants"
Task T005: "Implement logger"
Task T006: "Implement file utility"
Task T007: "Implement format utility"
```

---

## Implementation Strategy

### MVP First (User Stories 1-4)

1. Complete Phase 1: Setup ✓
2. Complete Phase 2: Foundational ✓
3. Complete Phase 3: US1 (Login) → **可以登录** ✓
4. Complete Phase 4: US2 (Playlist) → **可以查看歌单** ✓
5. Complete Phase 5: US3 (Scan) → **可以扫描本地** ✓
6. Complete Phase 6: US4 (Diff) → **可以对比差异** ✓
7. **MVP READY**: 用户可以登录、查看歌单、扫描本地、对比差异 ✓

### Incremental Delivery

| Milestone | Stories | Value Delivered | Status |
|-----------|---------|-----------------|--------|
| MVP | US1-4 | 查看在线与本地差异 | ✓ Complete |
| v1.0 | +US5 | 下载缺失歌曲 | ✓ Complete |
| v1.1 | +US6 | 音质升级 | ✓ Complete |
| v1.2 | +US7 | NCM 解密 | ✓ Complete |
| v1.3 | +US8 | 完整数据库管理 | ✓ Complete |

---

## Notes

- [P] tasks = different files, no dependencies
- [US#] label maps task to specific user story
- Each user story should be independently testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- 避免: 模糊任务、同文件冲突、破坏独立性的跨故事依赖
