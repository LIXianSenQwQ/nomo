Status: ready-for-agent
Feature: diagram-nodeview
Created: 2026-06-05

# PRD: Mermaid 图表语义节点与第一阶段实现

## Problem Statement

当前 **Mermaid 图表** 仍缺少独立的语义编辑闭环。用户可以通过 Markdown fenced code block 保存 Mermaid 源码，但语义模式里还没有像 **跨行公式块** 一样稳定的“渲染态 / 编辑态”切换体验；菜单中的图表入口也仍是占位，无法直接插入常用图表模板。

这会让技术写作者在处理流程图、时序图、类图、状态图、饼图、甘特图和 ER 图时频繁切换源码模式，也让图表能力与项目的 **Markdown-first**、**语义编辑** 和 **渲染服务** 边界不一致。

## Solution

将 Mermaid fenced code block 升级为独立的 **Mermaid 图表** 语义块：

- Markdown 主数据继续保存为标准 ```mermaid fenced code block。
- 语义模式常态显示 Mermaid 渲染图。
- 点击图表后进入编辑态，编辑框位于上方，实时预览位于下方。
- 编辑态退出后一次性回写 Markdown。
- 第一阶段提供七类 Mermaid 图表模板：流程图、时序图、类图、状态图、饼图、甘特图和 ER 图。
- 工具栏、标题栏菜单和 Tauri 原生菜单都提供图表插入入口。

## User Stories

1. As a technical writer, I want Mermaid diagrams to remain standard Markdown, so that my files stay portable.
2. As a technical writer, I want Mermaid fenced blocks to render as diagrams in semantic mode, so that diagrams are easy to read while writing.
3. As a technical writer, I want to click a Mermaid diagram to edit its source, so that I do not need to switch to source mode.
4. As a technical writer, I want the diagram editor to appear above the rendered preview, so that source editing and visual feedback stay together.
5. As a technical writer, I want invalid Mermaid syntax to show an error without changing my source, so that mistakes are recoverable.
6. As a technical writer, I want flowchart templates, so that I can quickly describe process relationships.
7. As a technical writer, I want sequenceDiagram templates, so that I can quickly describe interactions over time.
8. As a technical writer, I want classDiagram templates, so that I can quickly describe class relationships.
9. As a technical writer, I want stateDiagram templates, so that I can quickly describe state transitions.
10. As a technical writer, I want pie templates, so that I can quickly describe proportions.
11. As a technical writer, I want gantt templates, so that I can quickly describe schedules.
12. As a technical writer, I want erDiagram templates, so that I can quickly describe data relationships.
13. As a Windows-first desktop user, I want the native menu to expose diagram insertion, so that desktop commands match the app UI.
14. As a maintainer, I want Mermaid rendering behind the existing render service, so that NodeView code does not own renderer setup.
15. As a maintainer, I want Mermaid diagrams separate from code block responsibilities, so that code blocks remain focused on code editing.

## Implementation Decisions

- Introduce a `mermaid_block` semantic block node for Mermaid fenced code blocks.
- Store only Mermaid source code in the node attributes.
- Rendered SVG, error state and editing state remain derived UI state.
- Parse fenced code blocks whose first info-string token is `mermaid` as Mermaid blocks.
- Serialize Mermaid blocks back to standard ```mermaid fenced code blocks.
- Keep non-Mermaid fenced code blocks on the existing code block path.
- Use a dedicated Mermaid NodeView with display mode and edit mode.
- Use the existing Mermaid diagram renderer service and register it at app startup.
- Keep the existing `setCodeBlockDiagramRenderer` public function name for compatibility in this phase.
- Add a diagram template command with seven fixed first-phase diagram types.
- Keep the legacy `insertMermaidBlock` command working for existing callers.
- Implement diagram insertion menus as second-level menus where the current UI already supports nested dropdowns.

## Testing Decisions

- Tests should focus on external behavior: Markdown input, EditorCore command output, semantic DOM presence and Markdown serialization.
- Markdown round-trip tests should cover Mermaid fenced block parsing, Mermaid serialization and ordinary fenced code block regression.
- Command tests should cover all seven diagram template types.
- NodeView tests should cover display container creation, click-to-edit DOM layout, save-on-blur and cancel-on-Escape behavior where practical.
- Menu tests should use existing source-level layout tests to ensure diagram menu entries and command wiring exist.
- Prior art: follow existing math block, code block, createEditorCore and App layout tests.

## Out of Scope

- Generic data charts such as bar charts or line charts outside Mermaid.
- A full Mermaid template library beyond the seven first-phase diagram types.
- Mermaid syntax autocomplete, validation panels or diagram-specific form editors.
- Exporting diagrams as PNG/SVG files.
- Mermaid rendering cache persistence.
- Changing the saved Markdown format away from standard fenced code blocks.

## Further Notes

This work continues the existing architecture direction: **Mermaid 图表** belongs to **技术文档能力**, uses **渲染服务**, preserves **Markdown-first**, and should not leak ProseMirror details into Svelte application components.
