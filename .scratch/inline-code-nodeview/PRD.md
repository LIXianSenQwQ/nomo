Status: needs-triage

# PRD: 行内代码展示、轻量语法提示与单输入框编辑

## Problem Statement

当前 **行内代码** 已经是 Markdown 标准能力，用户可以通过一对反引号输入类似 `` `const ok = true` `` 的内容，但它在语义编辑体验中仍接近普通 `code` mark：展示、选中、编辑和复制没有形成类似 **数学公式** 的独立交互单元。

用户希望第一阶段增强 **行内代码** 的语义编辑体验：它仍保存为标准 Markdown 行内代码，但在语义模式中显示为独立代码片段，提供基础的轻量语法提示，点击后用一个输入框编辑反引号内部文本，并能在选中后复制完整 Markdown 语法。

## Solution

第一阶段将 **行内代码** 作为可交互的行内语义片段处理，交互模型参考现有 **数学公式** 的行内 NodeView：

- 展示态：以轻量代码胶囊展示反引号内部代码文本。
- 轻量语法提示：对少量通用 token 做视觉区分，例如常见关键字、布尔值、数字、字符串和基础符号；不做完整语言级语法高亮。
- 编辑态：点击行内代码后进入单输入框，只编辑反引号内部代码文本。
- 回写：退出编辑态后自动序列化为标准 Markdown 行内代码。
- 复制：选中整个行内代码节点后按 `Ctrl+C`，复制完整 Markdown 语法，例如 `` `const ok = true` ``。
- 范围：不做悬停复制按钮，不做语言属性，不做执行状态，不做自动语言猜测，不处理多行代码块增强。

## User Stories

1. As a Markdown writer, I want `` `const ok = true` `` to appear as an inline code snippet in semantic mode, so that code fragments are visually distinct while writing.
2. As a Markdown writer, I want common code tokens inside inline code to have lightweight visual hints, so that snippets are easier to scan.
3. As a Markdown writer, I want lightweight syntax hints to work without declaring a language, so that standard Markdown inline code remains simple.
4. As a Markdown writer, I want lightweight syntax hints to avoid changing the saved Markdown, so that visual treatment never modifies my document text.
5. As a Markdown writer, I want unknown or ambiguous code text to still display normally, so that syntax hinting never hides or corrupts content.
6. As a Markdown writer, I want to click an inline code snippet to edit it, so that I can correct short code without switching to source mode.
7. As a Markdown writer, I want inline code editing to use a single input box, so that the interaction stays lightweight.
8. As a Markdown writer, I want the input box to show only the code text inside the backticks, so that I do not need to manually manage Markdown delimiters.
9. As a Markdown writer, I want saving the inline edit to restore the Markdown backticks automatically, so that the saved document remains standard Markdown.
10. As a Markdown writer, I want `Enter` to save and exit inline code editing, so that the behavior matches the existing inline formula editing pattern.
11. As a Markdown writer, I want `Escape` to cancel inline code editing, so that accidental edits can be discarded.
12. As a Markdown writer, I want left and right arrow keys at input boundaries to leave the inline code snippet, so that keyboard navigation feels consistent with inline formulas.
13. As a Markdown writer, I want clicking outside or losing focus to commit the current inline code edit, so that editing does not leave a half-applied UI state.
14. As a Markdown writer, I want inline code containing spaces to round-trip correctly, so that examples like `` `const ok = true` `` keep their exact meaning.
15. As a Chinese technical writer, I want inline code containing Chinese text or mixed symbols to round-trip correctly, so that localized examples are not damaged.
16. As a Markdown writer, I want inline code containing punctuation to round-trip correctly, so that snippets such as `` `foo.bar()` `` are preserved.
17. As a Markdown writer, I want empty or whitespace-only edits to be handled predictably, so that invalid inline code does not silently corrupt the document.
18. As a Markdown writer, I want selecting an inline code snippet and pressing `Ctrl+C` to copy complete Markdown syntax, so that I can paste `` `const ok = true` `` elsewhere.
19. As a Markdown writer, I want copying inline code to include the surrounding backticks, so that pasted content remains Markdown-ready.
20. As a Markdown writer, I do not want a hover copy button, so that the editor surface stays clean.
21. As a Markdown writer, I want manually typing backtick-wrapped text in semantic mode to become an inline code snippet, so that creation feels as light as normal Markdown writing.
22. As a Markdown writer, I want source mode to continue showing normal Markdown backtick syntax, so that there is no hidden private format.
23. As a Markdown writer, I want switching between source mode and semantic mode to preserve inline code, so that the two modes remain views of the same Markdown document.
24. As a Markdown writer, I want inline code not to support language attributes in this phase, so that it remains standard Markdown inline code.
25. As a Markdown writer, I want inline code not to be executable, so that code snippets remain writing content rather than application commands.
26. As a Markdown writer, I want multi-line code blocks to stay separate from this feature, so that future code block work can be designed independently.
27. As a maintainer, I want the feature to be implemented through **EditorCore**, so that Svelte components do not depend on ProseMirror internals.
28. As a maintainer, I want Markdown parsing and serialization to remain behaviorally testable, so that future editor changes do not break standard inline code.
29. As a maintainer, I want clipboard behavior to be covered by tests or a clear verification path, so that copy behavior does not regress.
30. As a maintainer, I want inline code enhancement to avoid changing code blocks, so that fenced code block behavior remains stable.
31. As a maintainer, I want this feature to follow the existing inline formula interaction pattern, so that the codebase keeps one consistent editing model for inline semantic fragments.

## Implementation Decisions

- Treat this PRD as **行内代码增强**, not **自定义标签**.
- Keep **行内代码** as Markdown standard syntax: one pair of backticks around plain code text.
- The saved document must remain Markdown-first. No private rich-text payload, hidden component metadata, language attributes, or execution metadata should be introduced.
- Use the existing **数学公式** inline editing model as the closest interaction reference.
- Represent enhanced inline code as an atomic or otherwise node-like inline editing unit in semantic mode, if that is the cleanest way to support selection, single-input editing, lightweight syntax hints, and Markdown-aware copying.
- Keep the application layer behind **EditorCore** contracts. UI components should not directly manipulate ProseMirror state or selections for this feature.
- Add an inline code NodeView or equivalent EditorCore-internal view layer for display and edit mode.
- Display mode should show only the code text, styled as a lightweight inline code capsule.
- Display mode should include lightweight syntax hints for common token classes.
- Lightweight syntax hints should be language-agnostic and conservative.
- Suggested token classes for the first pass are common keywords, booleans/null-like literals, numbers, quoted strings, and simple operators or punctuation.
- Lightweight syntax hints must not mutate Markdown, affect parsing, or create extra document state.
- Unknown, mixed, or ambiguous inline code should fall back to ordinary escaped text inside the inline code display.
- Do not use automatic language detection or Shiki for inline code in this phase unless later explicitly scoped; line-level code block highlighting remains separate.
- Edit mode should replace the display with one input box.
- Edit mode input value should be the inner code text only, without backticks.
- Commit should serialize the inner text back into Markdown inline code with backticks.
- Cancel should restore the previous inner code text.
- Keyboard behavior should mirror inline formula where applicable: `Enter` commits, `Escape` cancels, boundary arrow keys leave the editing unit.
- Creation should work through manual Markdown typing. When the user types a complete backtick-wrapped inline code snippet in semantic mode, it should become the enhanced inline code unit.
- Copy behavior should be node-selection based. When the entire inline code unit is selected and the user copies, clipboard plain text should be the complete Markdown syntax, including backticks.
- Do not add a hover copy icon or button in this phase.
- Do not add language detection, full syntax highlighting, execution, variable interpolation, attributes, or validation beyond preserving Markdown inline code safely.
- Do not treat lightweight syntax hints as full syntax highlighting. They are visual token hints only and should not claim language correctness.
- Do not change multi-line fenced code block behavior in this phase.
- Preserve source mode behavior: source mode should show and edit ordinary backtick Markdown syntax.
- Avoid broad Markdown parser refactors unless required to keep inline code round-trips correct.

## Testing Decisions

- Tests should focus on external behavior: Markdown in, semantic editing behavior, Markdown out, visual token classification, and clipboard result.
- Markdown parsing should verify that `` `const ok = true` `` is recognized as the enhanced inline code semantic unit or its chosen EditorCore representation.
- Markdown serialization should verify that the enhanced inline code writes back to standard Markdown syntax.
- Round-trip tests should cover simple ASCII code, spaces, punctuation, Chinese text, and mixed symbols.
- Lightweight syntax hint tests should verify common token classes are wrapped or classified for display without changing Markdown serialization.
- Lightweight syntax hint tests should verify ambiguous or unknown code text still renders as escaped plain code content.
- Editing tests should verify that changing the inner text updates the final Markdown while preserving backticks.
- Cancel behavior should verify that `Escape` restores the old inline code content.
- Keyboard behavior should verify `Enter` commit and boundary arrow navigation where feasible in the existing test environment.
- Clipboard behavior should verify that selecting the whole inline code unit and copying produces complete Markdown syntax, not only inner text.
- Protection tests should verify fenced code block content is not converted into the enhanced inline code unit.
- Protection tests should verify existing inline formula behavior remains unaffected by inline code changes.
- Prior art: follow the behavior-level style of existing inline formula and Markdown round-trip tests, especially the tests around parsing, serialization, boundary cases, and semantic input conversion.

## Out of Scope

- Custom `::tag{...}正文::` syntax.
- Multi-line custom block syntax.
- Multi-line fenced code block editing improvements.
- Code block language selection or syntax highlighting changes.
- Full language-aware syntax highlighting for inline code.
- Automatic language guessing for inline code.
- Shiki-based inline code rendering.
- Hover copy button or visible copy icon.
- Running code snippets.
- Inline code language metadata.
- Nested Markdown inside inline code.
- Rich attribute panels or structured property editors.
- Full Markdown source map or parser architecture rewrite.

## Further Notes

The user initially described the idea as “自定义标签”, but clarified that the actual target is **行内代码**: text wrapped by a single pair of backticks, such as `` `const ok = true` ``. This ambiguity has been recorded in the project context so future planning does not conflate Markdown standard inline code with custom tag syntax.

This PRD should be treated as a focused first phase. The goal is to make **行内代码** feel as clean and editable as existing inline formulas while preserving Markdown standard syntax, adding only conservative lightweight syntax hints, and avoiding feature creep.
