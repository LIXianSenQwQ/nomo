Status: needs-triage

# PRD: 基础表格语义编辑与表格内联控件

## Problem Statement

当前 **基础表格** 在语义编辑区中主要通过 Markdown pipe table 的 HTML 装饰层呈现，缺少稳定边框、真实单元格编辑、行列操作和类似 Typora / Typedown 的表格内联控件。用户看到的表格不像可编辑对象，更像只读预览；这会削弱 **语义编辑** 的核心体验，并让技术写作中的表格维护成本偏高。

项目已经明确采用 **Markdown-first**、**EditorCore** 和 **ProseMirror Adapter** 的边界，且技术文档中已把基础表格方向定义为 `prosemirror-tables` + 自定义 Markdown 表格序列化。本需求要把当前“表格渲染”升级为“可直接编辑的基础表格”，并保留源码模式下可读、可迁移的 Markdown pipe table。

## Solution

引入 `prosemirror-tables` 作为 **ProseMirror Adapter** 内部的表格编辑能力，提供真实 table schema、单元格选区、行列编辑命令、键盘导航和表格修复插件。语义编辑区直接显示可编辑表格，表格边框、表头、选中状态和悬浮控件通过编辑区样式表达。

表格操作入口不放在主工具栏里扩展成复杂面板，而是在当前表格附近提供 **表格内联控件**：表格上方显示列级操作入口，左侧显示行级操作入口，底部或右下边缘显示新增行列的小按钮，并提供删除、左/中/右列对齐、表头切换等局部动作。内联控件仅在表格被选中或光标位于表格内部时显示，不依赖普通 hover 常驻。表头开启后，第一行应通过背景色、字体大小和字重与普通单元格形成明确区别。主工具栏可以保留“插入默认表格”的入口，但表格创建后的结构编辑主要发生在表格自身周围。

Markdown 保存仍以 pipe table 为主数据。第一版只承诺基础二维表格的语义保真，不承诺复杂单元格嵌套、合并单元格或电子表格级能力。

第一版单元格内容限定为纯文本与行内格式，例如粗体、斜体、行内代码和链接。不支持单元格内列表、代码块、图片、数学块或多段落内容，以避免 Markdown pipe table 无法稳定表达的复杂结构。

从源码模式或粘贴内容解析 Markdown 表格时，采用保守规范化策略：列数轻微不一致且可安全补齐时补空单元格；pipe 结构明显损坏或无法判断表格意图时，保留为普通 Markdown 文本段落，不强制转换成表格节点。

表格布局第一版采用内容区内自适应宽度：默认占满当前文档内容宽度，列宽按可用宽度均分；当内容或列数导致表格过宽时，表格区域横向滚动。不提供列宽拖拽，也不把列宽写入 Markdown。

## User Stories

1. As a Markdown writer, I want inserted tables to show visible borders, so that I can understand row and column boundaries while writing.
2. As a Markdown writer, I want to click into a table cell and type directly, so that I do not need to edit raw pipe table syntax.
3. As a Markdown writer, I want table headers to look different from body cells, so that table structure is visually clear.
4. As a Markdown writer, I want header cells to use distinct background color, font size, and font weight, so that headers are recognizable at a glance.
5. As a Markdown writer, I want to press Tab to move to the next cell, so that table editing follows familiar document editor behavior.
6. As a Markdown writer, I want Tab in the last cell to create or move into a next row, so that adding table content is smooth.
7. As a Markdown writer, I want Shift+Tab to move to the previous cell, so that keyboard navigation is reversible.
8. As a Markdown writer, I want Enter inside a cell to edit text predictably, so that table editing does not break the document structure unexpectedly.
9. As a Markdown writer, I want a small control above the table, so that I can perform table-specific actions without searching the main toolbar.
10. As a Markdown writer, I want row controls beside the table, so that I can add or delete rows in context.
11. As a Markdown writer, I want column controls above the table, so that I can add or delete columns in context.
12. As a Markdown writer, I want add-row and add-column controls on the table edge, so that expanding the table feels local and lightweight.
13. As a Markdown writer, I want a delete table action near the active table, so that I can remove a table without selecting raw Markdown lines.
14. As a Markdown writer, I want alignment controls near the table, so that I can set left, center, or right alignment for a column.
15. As a Markdown writer, I want to toggle the first row as a header, so that the saved Markdown table has a clear header separator.
16. As a Markdown writer, I want table controls to appear only when the table is selected or my cursor is inside it, so that reading remains clean.
17. As a Markdown writer, I want table controls to be subtle and compact, so that they feel like Typedown / Typora rather than a spreadsheet ribbon.
18. As a Markdown writer, I want source mode to show a valid Markdown pipe table, so that the document remains portable.
19. As a Markdown writer, I want changes made in source mode to become editable tables again in semantic mode, so that both modes stay consistent.
20. As a Markdown writer, I want tables copied from Markdown sources to become editable tables when possible, so that imported notes remain usable.
21. As a Markdown writer, I want slightly uneven table rows to be normalized safely, so that common pasted tables remain editable.
22. As a Markdown writer, I want broken or ambiguous pipe text to remain plain Markdown, so that the editor does not invent a table incorrectly.
23. As a Markdown writer, I want inline formatting inside cells, so that common Markdown emphasis and links remain useful in tables.
24. As a Markdown writer, I want tables to fit the document content width by default, so that they feel like part of the document layout.
25. As a Markdown writer, I want wide tables to scroll horizontally, so that content remains accessible without breaking the page.
26. As a Markdown writer, I want invalid or unsupported tables to degrade gracefully, so that content is not lost.
27. As a maintainer, I want Svelte UI to use **EditorCore** table commands instead of direct ProseMirror APIs, so that the **ProseMirror Adapter** remains replaceable.
28. As a maintainer, I want Markdown table parsing and serialization to live behind **MarkdownBridge** / editor-core boundaries, so that file persistence stays Markdown-first.
29. As a maintainer, I want tests around table round-trip behavior, so that editing a table does not silently corrupt Markdown.
30. As a maintainer, I want tests around command behavior, so that add/delete row and column actions are stable.
31. As a maintainer, I want visual styles scoped to the semantic editor, so that table styling does not leak into unrelated app chrome.

## Implementation Decisions

- Use `prosemirror-tables` directly for runtime table schema, table editing commands, table keymap behavior, selected cell styling, and table normalization.
- Replace the current table HTML decoration path for pipe tables with real editable table nodes. Existing HTML block rendering should stay separate and must not own Markdown table editing.
- Extend the editor schema inside **ProseMirror Adapter** instead of making Svelte components depend on ProseMirror table internals.
- Add EditorCore-level table commands for inserting a table, adding or deleting rows, adding or deleting columns, deleting a table, toggling header row, and setting column alignment.
- Keep the main toolbar’s table button as a simple insert entry if desired, but put structural editing controls in **表格内联控件** attached to the selected or cursor-active table.
- Place column-level controls above the table, row-level controls on the left side, and add-row / add-column controls on the lower or corner edge of the table.
- Implement the inline table controls as an editor plugin / NodeView-adjacent overlay owned by the editor layer, with UI callbacks routed through EditorCore commands.
- The first version supports basic Markdown pipe tables only: rectangular rows, optional header row, and left / center / right column alignment.
- Column alignment must round-trip through Markdown pipe table separator markers: `:---`, `:---:`, and `---:`.
- Header toggling is limited to the first row. When enabled, the first row serializes as the Markdown table header and must render with distinct background color, font size, and font weight.
- Cell content in the first version is limited to plain text and inline marks such as emphasis, strong, inline code, and links.
- Markdown table parsing should safely normalize minor row length mismatches by adding empty cells, but broken or ambiguous pipe text should remain plain Markdown.
- Tables should fill the document content width with evenly distributed columns by default, and use horizontal scrolling when content or column count exceeds the available width.
- Do not support merged cells in the first version because GFM pipe table cannot express them cleanly.
- Do not support spreadsheet behaviors such as formulas, fill handles, sorting, filtering, or cell-type inference.
- Keep Markdown as the persisted content. ProseMirror table nodes are runtime editing state, not the durable storage format.
- Preserve **Front matter** when table edits occur, matching existing EditorCore behavior.
- Use editor-scoped styles for table borders, hover state, selected cells, header background, and inline controls.
- Keep Windows-first interaction details in mind: mouse hover, click targets, keyboard focus, and native shortcut expectations should be reliable on Windows desktop.

## Testing Decisions

- Tests should focus on external behavior through **EditorCore** and Markdown round trips, not on private ProseMirror transaction details.
- Add Markdown round-trip fixtures for header tables, body-only tables, left / center / right alignment tables, safely normalized uneven rows, broken pipe text, and tables surrounded by paragraphs/headings.
- Add EditorCore command tests for inserting a table, editing cell text, adding a row, adding a column, deleting a row, deleting a column, deleting a table, and undo/redo.
- Add serialization tests proving table edits save as readable pipe table Markdown.
- Add source/semantic switching tests proving a pipe table in source mode becomes an editable semantic table after switching back.
- Add style or DOM-level tests only where user-visible behavior matters, such as selected cell class presence, header visual class presence, and inline controls appearing only for the selected or cursor-active table.
- Use existing `createEditorCore` and MarkdownBridge-style tests as prior art.

## Out of Scope

- Merged cells.
- Column width dragging.
- Persisted column width.
- Spreadsheet formulas.
- Sorting and filtering.
- Nested block content inside cells.
- Images, code blocks, math blocks, lists, and multi-paragraph content inside cells.
- Complex HTML table import/export.
- Full Markdown formatting preservation such as exact original spacing around pipe separators.
- Cloud collaboration or multi-user table editing.

## Further Notes

This feature is a concrete step in restoring the distinction already captured in project docs: **语义渲染** 不能替代 **语义编辑**。基础表格应 become part of the editable ProseMirror document surface, while Markdown remains the long-term source of truth.

One product wording rule should be kept during implementation: internally and in docs, prefer **语义编辑** and **基础表格**; use “所见即所得” only when referring to the user expectation that table cells and controls are edited directly in-place.
