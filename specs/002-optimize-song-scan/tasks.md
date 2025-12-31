# Tasks: 优化歌曲扫描机制

**Input**: Design documents from `/specs/002-optimize-song-scan/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not explicitly requested - skipping test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Preparation for feature implementation

- [X] T001 Verify current music-metadata version supports parseFile in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core model and type changes that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Update SyncStatus type to include 'pending' status in src/constants.ts
- [X] T003 Update SyncRecord interface with new fields in src/models/config.ts
- [X] T004 Update LocalTrack interface with fileModifiedAt field in src/models/local-track.ts
- [X] T005 [P] Add getFileMtime utility function in src/utils/file.ts
- [X] T006 Implement database migration v1 to v2 in src/storage/database.ts
- [X] T007 Update createEmptyDatabase to return version 2 in src/models/config.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 快速扫描大型音乐库 (Priority: P1) 🎯 MVP

**Goal**: 使用 parseFile 替代 parseBuffer，显著减少 IO 和内存使用

**Independent Test**: 运行 `musync scan` 扫描 1000+ 首歌曲，验证速度提升和内存使用降低

### Implementation for User Story 1

- [X] T008 [US1] Replace readFileSync+parseBuffer with parseFile in src/services/scanner.ts readAudioMetadata function
- [X] T009 [US1] Add parseFile options (skipCovers, duration:false) in src/services/scanner.ts
- [X] T010 [US1] Update scanAudioFile to include fileModifiedAt in returned LocalTrack in src/services/scanner.ts
- [X] T011 [US1] Update scanDirectory to populate fileSize from file stats in src/services/scanner.ts

**Checkpoint**: User Story 1 complete - scanning should be significantly faster with lower memory usage

---

## Phase 4: User Story 2 - 存储无在线ID的本地歌曲 (Priority: P1)

**Goal**: 支持存储没有 songId 的本地歌曲，使用 localPath 作为主键

**Independent Test**: 扫描包含无 songId 的本地歌曲目录，验证所有歌曲都被存储到数据库

### Implementation for User Story 2

- [X] T012 [US2] Modify upsertRecord to use localPath as primary key in src/storage/database.ts
- [X] T013 [US2] Modify upsertRecords to use localPath as primary key in src/storage/database.ts
- [X] T014 [P] [US2] Implement updateSongId function in src/storage/database.ts
- [X] T015 [P] [US2] Implement getRecordsByStatus function in src/storage/database.ts
- [X] T016 [P] [US2] Implement getPendingRecords function in src/storage/database.ts
- [X] T017 [US2] Remove songId filter in scan command - store all tracks in src/commands/scan.ts
- [X] T018 [US2] Update record creation to set status='pending' for tracks without songId in src/commands/scan.ts
- [X] T019 [US2] Add fileModifiedAt and fileSize to record creation in src/commands/scan.ts

**Checkpoint**: User Story 2 complete - all scanned songs stored regardless of songId

---

## Phase 5: User Story 3 - 增量扫描更新 (Priority: P2)

**Goal**: 只处理变化的文件，跳过未修改的文件

**Independent Test**: 第一次全量扫描后，第二次扫描应该大部分文件被跳过

### Implementation for User Story 3

- [X] T020 [US3] Add --incremental and --full options to scan command in src/commands/scan.ts
- [X] T021 [US3] Implement hasFileChanged helper function in src/services/scanner.ts
- [X] T022 [US3] Implement incremental scan logic in scanDirectory in src/services/scanner.ts
- [X] T023 [US3] Update ScanResult interface with newFiles, skippedFiles, updatedFiles, deletedFiles in src/models/local-track.ts
- [X] T024 [US3] Update scan command to load existing records for incremental comparison in src/commands/scan.ts
- [X] T025 [US3] Update scan command output to show incremental scan statistics in src/commands/scan.ts
- [X] T026 [US3] Mark deleted files in database when file no longer exists in src/commands/scan.ts

**Checkpoint**: User Story 3 complete - incremental scanning fully functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [X] T027 [P] Update JSON output format to include new fields in src/commands/scan.ts
- [X] T028 [P] Add debug logging for scan performance metrics in src/services/scanner.ts
- [X] T029 Run quickstart.md validation - test full scan workflow
- [X] T030 Manual testing with large music library (1000+ files)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational (BLOCKS all user stories)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Phase 3: US1       Phase 4: US2      (can run in parallel)
(Fast Scanning)    (Store All Songs)
    │                  │
    └────────┬─────────┘
             ▼
        Phase 5: US3 (Incremental Scan)
        (depends on US1 & US2)
             │
             ▼
        Phase 6: Polish
```

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational phase
- **User Story 2 (P1)**: Depends only on Foundational phase
- **User Story 3 (P2)**: Depends on US1 (parseFile) and US2 (localPath as key)

### Within Each User Story

- Models before services
- Services before commands
- Core implementation before CLI integration

### Parallel Opportunities

Phase 2 (Foundational):
```bash
# These can run in parallel:
T004 [P] Add getFileMtime utility function
```

Phase 4 (User Story 2):
```bash
# These can run in parallel:
T013 [P] Implement updateSongId function
T014 [P] Implement getRecordsByStatus function
T015 [P] Implement getPendingRecords function
```

Phase 6 (Polish):
```bash
# These can run in parallel:
T026 [P] Update JSON output format
T027 [P] Add debug logging
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Fast Scanning)
4. Complete Phase 4: User Story 2 (Store All Songs)
5. **VALIDATE**: Test scanning with large library, verify all songs stored
6. Deploy/demo if ready

### Full Feature

1. Complete MVP (Phases 1-4)
2. Complete Phase 5: User Story 3 (Incremental Scanning)
3. Complete Phase 6: Polish
4. Final validation with quickstart.md

---

## Notes

- Total tasks: 30
- Phase 2 (Foundational): 6 tasks - MUST complete before user stories
- Phase 3 (US1 - Fast Scan): 4 tasks
- Phase 4 (US2 - Store All): 8 tasks
- Phase 5 (US3 - Incremental): 7 tasks
- Phase 6 (Polish): 4 tasks
- Parallel opportunities: 7 tasks marked [P]
- US1 and US2 can be developed in parallel after Foundational phase
- US3 depends on both US1 and US2 completion
