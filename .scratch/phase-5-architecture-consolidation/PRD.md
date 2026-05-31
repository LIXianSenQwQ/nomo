# PRD：阶段 5 架构收束（richBlocks 退役）

Status: ready-for-agent

## Problem Statement

阶段 0 诊断出 `richBlocks`（基于 `parseRichMarkdown()` 的纯 DOM 渲染层）与 ProseMirror 编辑面存在"双渲染层"冲突。阶段 1–3 已逐步将代码高亮、数学公式、Mermaid 图表、task checkbox、表格渲染等能力迁移到 ProseMirror 的 NodeView 和 Plugin 体系。但 `richBlocks` 渲染管线——`parseRichMarkdown()` + `extractTechnicalBlocks()` + `updateTechnicalPreviews()` + `updateCodePreviews()`——至今仍在每次击键时全量运行，产生三套并行计算管线。虽然视觉上 `richBlocks` 在语义模式下是 `display:none`，但计算浪费持续存在，且拖累 App.svelte 的复杂度（~3500 行）。

## Solution

退役 `richBlocks` 双渲染层，使 ProseMirror 成为语义模式的唯一渲染与编辑面。同步完成 MarkdownBridge 职责归位、EditorCore 命令扩展、App.svelte 瘦身和 CodeBlockNodeView 增强。

## User Stories

1. As a maintainer, I want `richBlocks` rendering pipeline removed, so that every keystroke no longer triggers redundant Markdown parsing, technical block extraction, and async rendering.
2. As a maintainer, I want `parseRichMarkdown()` and `extractTechnicalBlocks()` modules deleted, so that the rendering architecture has exactly one path through ProseMirror.
3. As a maintainer, I want MarkdownBridge to own the actual Markdown ↔ editor document conversion, so that its role matches the CONTEXT.md glossary definition.
4. As a maintainer, I want outline jump in semantic mode to go through an EditorCore command rather than DOM query, so that the boundary between App layer and ProseMirror stays clean.
5. As a maintainer, I want outline/stats updates debounced by 200ms, so that rapid typing doesn't trigger unnecessary recomputation.
6. As a maintainer, I want CodeBlockNodeView to render line numbers and diff highlighting, so that removing richBlocks doesn't regress code block visuals.
7. As a maintainer, I want code line wrapping controlled via a global CSS variable, so that individual code blocks don't need per-block wrap toggle buttons.
8. As a maintainer, I want CSS classes like `.rich-markdown`, `.code-card` (from Svelte template) removed, so that no dead styles remain.
9. As a maintainer, I want tests for removed modules deleted and tests for new modules added, so that coverage stays accurate.

## Implementation Decisions

- 删除 `richMarkdown.ts` 和 `technicalBlocks.ts` 两个模块（含对应测试文件）。
- 新建 `src/lib/markdown/sample.ts`，将 `createRichMarkdownSample()` 迁入。
- 新建 `src/lib/markdown/normalize.ts`，将 `ensureEditableTrailingBlankLine()` 改名为 `normalizeMarkdownForSave()` 迁入。
- 扩展 `MarkdownBridge`：将 `createEditorCore.ts` 中的 `parseMarkdown()` 和 `serializeMarkdown()` 移入 `MarkdownBridge`，EditorCore 通过 MarkdownBridge 调用。
- EditorCore 新增 `scrollToHeading` 命令，接口为 `{ type: 'scrollToHeading'; headingIndex: number; text: string; level: number }`，内部通过 ProseMirror view.state.doc 定位 heading 节点并 scrollIntoView。
- App.svelte 删除 8 个 state 变量（`richBlocks`、`technicalBlocks`、`mathHtml`、`mermaidSvg`、`codeTokenMap`、`wrappedCodeBlocks`、`renderErrors`、`renderVersion`）、9 个函数（`toggleTaskAtLine`、`toggleCodeWrap`、`isCodeWrapped`、`getCodeBlockKey`、`getRenderedCodeLines`、`getCodeLineClass`、`copyCode`、`updateTechnicalPreviews`、`updateCodePreviews`）、82 行模板（`{#each richBlocks}` block + `<article class="rich-markdown">`）及相关 CSS 规则。
- App.svelte 在 `syncFromEditor` 中为 outline/stats 更新增加 200ms debounce。
- CodeBlockNodeView 添加：行号渲染（`.line-number`）、diff 语法行级高亮（`.diff-added` / `.diff-removed`）。
- 源码模式下 task checkbox 不渲染 widget，仅显示纯 Markdown 文本 `- [ ]` / `- [x]`。
- 代码块换行行为通过 CSS 变量 `--md-editor-code-wrap` 控制，默认 `pre`，切换入口放全局设置面板。

## Testing Decisions

- 删除 `richMarkdown.test.ts` 和 `technicalBlocks.test.ts`。
- 新建 `normalize.test.ts`，测试 `normalizeMarkdownForSave()` 的尾空行补全逻辑。
- 扩展 `MarkdownBridge.test.ts`，验证 parse/serialize 双向转换。
- 扩展 `createEditorCore.test.ts`，新增 `scrollToHeading` 命令测试用例。
- 现有测试（`outlineService.test.ts`、`katexMathRenderer.test.ts`、`shikiCodeTokenizer.test.ts`、`App.layout.test.ts`）保持不变。

## Out of Scope

- 不修改源码模式编辑逻辑（textarea 行为不变）。
- 不新增 TableNodeView（表格仍由 ProseMirror widget 渲染，contenteditable="false"）。
- 不修改文件保存/打开流程。
- 不修改 Tauri/SQLite 相关代码。
- 不做 richBlocks 的增量退役——整模块删除。

## Further Notes

阶段 5 是基础设施清理，不改变用户可见功能。验收标准以 `pnpm check`、`pnpm test`、`pnpm build` 全绿为准，辅以语义模式下手动验证：输入流畅、代码块渲染正确、Outline 跳转正常。
