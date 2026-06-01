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

## 模块体积与职责边界

代码组织优先考虑**功能边界、职责清晰、长期可维护**，行数只是预警指标，不是绝对限制。

### 1. 文件体积建议

* 普通源码文件建议控制在 500 行左右。

* Svelte 组件建议控制在 300 行左右。

* 服务、核心、适配器文件建议控制在 400 行左右。

* 单文件超过 600 行时，应主动检查是否职责过载。

允许在功能内聚、逻辑连续、拆分收益不明显时适度超过，但不能把无关职责混在一起。

### 2. 职责拆分原则

新增代码前先判断它属于：

* UI 组件

* 状态管理

* 编辑器核心

* 文件 IO

* Markdown 解析 / 序列化

* 渲染增强

* 第三方库适配

* 工具函数

* 类型与领域模型

不同职责不要混放。接近体积阈值时，应优先按职责拆分，而不是继续追加代码。

### 3. App.svelte 边界

`App.svelte` 只作为应用装配层，负责连接状态、生命周期和顶层布局。

不应在 `App.svelte` 中放入：

* 大段 UI 模板

* 大段样式

* 文件 IO

* 编辑器内核细节

* Markdown 解析逻辑

* 复杂 DOM 计算

* 第三方库适配逻辑

### 4. EditorCore 边界

`EditorCore` 是应用层使用编辑能力的稳定边界。

应用层只能通过 `EditorCore` API 调用编辑功能。ProseMirror 相关实现必须留在 `src/lib/editor-core/` 内部，不得泄漏到 Svelte 组件。

如应用层需要新的编辑能力，应扩展 `EditorCore` 的命令或事件接口，而不是在组件中直接操作 ProseMirror。

### 5. 样式边界

样式应放在明确位置：

* 组件样式放组件内

* 全局样式放全局样式文件

* 主题变量放主题文件

* 编辑器内容样式放编辑器专用样式文件

* 第三方库样式适配单独放置

不要把大段全局 CSS 塞回 `App.svelte`。

### 6. 临时超出说明

文件可以因迁移、功能未稳定或逻辑高度内聚而临时超过建议阈值。

但超过 600 行时，应说明：

* 为什么暂不拆分

* 后续可拆到哪些模块

目标是避免项目退化成巨大的 `App.svelte`、失控的 `EditorCore`，以及 UI、状态、IO、解析、渲染混杂在一起。

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
