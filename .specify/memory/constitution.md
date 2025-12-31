<!--
Sync Impact Report
==================
- Version change: 0.0.0 → 1.0.0 (初始版本)
- Modified principles: N/A (首次创建)
- Added sections: Core Principles (5项), 技术栈约束, 开发工作流, Governance
- Removed sections: N/A
- Templates requiring updates:
  - plan-template.md: ✅ 已兼容 (Constitution Check 节点可引用本文档)
  - spec-template.md: ✅ 已兼容 (用户故事与简洁原则对齐)
  - tasks-template.md: ✅ 已兼容 (任务分类符合开发流程)
- Follow-up TODOs: None
-->

# musync Constitution

网易云音乐歌单同步工具项目宪法 - 定义核心开发原则与规范

## Core Principles

### I. 简洁至上 (Simplicity First)

- 功能实现 MUST 选择最简单可行的方案
- YAGNI (You Aren't Gonna Need It): 不实现当前不需要的功能
- 避免过度抽象：只有当代码重复 3 次以上才考虑抽象
- 每个模块 SHOULD 有单一明确的职责
- **理由**: 简洁的代码更易理解、维护和调试，降低认知负担

### II. CLI 优先 (CLI-First)

- 所有功能 MUST 通过 CLI 命令暴露
- 命令设计 MUST 遵循 Unix 哲学: 参数输入 → stdout 输出, 错误 → stderr
- 支持 `--json` 输出格式以便脚本集成
- 命令帮助信息 MUST 清晰说明参数和用法
- **理由**: CLI 工具的核心价值在于命令行交互，用户体验始于命令设计

### III. 类型安全 (Type Safety)

- 所有代码 MUST 使用 TypeScript 严格模式 (`strict: true`)
- 禁止使用 `any` 类型，必须使用 `unknown` 并进行类型守卫
- 外部 API 响应 MUST 定义完整的类型接口
- 数据模型 MUST 在 `src/models/` 中集中定义
- **理由**: 类型系统是防止运行时错误的第一道防线

### IV. 错误处理 (Error Handling)

- 所有异步操作 MUST 有明确的错误处理
- 用户可见错误 MUST 提供清晰的错误信息和解决建议
- 网络错误 SHOULD 支持重试机制
- 日志 MUST 包含足够上下文以便调试
- **理由**: 良好的错误处理提升用户体验，减少支持成本

### V. 渐进式开发 (Incremental Development)

- 功能开发 SHOULD 分解为可独立交付的小任务
- 每个 PR SHOULD 聚焦单一功能或修复
- 代码变更 MUST 保持向后兼容，除非有明确的迁移计划
- 大型重构 MUST 分步进行，每步可独立验证
- **理由**: 小步快跑降低风险，便于代码审查和问题定位

## 技术栈约束

- **运行时**: Bun 1.x (首选) / Node.js 18+
- **语言**: TypeScript 5.x, ESM 模块
- **CLI 框架**: Commander.js
- **测试**: Bun Test (`bun test`)
- **构建**: `bun build` 产出单文件可执行
- **包管理**: bun (lockfile: `bun.lockb`)

### 项目结构

```text
src/
├── index.ts          # CLI 入口
├── constants.ts      # 全局常量
├── commands/         # CLI 命令实现
├── models/           # 数据模型定义
├── services/         # 业务逻辑服务
├── storage/          # 持久化存储
└── utils/            # 工具函数

tests/                # 测试文件
specs/                # 功能规范文档
```

## 开发工作流

1. **规范先行**: 新功能 MUST 先在 `specs/` 中编写规范文档
2. **小步迭代**: 任务分解为可在 1-2 小时内完成的单元
3. **本地验证**: 提交前 MUST 运行 `bun run typecheck` 和 `bun test`
4. **文档同步**: API 变更 MUST 同步更新 README 和相关文档

## Governance

- 本宪法是项目开发的最高准则，所有代码审查 MUST 验证合规性
- 宪法修订需要明确的理由说明和版本变更记录
- 复杂度偏离（违反简洁原则）MUST 在 PR 中提供书面理由
- 运行时开发指导参见 `.specify/templates/agent-file-template.md`

**Version**: 1.0.0 | **Ratified**: 2026-01-01 | **Last Amended**: 2026-01-01
