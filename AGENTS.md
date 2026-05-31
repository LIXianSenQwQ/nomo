# 全局 Agent 约定（通用）

## 适用范围

- 本文件适用于当前工作区的所有任务。
- 如某目录树下存在更近层级的 `AGENTS.md` / `SKILL.md`，按其作用域与更高优先级规则覆盖本约定。

## 通用输出与文件规范

- 默认输出/文档语言为中文；允许在必要处混用英文代码标识符（文件名、命令、API、类名等）。
- 所有新建/修改的文本文件默认使用 UTF-8（无 BOM）。
- 当前产品路线明确 **Windows-first**：桌面能力、路径处理、快捷键、文件对话框和异常提示优先保证 Windows 体验。
- 当前项目用不到 JDK，不要引入 Java/JDK 相关构建依赖。

## 推荐编程准则

- 修改前优先读懂现有代码风格、目录边界和业务语义，再决定实现方式。
- 保持改动聚焦，只处理当前任务需要的内容；不要做无关重构、格式化或大范围顺手修改。
- 优先使用项目已有框架、工具类、异常模型、响应模型和测试模式，避免引入不必要的新抽象或新依赖。
- 代码应表达业务意图，命名、结构和边界处理要让后续维护者能直接理解为什么这样实现。
- 对复杂业务逻辑添加中文注释，重点解释业务原因、关键步骤、边界处理和异常场景，而不只是翻译代码。
- 涉及公共接口、数据库字段、状态流转、权限、安全、金额、时间等高风险逻辑时，必须补充测试或明确说明验证方式。
- 失败场景要明确处理，避免吞异常、返回模糊结果或留下不可观测问题。

## 模块体积与职责硬约束

- 单个源码文件原则上不得超过 500 行；超过 500 行必须优先拆分，不能继续追加功能代码。
- 单个 Svelte 组件原则上不得超过 300 行；超过后必须拆成展示组件、组合组件、服务模块或纯工具模块。
- 单个服务/核心实现文件原则上不得超过 400 行；超过后必须按职责拆分为命令、状态、IO、解析、渲染、插件、适配器等深模块。
- 单文件超过 600 行视为架构问题，除迁移中的临时代码外不得合入；确需临时保留时，必须在同次变更中写明拆分计划和后续目标文件。
- 禁止把 UI 模板、样式、状态管理、平台 IO、业务流程、DOM 计算、第三方库适配混在同一个文件中。新增代码前必须先判断它属于组件、状态、服务、工具、领域模型还是适配层。
- `App.svelte` 只能作为应用装配层，负责连接状态、生命周期和子组件；不得承载大段 UI 模板、样式、文件 IO、编辑器内核细节或复杂算法。
- `EditorCore` 是应用层稳定边界；应用层只能通过 `EditorCore` API 使用编辑能力。ProseMirror 相关实现必须留在 `src/lib/editor-core/` 内部模块中，不得泄漏到 Svelte 组件。
- 样式应放在明确的样式文件或组件局部样式中，不得为了省事把大段全局 CSS 塞回应用入口组件。
- 每次新增或修改代码后，若触及的文件接近上述阈值，必须主动拆分或说明为什么暂不拆分；不得把“以后再拆”作为默认选择。

## Shell / 命令行

- Windows 环境永远使用 PowerShell 7（`pwsh`）运行命令与脚本。
- 当前用户全局 pnpm 可执行文件为 `C:\Users\89225\AppData\Roaming\npm\pnpm.cmd`。
- 如果直接执行 `pnpm` 提示找不到命令，优先使用上述绝对路径执行。

## Agent skills

### Issue tracker

Issues and PRDs are tracked as local Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with root `CONTEXT.md` and ADRs under `docs/adr/` when needed. See `docs/agents/domain.md`.
