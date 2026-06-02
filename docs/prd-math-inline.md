## Problem Statement

当前编辑器的数学公式渲染完全依赖 `mathBlock.ts` 的 decoration/widget 方案——`$...$` 在 ProseMirror 内部仍是普通文本节点，KaTeX 渲染结果通过绝对定位的 widget 覆盖显示。这导致两个问题：

1. **无法交互编辑**：公式只是视觉覆盖层（`contenteditable="false"`），用户无法点击公式编辑 LaTeX 源码，只能回到源码模式修改 markdown 文本。
2. **无语义结构**：`$...$` 不被识别为语义节点，搜索替换、结构化导出、无障碍访问等功能都缺失基础。

## Solution

将行内公式 `$...$` 提升为一等公民——实现为 ProseMirror **inline atomic node（`math_inline`）**，在 markdown-it 解析层识别、ProseMirror 文档树中承载语义、NodeView 负责展示与编辑交互。

**核心交互**：语义模式下默认显示 KaTeX 渲染结果；点击或键盘导航进入公式后，原地切换为 LaTeX 源码编辑态并弹出实时预览卡片；退出编辑态后恢复渲染态。

## User Stories

### 渲染与阅读
1. As a 写作者, I want 文档中 `$x^2$` 自动渲染为 KaTeX 数学公式并保持行内排版, so that 我可以像阅读排版完成的文章一样审阅包含数学公式的笔记。
2. As a 阅读者, I want 行内公式与周围文字基线对齐且不破坏段落行高, so that 包含公式的段落视觉上自然流畅。
3. As a 写作者, I want 渲染失败的公式回退显示原始 `$tex$` 文本（不丢失内容）, so that 我即使语法写错也不会丢失输入的内容。
4. As a 写作者, I want 切换到源码模式时行内公式自动还原为 `$...$` 标记文本, so that 我可以用纯文本方式继续编辑。

### 编辑交互
5. As a 写作者, I want 点击一个已渲染的行内公式后原地出现输入框允许修改 LaTeX 源码, so that 我不用切换到源码模式就能修正公式。
6. As a 写作者, I want 用键盘左右箭头导航到公式节点时自动进入编辑态, so that 我在纯键盘操作下也能编辑公式。
7. As a 写作者, I want 在编辑 LaTeX 源码时公式下方弹出实时 KaTeX 预览卡片, so that 我可以边改边看渲染结果。
8. As a 写作者, I want 预览卡片覆盖下方内容而不推挤正文布局, so that 排版不会随我编辑公式而上下跳动。
9. As a 写作者, I want 按 Enter 键确认编辑并退出编辑态, so that 编辑完成后的确认操作符合直觉。
10. As a 写作者, I want 按 Esc 键退出编辑态并丢弃修改, so that 我可以在编辑中途放弃。
11. As a 写作者, I want 点击公式外区域（失焦）自动退出编辑态并保存修改, so that 我的修改不会意外丢失。
12. As a 写作者, I want 在编辑态的 input 内左右箭头到达源码边界后继续向外走时退出编辑态, so that 键盘导航流不被公式阻塞。

### 编辑体验细节
13. As a 写作者, I want 编辑态 input 中的左右箭头在源码内部正常移动字符位置, so that 我可以在源码内精确定位光标。
14. As a 写作者, I want 预览卡片实时跟随公式节点位置（滚动/窗口大小变化时保持吸附）, so that 预览始终在公式下方可见。
15. As a 写作者, I want 预览卡片在公式滚出视口时自动隐藏, so that 不会出现悬浮卡片漂在空白区域。
16. As a 写作者, I want KaTeX 渲染错误仅显示在预览卡片中、不修改 input 中的源码, so that 渲染问题不会破坏我的输入。

### 结构化操作
17. As a 写作者, I want 选中包含行内公式的文本并按 Ctrl+C 复制后获得 `$tex$` 格式的纯文本, so that 我可以粘贴到其他 Markdown 编辑器。
18. As a 写作者, I want 在同一编辑器内粘贴含公式的内容时保留完整语义结构, so that 复制粘贴不丢信息。
19. As a 写作者, I want Backspace/Delete 可整体删除一个行内公式节点, so that 删除操作不需要进入编辑态全选手动清空。
20. As a 写作者, I want 编辑公式时的修改作为一个完整的 undo 步骤（而非逐字符记录）, so that 按一次 Ctrl+Z 就能撤销整个公式编辑。

### 边界场景
21. As a 写作者, I want Markdown 中的 `\$100` 不触发公式识别, so that 货币金额不被误解析。
22. As a 写作者, I want 代码块和行内代码中的 `$...$` 不被识别为公式, so that 代码示例不受干扰。
23. As a 写作者, I want `$` 未闭合时该字符作为普通文本显示, so that 不完整的书写不影响编辑体验。
24. As a 写作者, I want `$$...$$` 显示公式继续以 display math 方式单独成块渲染, so that 行内公式不影响现有 display math 功能。

## Implementation Decisions

### Architecture

**分层数据流**

Markdown 源码 → markdown-it inline ruler（`$...$` tokenizer）→ ProseMirror `math_inline` atomic node → MathInlineNodeView（渲染/编辑/预览）→ Markdown serializer（`$tex$`）

### Schema Design

- `math_inline` 节点类型：`inline: true, atom: true, selectable: true, draggable: false`
- Attributes：仅 `tex: string`（LaTeX 源码），不存储 `displayMode`、`html`、`focused` 等运行时状态
- `toDOM`：fallback 输出 `<span class="math-inline" data-tex="...">$tex$</span>`，不在此层引入 KaTeX 渲染
- `parseDOM`：优先从 `data-tex` 属性恢复，fallback 取 textContent

### markdown-it 集成

- 手写 inline ruler 识别 `$...$`，不引入额外 npm 依赖（如 markdown-it-texmath）
- Inline ruler 注册优先级排在 backticks/code_inline 之后，确保代码块内的 `$` 不被解析
- 正则约束：不允许 `$` 相邻位置为空格（避免 `$ 100` 货币误匹配）
- 支持 `\$` 转义

### Editing UX

- 编辑控件：`<input>` 元素（行内公式语义上为单行，多行需求由 display math 覆盖）
- 预览卡片：`position: fixed` 挂载到 `document.body`，左对齐公式节点、紧贴下方 4-6px，跟随滚动/窗口大小变化
- 编辑态状态管理：完全在 NodeView 内部，不写入 ProseMirror node attrs，避免渲染态/编辑态切换触发全局 re-render

### Undo/Redo

- 编辑期间（input 内键入）不同步 ProseMirror state，退出编辑态时通过一个 transaction 提交最终 tex 值
- 这样 undo 时一步撤销整个公式编辑，而非逐字符撤销

### Copy/Paste

- 复制到剪贴板：纯文本为 `$tex$`，HTML 包含 `<span data-tex="...">`
- 同编辑器内粘贴：ProseMirror 保留 node 结构
- 外部纯文本粘贴 `$x^2$`：由 markdown-it 重新解析，不额外处理

### mathBlock.ts 调整

- 移除 `findAllMathMatches` 中的 inline math 正则
- 短期仅保留 `$$...$$` display math 的 decoration 处理
- 后续 display math 也可能升级为独立的语义节点

### 源码模式兼容

- 序列化输出 `$tex$`，反序列化从 `$...$` 恢复，不需要特殊适配

## Testing Decisions

### What makes a good test

- 只测试外部行为（输入 → 输出），不测试 NodeView DOM 内部实现
- 遵循现有 tableMarkdown.test.ts 的测试模式：Vitest + jsdom，验证 parse/serialize 往返

### Modules to test

| Module | Test Scope |
|---|---|
| markdown-it inline ruler | 输入 markdown → 验证 token 列表中 math_inline 的识别准确性 |
| Schema + markdown 往返 | parse → ProseMirror doc → serialize → 验证输出与原始 markdown 一致 |
| mathBlock.ts 边界 | 验证 `$...$` 不再被 decoration 扫描匹配 |

### Modules NOT to test

- **MathInlineNodeView**：DOM 交互 + KaTeX 渲染 + fixed 定位计算，需 jsdom + KaTeX mock，投入产出比低。交互正确性通过手动验证确认。
- **CSS 样式**：视觉回归由人工审核。

### Prior art

- [tableMarkdown.test.ts](src/lib/editor-core/tableMarkdown.test.ts) — 现有 markdown 解析/序列化往返测试范式

## Out of Scope

- **math_block（display math）语义节点升级**：短期 `$$...$$` 仍走 mathBlock.ts decoration 方案
- **公式自动补全 / snippet**：不提供 LaTeX 命令补全功能
- **公式富文本工具栏**：不提供符号面板、模板插入等辅助 UI
- **公式导出为图片**：不提供 SVG/PNG 导出
- **MathJax 替代 KaTeX**：继续使用 KaTeX
- **公式编号 / 交叉引用**：不考虑 `\label` / `\ref` 等 LaTeX 功能

## Further Notes

- NodeView 是 ProseMirror 中处理 atomic inline node 的标准模式，项目已有 CodeBlockNodeView 和 HtmlBlockNodeView 作为 NodeView 实现先例
- 浮动预览模式与 tableControls.ts 的绝对定位面板模式一致，可参考其位置计算逻辑
- 整个功能的核心复杂度在 MathInlineNodeView 的编辑态状态机——进入/退出编辑态的条件分支（点击、键盘导航、Enter、Esc、失焦、箭头边界）需要仔细覆盖
