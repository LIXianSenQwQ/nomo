# 阶段 5 状态文档

日期: 2026-05-31
PRD: .scratch/phase-5-architecture-consolidation/PRD.md
当前 svelte-check: 0 errors, 70 warnings
pnpm test: 36 passed (9 files)

## 已完成

### 新建文件
- src/lib/markdown/sample.ts -- createRichMarkdownSample() 搬家
- src/lib/markdown/normalize.ts -- normalizeMarkdownForSave() 搬家
- src/lib/markdown/normalize.test.ts -- 7 个测试用例

### 修复的问题

1. **types.ts: 60-69** — scrollToHeading 条目误用 `;` 终止了 EditorCommand union 类型，导致 8 个 svelte-check 错误。
   - 修复：去掉第 67 行 union 成员尾部 `;`，使 scrollToHeading 成为 union 合法成员。

2. **createEditorCore.ts: 469-523** — `runProseMirrorCommand` switch 语句缺少 `case 'scrollToHeading'` 分支。
   - 修复：在 `default:` 前添加 `case 'scrollToHeading'` → `this.scrollToHeading(command.headingIndex, command.text)`。

3. **createEditorCore.ts: 531** — `scrollToHeading` 实现中错误检查 `node.textContent === text`，导致只有第一个 heading 能被匹配。
   - 修复：去掉 textContent 检查，只用 `node.type.name === "heading"` + `headingCount === headingIndex + 1`。

4. **App.svelte: 80** — outline 200ms debounce 使用了未声明的 `outlineDebounceTimer` 变量。
   - 修复：在 `let stats` 前添加 `let outlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;`。

5. **App.svelte: 1017-1026** — `jumpToOutlineItem` 函数中语义模式跳转仍用 DOM 查询 `.rich-markdown` heading。
   - 修复：替换为 `editor.execute({ type: 'scrollToHeading', ... })`。

6. **tauriStorage.ts** — 缺少 `parseNativeError` 函数导出（tauriStorage.test.ts 需要）。
   - 修复：添加 parseNativeError 实现，支持 `[ERROR_CODE] message` 格式解析和 Error 对象递归处理。

7. **App.svelte CSS** — 删除死 CSS：`.rich-markdown`, `.task-row`, `.table-scroll`, `.code-line`, `.line-number`, `.line-content`, `.code-card.wrapped`, `.code-line.diff-added/removed`, `.topbar-spacer`, `.theme-toggle-btn`。

### 删除的旧模块
- src/lib/markdown/richMarkdown.ts (含测试)
- src/lib/markdown/technicalBlocks.ts (含测试)

### 验证结果
- pnpm check: 0 errors ✅
- pnpm test: 36 passed (9 test files) ✅
- pnpm build: ✓ built ✅

## 剩余问题
- 70 个 unused CSS warnings — 部分为阶段 5 前已存在的死 CSS（.explorer、.menu-bar 等），建议后续清理
- 代码块换行 CSS 变量（--md-editor-code-wrap）在 theme.css 中已定义但未接入 App.svelte

## 修改文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| src/app/App.svelte | M | outlineDebounceTimer, import 修复, jumpToOutlineItem, CSS 清理 |
| src/lib/desktop/tauriStorage.ts | M | 添加 parseNativeError |
| src/lib/desktop/tauriStorage.test.ts | A | 新增 parseNativeError 测试 + Windows-first 路径编码测试 |
| src/lib/editor-core/createEditorCore.ts | M | 添加 scrollToHeading case, 修复 heading 查找逻辑 |
| src/lib/editor-core/createEditorCore.test.ts | M | 新增 scrollToHeading 测试 (2 cases) |
| src/lib/editor-core/index.ts | M | 重导出 setCodeBlock* |
| src/lib/editor-core/types.ts | M | 修复 scrollToHeading union 语法 |
| src/lib/markdown/richMarkdown.ts | D | 旧模块删除 |
| src/lib/markdown/richMarkdown.test.ts | D | 旧模块删除 |
| src/lib/markdown/technicalBlocks.ts | D | 旧模块删除 |
| src/lib/markdown/technicalBlocks.test.ts | D | 旧模块删除 |
| src/lib/markdown/normalize.ts | A | normalizeMarkdownForSave 搬家 |
| src/lib/markdown/normalize.test.ts | A | 7 个测试用例 |
| src/lib/markdown/sample.ts | A | createRichMarkdownSample 搬家 |
| .scratch/phase-5-architecture-consolidation/STATUS.md | M | 本文件 |
