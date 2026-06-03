# 段落与格式菜单轻量化 PRD

Status: needs-triage

## Problem Statement

当前轻量 Markdown 编辑器的“段落”和“格式”菜单还没有形成稳定的信息架构：部分块级结构放在格式菜单里，标题层级直接铺在一级菜单中，菜单能力与 Typedown 式轻量体验、Typora 式语义编辑心智之间还没有清晰取舍。用户希望先不实现全部功能，而是先确定段落菜单和格式菜单的产品规格：常用能力可见，低频密集能力收进二级菜单，决定保留但尚未实现的能力点击后给出短暂提示。

## Solution

将“段落”和“格式”菜单整理为偏 Typedown 的轻量结构，并在需要完整语义覆盖的位置吸收 Typora 的经验。段落菜单承载块级 Markdown 结构和文档级插入能力；格式菜单承载行内样式和行内内容能力。标题一级到六级放入“标题”二级菜单，一级菜单保留“段落”“提升标题级别”“降低标题级别”等高频块级动作。未实现但决定保留的能力保持可点击，点击后关闭菜单并显示 1.5 秒轻提示，提示文案为“{功能名} 功能开发中”。

## User Stories

1. As a Markdown writer, I want the paragraph menu to stay lightweight, so that I can find block-level actions without scanning a long Typora-style menu.
2. As a Markdown writer, I want heading levels to live under a “标题” submenu, so that H1-H6 remain available without taking over the top-level menu.
3. As a Markdown writer, I want to set the current block back to “段落”, so that I can quickly leave heading or block structure editing.
4. As a Markdown writer, I want heading promotion and demotion to appear near heading controls, so that title-level editing feels discoverable.
5. As a Markdown writer, I want table insertion in the paragraph menu, so that basic table creation is treated as a block-level writing action.
6. As a technical writer, I want code blocks and formula blocks in the paragraph menu, so that technical document structures are grouped with other block elements.
7. As a Markdown writer, I want blockquote insertion in the paragraph menu, so that quoted content is treated as a semantic block rather than an inline format.
8. As a Markdown writer, I want ordered lists, unordered lists, and task lists grouped together, so that common list actions are easy to compare.
9. As a Markdown writer, I want insert-paragraph-above and insert-paragraph-below actions, so that I can escape or extend around structured blocks.
10. As a technical writer, I want chart insertion to be visible even if it is not implemented yet, so that Mermaid 图表 remains part of the planned technical writing surface.
11. As a long-form writer, I want footnote insertion to be visible even if it is not implemented yet, so that citation-style writing has a clear future entry point.
12. As a Markdown writer, I want horizontal rule insertion in the paragraph menu, so that document separation is available from the same block-level menu.
13. As a long-document writer, I want content directory insertion to be visible even if it is not implemented yet, so that Outline-derived document navigation can later become an insertable document structure.
14. As a Markdown-first user, I want YAML Front Matter to be visible even if it is not implemented yet, so that document metadata remains acknowledged by the menu model.
15. As a Markdown writer, I want bold, italic, underline, 行代码, and 行公式 grouped together, so that common inline styles appear in a predictable order.
16. As a Markdown writer, I want strikethrough, highlight, and annotation grouped together, so that extended inline styles remain near the basic formatting controls.
17. As a Markdown writer, I want hyperlink and image actions grouped together, so that content references are easy to find.
18. As a Markdown writer, I want clear style to be the final format action, so that resetting inline style is easy to locate.
19. As a user, I want unavailable planned actions to stay clickable instead of disabled, so that I receive a clear “功能开发中” response rather than wondering whether the menu is broken.
20. As a Windows-first desktop user, I want shortcuts shown wherever the product has or can confidently mirror existing Typedown/Typora shortcuts, so that menu discovery and keyboard learning reinforce each other.
21. As a returning user, I want existing project wording to be preserved, so that “行代码”“行公式”等名称 stay consistent with the rest of the editor.
22. As a maintainer, I want menu definitions to map cleanly onto EditorCore commands or explicit planned placeholders, so that UI menu changes do not leak ProseMirror details into application components.
23. As a maintainer, I want web titlebar menus and native desktop menus to follow one product specification, so that Windows-first behavior remains consistent across surfaces.

## Implementation Decisions

- The top-level menu names remain “段落” and “格式”.
- The menu direction is biased toward Typedown: keep the top level compact, avoid adding Typora-only advanced branches unless the user explicitly selected them.
- Existing project wording wins over external references. The format menu uses “行代码” and “行公式”; missing or newly introduced labels lean toward Typedown wording.
- The paragraph menu contains these groups:
  - “标题” submenu with 一级标题、二级标题、三级标题、四级标题、五级标题、六级标题.
  - 段落、提升标题级别、降低标题级别.
  - 表格、代码块、公式块.
  - 引用、有序列表、无序列表、任务列表.
  - 在上方插入段落、在下方插入段落.
  - 图表、脚注、水平分割线、内容目录、YAML Front Matter.
- The format menu contains these groups:
  - 加粗、斜体、下划线、行代码、行公式.
  - 删除线、高亮、注释.
  - 超链接、图像.
  - 清除样式.
- Menu items do not show checked state for the current block or inline style in this PRD.
- Heading level shortcuts are only shown when already implemented or confidently supported; do not invent unsupported H1-H6 accelerator behavior for display only.
- For the rest of the menus, shortcut display should mirror existing project shortcuts first and Typedown/Typora references where they are already supported or confidently planned.
- Planned but unimplemented actions must remain visually enabled and clickable.
- Clicking a planned but unimplemented action closes the menu and shows a 1.5 second lightweight prompt.
- Planned placeholder prompt text is exactly “{功能名} 功能开发中”.
- The prompt should use the app’s existing lightweight notification mechanism if one exists; otherwise introduce a small bottom-center transient prompt.
- Menu action dispatch should go through the application command boundary and then EditorCore where editing behavior exists. ProseMirror Adapter details must remain inside EditorCore.
- Content directory should be treated as a future document-level insertion or Outline-derived writing feature, not as the left-side resource explorer.
- YAML Front Matter should align with the project’s Front matter concept: Markdown metadata at the start of the document, not application settings.
- 图表 should align with Mermaid 图表 as a Markdown-first technical writing capability.
- 图像 should align with the resource-directory model: future implementation should preserve Markdown-first local file references rather than implying base64 embedding or cloud upload.

## Testing Decisions

- Good tests should verify externally visible behavior: menu labels, grouping, submenu placement, shortcut text visibility, action dispatch, menu closing, and transient prompt behavior.
- Tests should not assert internal Svelte component layout details beyond stable user-facing menu structure.
- Menu rendering tests should cover that “标题” is a submenu and H1-H6 are no longer all top-level paragraph items.
- Menu rendering tests should cover that “段落” appears directly after the “标题” submenu and before heading promotion/demotion actions.
- Menu rendering tests should cover the final paragraph menu grouping and the final format menu grouping.
- Interaction tests should cover that implemented actions still dispatch their existing EditorCore/application commands.
- Interaction tests should cover that planned placeholders are enabled, close their menu when clicked, and show “{功能名} 功能开发中” for 1.5 seconds.
- Shortcut tests should cover existing global/menu shortcut behavior for supported items and ensure unsupported shortcuts are not displayed merely as decoration.
- Desktop integration tests or focused command-dispatch tests should cover parity between native window menu command ids and the titlebar menu where both surfaces expose the same action.
- EditorCore tests are only required for newly implemented editing behavior. Pure menu reorganization should prefer component and command-dispatch tests over deep editor tests.

## Out of Scope

- Implementing chart insertion, footnotes, content directory insertion, YAML Front Matter editing, annotation, highlight, image insertion, hyperlink editing, heading promotion/demotion, insert paragraph above/below, or clear style unless a separate implementation issue selects those behaviors.
- Rewriting EditorCore, MarkdownBridge, ProseMirror Adapter, rendering services, table controls, or persistence logic.
- Adding Typora-style advanced submenus such as task state, list indentation, link operations, image operations, code tools, or admonition panels.
- Adding checked/current-state indicators to menu items.
- Changing menus outside “段落” and “格式”.
- Changing the visual design of the full titlebar, window controls, explorer sidebar, editor workspace, or status bar.

## Further Notes

- This PRD is intentionally a product/menu-spec PRD first. It defines the desired menu information architecture and placeholder behavior before committing to full editing implementation.
- The current codebase already has pieces of this behavior: heading commands, paragraph command, list commands, blockquote command, table picker, code block insertion, formula block insertion, global shortcuts, and desktop command dispatch. The implementation work should preserve those existing behaviors while moving them into the newly agreed menu structure.
- The feature supports the project’s broader direction: a Windows-first, Markdown-first editor with semantic editing and a Typedown-like lightweight desktop feel.
