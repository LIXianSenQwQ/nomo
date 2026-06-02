Status: ready-for-agent

# PRD: 跨行代码块节点展示、编辑与语言选择

## Problem Statement

当前 **跨行代码块** 已经能通过 Markdown fenced code block 表达，并在语义模式中具备基础展示、高亮、行号、复制和 Mermaid 预览能力。但它还没有形成接近 Typora 的完整语义编辑体验：用户点击代码块后不能以块级节点方式直接编辑代码正文和语言类型，编辑态高亮、行号、滚动、缩进、复制边界和语言切换也缺少明确产品约束。

用户希望在已完成 **行内代码** 增强之后，继续实现 **跨行代码块节点**：它仍保存为标准 Markdown fenced code block，在语义模式里以独立代码块节点展示和编辑；操作逻辑参考现有 **跨行公式块** 的展示态/编辑态切换，但代码块编辑态必须始终保留语法高亮，并在右下角提供参考 Typora 的语言类型选择框。

## Solution

新增或改造 **跨行代码块节点** 的语义编辑能力：

- 保存格式继续使用标准 Markdown fenced code block，不引入私有语法。
- 展示态保留代码高亮、行号、语言标签和复制按钮。
- Mermaid 不再作为代码块节点的特殊预览分支；后续另起 Mermaid 自定义节点。
- 点击代码块进入编辑态，编辑态使用“输入层 + 高亮层”的叠层方案，保证编辑时也始终显示高亮。
- 编辑态右下角提供可搜索、可输入的语言类型下拉框，允许从常用语言中选择，也允许保存自定义语言名。
- 普通 `Enter` 在代码中换行，`Ctrl+Enter` 保存退出，`Esc` 取消退出，点击外部或失焦保存退出。
- `Tab` 在代码输入区插入 2 个空格，`Shift+Tab` 对当前行减少一级缩进。
- 行号只作为视觉 gutter，不进入文档内容、选区文本或剪贴板。
- 复制按钮只复制代码正文；节点选中后 `Ctrl+C` 复制完整 Markdown fenced code block。
- 长行默认横向滚动，不自动换行。
- 代码块高度随内容增长，但设置最小值和最大值，超过最大值后内部滚动。

## User Stories

1. As a Markdown writer, I want fenced code blocks to remain standard Markdown, so that my files stay portable.
2. As a Markdown writer, I want semantic mode to show code blocks as independent blocks, so that code content is easier to scan while writing.
3. As a Markdown writer, I want code blocks to preserve syntax highlighting in display mode, so that code remains readable.
4. As a Markdown writer, I want code blocks to preserve syntax highlighting while editing, so that editing does not feel like falling back to plain text.
5. As a Markdown writer, I want code blocks to show line numbers, so that I can locate code lines quickly.
6. As a Markdown writer, I want line numbers to be visually separated from code, so that they never become part of the code content.
7. As a Markdown writer, I want copying code via the copy button to copy only the code body, so that I can paste it into an IDE or terminal.
8. As a Markdown writer, I want selecting the whole code block and pressing `Ctrl+C` to copy full Markdown syntax, so that I can paste the block back into Markdown.
9. As a Markdown writer, I want line numbers to never appear in copied text, so that copied code and Markdown remain clean.
10. As a Markdown writer, I want to click a code block to edit it in place, so that I do not need to switch to source mode.
11. As a Markdown writer, I want the edit interaction to feel similar to cross-line formulas, so that semantic block editing stays consistent.
12. As a Markdown writer, I want `Ctrl+Enter` to save and exit code editing, so that multi-line code can still use normal `Enter`.
13. As a Markdown writer, I want `Esc` to cancel code editing, so that accidental edits can be discarded.
14. As a Markdown writer, I want clicking outside a code block to save the current edit, so that edits are not left in a temporary UI state.
15. As a Markdown writer, I want normal `Enter` to insert a newline, so that I can write multi-line code naturally.
16. As a Markdown writer, I want `Tab` to insert indentation inside code, so that the focus does not jump out of the editor.
17. As a Markdown writer, I want `Shift+Tab` to reduce indentation, so that I can adjust nested code quickly.
18. As a Markdown writer, I want the default indentation to be 2 spaces, so that it matches common Markdown and frontend writing habits.
19. As a Markdown writer, I want long code lines to scroll horizontally, so that code alignment and line numbers remain stable.
20. As a Markdown writer, I do not want long lines to auto-wrap in the first phase, so that code structure remains predictable.
21. As a Markdown writer, I want short code blocks to grow with content, so that the block does not waste space.
22. As a Markdown writer, I want long code blocks to have a maximum height and internal scroll, so that one block does not dominate the whole document.
23. As a Markdown writer, I want empty code blocks to be allowed, so that I can create a block first and fill it later.
24. As a Markdown writer, I want typing three backticks to create an empty code block and enter editing, so that creation feels lightweight.
25. As a Markdown writer, I want existing fenced code blocks to parse into enhanced code blocks, so that old Markdown documents benefit from the new behavior.
26. As a Markdown writer, I want code blocks to serialize back to fenced code blocks, so that source mode remains familiar.
27. As a Markdown writer, I want the language type control to appear in the lower-right corner while editing, so that it matches Typora-like expectations.
28. As a Markdown writer, I want the language type control to be searchable, so that I can quickly find a language.
29. As a Markdown writer, I want the language type control to accept custom input, so that unsupported or project-specific language names are not blocked.
30. As a Markdown writer, I want changing the language to refresh highlighting immediately, so that I can see whether the selected language is correct.
31. As a Markdown writer, I want unsupported languages to degrade to plain text, so that editing and saving are never blocked by highlighting failures.
32. As a Markdown writer, I want the language name to be saved after the opening fence, so that Markdown consumers can still detect the language.
33. As a Markdown writer, I want the first phase to edit only the language name, so that extra metadata does not complicate the language selector.
34. As a Markdown writer, I want existing extra fence parameters to be preserved when feasible, so that opening older documents does not unnecessarily destroy metadata.
35. As a Markdown writer, I want Mermaid code blocks to behave as ordinary code blocks for now, so that code block responsibilities stay focused.
36. As a Markdown writer, I want Mermaid diagram editing to be designed as a separate custom node later, so that diagram interaction can get its own product model.
37. As a Markdown writer, I want clicking inside code to place the cursor near the clicked position when feasible, so that editing feels direct.
38. As a Markdown writer, I want the first phase to at least focus the code editor reliably after clicking, so that interaction never feels broken.
39. As a maintainer, I want this feature implemented behind EditorCore, so that Svelte components do not depend on ProseMirror internals.
40. As a maintainer, I want the code block NodeView to avoid Mermaid-specific preview logic, so that future Mermaid nodes can be built independently.
41. As a maintainer, I want code block parsing and serialization to be covered by behavior tests, so that Markdown-first persistence does not regress.
42. As a maintainer, I want copy behavior to be tested separately for button copy and node-selection copy, so that the two clipboard contracts remain distinct.
43. As a maintainer, I want line number isolation tested or explicitly verified, so that gutter UI never leaks into content.
44. As a maintainer, I want existing inline code and math block behavior to remain unchanged, so that this work does not regress completed semantic nodes.

## Implementation Decisions

- Treat this PRD as **跨行代码块节点增强**，not Mermaid 图表节点、not 私有代码组件语法。
- Keep **跨行代码块** as standard Markdown fenced code block.
- The saved document must remain Markdown-first. No private rich-text payload, hidden component metadata, or non-Markdown code block syntax should be introduced.
- Use the existing **跨行公式块** interaction as the closest lifecycle reference: display mode, click to edit, save, cancel, blur commit.
- Do not copy the cross-line formula preview layout. Code block edit mode should not add a separate preview pane because code itself is the editable content.
- Edit mode must keep syntax highlighting visible at all times.
- Use a layered editing model: one input layer owns text input and selection, and one highlight layer renders tokenized code underneath or alongside it.
- The layered editing model must keep input text, highlighted text, line numbers and scroll positions synchronized.
- Clicking the code body should try to place the cursor at the clicked position. If exact character placement proves too costly in the first implementation, the fallback must still focus the code editor predictably and place the caret near the clicked line or at the text end.
- Display mode should preserve existing code highlighting behavior where possible.
- Display mode should preserve line numbers.
- Edit mode should also show line numbers.
- Line numbers are visual-only gutter content. They must not enter document text, normal code copy, Markdown copy, or intended code selection.
- The line number gutter should be separated from the code selection surface in both DOM structure and CSS behavior.
- The copy button copies only the code body text.
- Node-selection copy copies the complete fenced code block Markdown, including fences and language name.
- Long lines should use horizontal scrolling and should not auto-wrap in the first phase.
- Code block height should grow with content, with a minimum of 3 lines.
- Code block height should cap at approximately 24 lines or 60vh, whichever is smaller; beyond that, the code block scrolls internally.
- Empty code blocks are valid and should serialize as fenced code blocks with empty content.
- Manual typing of three backticks should create an empty code block and enter edit mode when feasible.
- Existing fenced code blocks should parse into the enhanced code block representation.
- Serialization should output standard fenced code block syntax.
- The language value is the first language token after the opening fence.
- The first phase should edit only the language name.
- Extra fence parameters such as titles or line highlight metadata are not part of the language selector UI in this PRD.
- Existing extra fence parameters should be preserved when feasible, but the implementation should not introduce a full info-string editor.
- The language selector should appear in the lower-right corner in edit mode.
- The language selector should be searchable and should support keyboard input.
- The language selector should include common options such as Plain Text, JavaScript, TypeScript, HTML, CSS, JSON, Markdown, Python, Java, Shell, SQL, YAML, Diff and Mermaid.
- The language selector should match both visible labels and aliases such as `js`, `ts`, `py`, `sh`, `bash`, `md` and `plaintext`.
- The user may enter and save a custom language string that is not present in the built-in list.
- Changing the language should refresh highlighting immediately in edit mode.
- Highlighting failure, unsupported language or tokenizer load failure should degrade to plain text and must not block editing or saving.
- Mermaid preview should be removed from the code block NodeView in this PRD.
- A `mermaid` fenced code block should behave as an ordinary code block with language `mermaid`.
- Mermaid custom node design and fenced-mermaid conversion are explicitly future work.
- `Ctrl+Enter` saves and exits edit mode.
- `Escape` cancels the current edit and restores the original code body and language.
- Blur or clicking outside saves and exits edit mode.
- Normal `Enter` inserts a newline inside the code.
- `Tab` inserts 2 spaces in the code input.
- `Shift+Tab` removes one 2-space indentation level from the current line or selected lines where possible.
- The language selector's `Enter` should commit the language value and return focus to code editing, not exit the entire code block edit mode.
- Keep application-level access behind **EditorCore** contracts. Svelte components should not directly manipulate ProseMirror state, selections or NodeViews for this feature.
- Avoid broad Markdown parser refactors unless required for safe fenced code block round-trips.

## Phased Implementation Plan

### Phase 1: 清理现有代码块边界

- Remove Mermaid preview-specific behavior from the current code block NodeView.
- Keep `mermaid` as an ordinary language value in code blocks.
- Keep copy, language display, highlighting and line-number responsibilities within the code block node.
- Record Mermaid custom node work as out of scope for this PRD.
- Verify that removing Mermaid preview does not break ordinary fenced code block parsing or rendering.

### Phase 2: Markdown 与节点行为基线

- Ensure fenced code blocks parse into the enhanced code block representation.
- Ensure serialization writes standard fenced code blocks.
- Ensure empty fenced code blocks are allowed and round-trip correctly.
- Ensure the language name is stored and serialized after the opening fence.
- Preserve existing extra fence parameters when feasible, without adding UI for them.
- Add or keep an EditorCore command path for inserting a new empty code block.
- Make manual three-backtick creation enter the new code block editing flow when feasible.

### Phase 3: 展示态体验

- Preserve syntax highlighting in display mode.
- Preserve line numbers in display mode.
- Keep line number gutter visually separate and non-selectable.
- Keep long lines horizontally scrollable and non-wrapping.
- Keep a display-mode language label.
- Keep a display-mode copy button that copies only code body text.
- Add or adjust node-selection copy so `Ctrl+C` copies full fenced Markdown.
- Add graceful fallback for unsupported or failed highlighting.

### Phase 4: 编辑态基础闭环

- Clicking the code block enters edit mode.
- Implement the input layer plus highlight layer editing model.
- Keep syntax highlighting visible while editing.
- Use `Ctrl+Enter` to save and exit.
- Use `Esc` to cancel and exit.
- Use blur or clicking outside to save and exit.
- Let normal `Enter` insert new lines.
- Save code body and language back into the code block node.
- Restore original code body and language on cancel.

### Phase 5: 编辑态工程细节

- Keep edit-mode line numbers visible.
- Synchronize scrolling between line numbers, input layer and highlight layer.
- Implement `Tab` as 2-space indentation.
- Implement `Shift+Tab` as indentation reduction for current line or selected lines.
- Apply minimum height of 3 lines.
- Apply maximum height of approximately 24 lines or 60vh, whichever is smaller.
- Use internal scrolling after the maximum height.
- Keep long lines horizontally scrollable in edit mode.
- Try to map click position to a nearby caret position in the code input.

### Phase 6: 语言选择器与测试收口

- Add the lower-right edit-mode language selector.
- Make the selector searchable.
- Support common language labels and aliases.
- Allow custom language input and saving.
- Refresh highlighting immediately after language changes.
- Make `Enter` in the selector commit language and return focus to code editing.
- Cover Markdown round-trip, copy contracts, line-number isolation, editing shortcuts, language changes, highlighting fallback and regression cases.

## Testing Decisions

- Tests should focus on external behavior: Markdown input, semantic editing behavior, Markdown output, clipboard result and visible interaction contracts.
- Markdown round-trip tests should cover plain fenced code, language-tagged fenced code, empty code block, multiline content and code containing backticks.
- Serialization tests should verify standard fenced code block output.
- Language tests should verify that language names round-trip correctly.
- Extra parameter tests should verify that existing unsupported fence metadata is not unnecessarily destroyed when feasible.
- Copy tests should verify that the copy button returns only the code body.
- Copy tests should verify that node-selection `Ctrl+C` returns full fenced Markdown.
- Copy tests should verify that line numbers never appear in copied output.
- Display tests should verify that line numbers are rendered separately from code content.
- Editing tests should verify `Ctrl+Enter` save, `Esc` cancel, blur save and normal `Enter` newline behavior.
- Indentation tests should verify `Tab` inserts 2 spaces and `Shift+Tab` removes indentation where applicable.
- Height and scrolling behavior should be verified with component or DOM-level tests where practical, and manually verified if the current test environment cannot represent layout accurately.
- Highlighting tests should verify that unsupported languages degrade to plain text without blocking edit or save.
- Language selector tests should verify built-in language selection, alias search and custom language entry.
- Regression tests should verify that **行内代码**, **行内公式** and **跨行公式块** still parse, edit and serialize as before.
- Prior art: follow the behavior-level style of existing inline code, math inline, math block and Markdown round-trip tests.

## Out of Scope

- Mermaid custom node implementation.
- Mermaid preview/source toggle inside code blocks.
- Fenced Mermaid to Mermaid node conversion.
- Running code snippets.
- Full IDE-like code editor behavior.
- LSP, autocomplete, diagnostics or formatting.
- Full info-string editor for title, metadata or highlighted line ranges.
- Automatic language detection.
- Auto-wrap display mode.
- User-configurable tab size.
- Theme picker for syntax highlighting.
- Global code block settings panel.
- Structural editing for code ASTs.
- Changing source mode behavior beyond preserving standard Markdown.

## Further Notes

This PRD intentionally separates **跨行代码块节点** from future **Mermaid 图表节点** work. Although current code already has Mermaid preview behavior inside the code block NodeView, the user confirmed that Mermaid should become its own custom node later. The current feature should therefore make code blocks more focused and predictable instead of expanding diagram-specific behavior inside them.

The key UX decision is that editing must remain highlighted. A plain textarea-only edit mode is not acceptable for this feature. The likely implementation path is a Typora-like layered editor surface where a real input layer handles text editing and a rendered highlight layer handles visual syntax coloring.

The second key UX decision is clipboard separation: the copy button is for code users and copies only code body text; node-selection copy is for Markdown users and copies the complete fenced code block syntax.
