# Markdown 语义渲染补齐 PRD

Labels: ready-for-agent

## Problem Statement

用户在语义编辑模式中打开技术文档时，Task List、基础表格、代码块、引用块、HTML 块、数学公式、Mermaid 图表和 Emoji 等 Markdown 类型没有按预期渲染。尤其是任务列表不能直接点击勾选，代码块缺少语法高亮、复制、行号、标题、自动换行、横向滚动和 diff 高亮，文档最后如果是代码块也容易让用户无法继续输入。

## Solution

在保持 Markdown-first 和 EditorCore 边界的前提下，为语义模式增加一层派生的富 Markdown 渲染模型。主内容仍保存为 Markdown 文本；KaTeX、Mermaid、Shiki 继续作为渲染服务；任务列表点击后回写对应 Markdown 行；保存和源码输入时统一保留文档结尾空行。

## User Stories

1. As a technical writer, I want Task List items to render as checkboxes, so that I can toggle completion directly in semantic mode.
2. As a technical writer, I want pipe tables to render as tables, so that structured content is readable.
3. As a technical writer, I want code blocks to render with syntax highlighting, so that code is easier to scan.
4. As a technical writer, I want code blocks to show line numbers, so that I can discuss code by line.
5. As a technical writer, I want code blocks to expose a copy button, so that I can reuse snippets quickly.
6. As a technical writer, I want code block titles to render, so that file names and snippet purpose are visible.
7. As a technical writer, I want code blocks to support wrapping and horizontal scrolling, so that long lines remain usable.
8. As a technical writer, I want diff blocks to show additions and removals, so that changes are readable.
9. As a technical writer, I want blockquotes to render with clear styling, so that quoted notes stand apart.
10. As a technical writer, I want HTML blocks to render, so that Markdown documents using inline HTML remain readable.
11. As a technical writer, I want formulas to render through KaTeX, so that TeX notation is readable.
12. As a technical writer, I want Mermaid diagrams including sequence diagrams to render with neutral grey surfaces, so that diagrams fit the editor UI.
13. As a technical writer, I want Emoji to be preserved, so that expressive Markdown remains intact.
14. As a technical writer, I want the default sample document to cover all major Markdown types, so that rendering regressions are easy to spot.
15. As a technical writer, I want saved documents to keep a trailing blank line, so that a final code block never traps further input.

## Implementation Decisions

- Add a lightweight rich Markdown block model for semantic rendering without replacing Markdown as the source of truth.
- Keep EditorCore mounted and responsible for document state, commands, save/open flow, and Markdown synchronization.
- Reuse existing rendering services: KaTeX for math, Mermaid for diagrams, Shiki for code tokenization.
- Treat Task List as a Markdown line-level interaction: checkbox changes update the corresponding `- [ ]` / `- [x]` line.
- Use neutral grey surfaces for code, Mermaid, math, HTML, table, and quote blocks to match the technical documentation UI.
- Preserve document ending with a blank line when source text changes and before save/export.

## Testing Decisions

- Add behavior tests for the rich Markdown model, checking all required block types and code metadata.
- Add a regression test for the trailing blank line requirement.
- Keep tests focused on public behavior: parsed block capabilities and generated sample content, not Svelte implementation internals.
- Continue running existing layout, EditorCore, MarkdownBridge, technical block, KaTeX, and Shiki tests.

## Out of Scope

- Full ProseMirror schema extensions for editable table cells, math nodes, and Mermaid NodeViews.
- Complete HTML sanitization policy beyond the current local-first renderer surface.
- Full CommonMark/GFM parser parity.
- Collaborative editing or cloud rendering.

## Further Notes

This is a staged implementation that improves the semantic reading and checkbox interaction experience now, while leaving room for deeper ProseMirror Adapter node work later.
