# math_inline 行内公式——设计决策记录

> 2026-06-02，通过 `/grill-me` 逐层追问，覆盖 15 个设计维度的完整决策树。

## 架构分层

```
Markdown $x^2$
  ↓
custom markdown-it inline ruler（$...$ tokenizer，优先级排在 backticks 之后）
  ↓
ProseMirror math_inline atomic node（schema: inline, atom, selectable, draggable: false）
  ↓
NodeView 负责：渲染态 HTML、编辑态 input + 浮动预览卡片
  ↓
Markdown serializer 输出 `$tex$`
```

## 决策明细

### 1. Schema 表示方式

**结论**：方案 A——`math_inline` 作为 ProseMirror inline atomic node 实现。

**理由**：

- 编辑/渲染切换由 NodeView 的 focus/blur 事件精确控制，不依赖全局 selection 插件
- 源码作为 attribute 存储，不会在普通文本编辑中被意外修改
- 浮动预览卡片由 NodeView 内部创建，生命周期清晰

### 2. 编辑态触发方式

**结论**：点击 + 键盘导航都支持进入编辑态。

**交互**：

- 点击 KaTeX 渲染结果 → 进入编辑态
- 键盘左右箭头移到公式节点 → 进入编辑态
- 键盘导航到节点时，原子节点被选中（NodeSelection），触发 `selectNode()` 进入编辑
- 用户用左右箭头正常行进，不需要强制 Esc 退出

### 3. 编辑态内箭头键行为

**结论**：左右箭头在源码内部正常移动字符位置；到达边界（开头← / 末尾→）继续向外走时退出编辑态。

**理由**：与普通文本编辑一致——光标在 word 内部箭头移动字符，到边界跳到下一个节点。

### 4. 确认退出方式

**结论**：Enter / 失焦 / Esc / 箭头边界均视为确认退出。

**交互**：

- Enter 确认退出并保存修改
- 点击公式外区域（失焦）自动保存修改
- Esc 退出编辑态并恢复原始 tex
- 左右箭头到达源码边界退出并保存

### 5. 浮动预览卡片定位

**结论**：

- 水平左对齐公式节点
- 垂直紧贴下方 4-6px
- 宽度 `min(自适应内容宽度, 编辑器内容区宽度)`，最大 600px
- `position: fixed` 挂载 `document.body`
- 跟随 scroll/resize 实时更新位置
- 公式滚出视口时自动隐藏

### 6. KaTeX 渲染失败的展示

**结论**：非编辑态回退显示原始 `$tex$` 文本；预览卡片中显示 KaTeX 错误信息。

**理由**：

- 用户能看到自己写的内容，比红色错误标记更温和
- 不破坏阅读体验
- 预览卡片中单独展示错误信息，不修改输入

### 7. Node Attributes

**结论**：仅 `tex: string`，不存储 `displayMode`、`html`、`rendered`、`error`、`focused` 等运行时状态。

**理由**：行内公式 `displayMode` 始终为 `false`；运行时状态由 NodeView 内部管理。

### 8. markdown-it 集成方案

**结论**：手写 inline ruler，不引入 `markdown-it-texmath` 等额外依赖。

**理由**：

- `$...$` 解析规则简单（约 30 行代码）
- 项目已有手写 token handler（html_block、html_inline），保持一致风格
- 控制力最强，处理 `\$` 转义、`$100` 货币、代码块内 `$` 等边界

**Inline ruler 注册位置**：`markdownIt.inline.ruler.after('backticks', 'math_inline', ...)`

- 排在 backticks/code_inline 之后，确保 `` `$x^2$` `` 走代码通道
- 排在 escape 之后，`\$` 被 escape 规则先处理

### 9. Schema 细节

```typescript
math_inline: {
  inline: true,
  group: 'inline',
  atom: true,           // 原子节点，光标不进入内部
  selectable: true,     // 可整体选中/删除/复制
  draggable: false,     // 不允许拖拽
  attrs: { tex: { default: '' } },
  toDOM: fallback 输出 <span class="math-inline" data-tex="...">$tex$</span>（不引入 KaTeX）
  parseDOM: 优先从 data-tex 恢复，fallback 取 textContent
}
```

**原则**：schema 只负责语义结构；KaTeX 渲染、编辑态、错误状态和实时预览都放到 NodeView 或渲染层。

### 10. 编辑 UI 控件

**结论**：用 `<input>` 做原地源码编辑，预览卡片 `position: fixed` 挂 `document.body`。

**理由**：

- 行内公式语义上为单行，多行需求交给 math_block
- Fixed 定位避免被 ProseMirror 的 overflow/clip 裁剪

### 11. 与 mathBlock.ts 的关系

**结论**：mathBlock.ts 短期只保留 `$$...$$` display math 的 decoration 处理；`$...$` inline math 完全交给新的 math_inline 语义节点。

**后续**：display math 未来也可能升级为 `math_block` 语义节点，届时 mathBlock.ts 中的 display math decoration 也逐步替换。

### 12. 源码模式兼容

**结论**：无需特殊处理。

**理由**：序列化输出 `$tex$`，反序列化从 `$...$` 恢复。源码模式下用户直接编辑 textarea 中的 markdown 文本，切回语义模式时 markdown-it 重新解析。

### 13. Undo/Redo 策略

**结论**：编辑期间（input 内键入）不同步 ProseMirror state；退出编辑态时一次性提交 transaction。

**理由**：

- 预览卡片实时渲染不依赖 ProseMirror——直接在 input 事件中调 `katex.renderToString()`
- 用户按 Ctrl+Z 撤销的是退出编辑这个操作（恢复旧 tex），不是逐字符撤销
- 编辑到一半按 Esc 回退到原始值也很自然

### 14. 复制/粘贴行为

**结论**：

- 复制：纯文本 `$tex$` + HTML `<span class="math-inline" data-tex="...">$tex$</span>`
- 同编辑器粘贴：ProseMirror 原生保留 node 结构
- 外部粘贴纯文本 `$x^2$`：依赖 markdown-it 重新解析，不额外处理

### 15. 解析边界处理

- `\$` 转义：markdown-it escape 规则先处理 `\$` → 字面 `$`；inline ruler 中 `\$` 不再出现
- 内容内 `\$`：通过回数反斜杠奇偶判断是否转义（`\\$` 偶数→闭合；`\$` 奇数→转义）
- `$100` 货币：不允许 `$` 相邻位置为空格（`$ 100` / `100 $` 不匹配）
- 代码块/行内代码：inline ruler 排在 backticks 之后，`` `$x^2$` `` 中的 `$` 不被匹配
- `$$...$$` display math：`pos+1` 和 `pos-1` 检查跳过 `$$`，`$$...$$` 留给 mathBlock.ts 处理
- 未闭合 `$`：inline ruler 扫描不到结束 `$` 时返回 false，`$` 作为普通文本

## 模块拆分

| 模块                     | 位置                            | 职责                                    |
| ------------------------ | ------------------------------- | --------------------------------------- |
| markdown-it inline ruler | markdown.ts                     | 识别 `$...$` → `math_inline` token      |
| math_inline Schema       | schema.ts                       | node spec 定义                          |
| markdown 序列化/反序列化 | markdown.ts                     | token → PM node + node → `$tex$`        |
| MathInlineNodeView       | nodeViews/MathInlineNodeView.ts | 渲染态/编辑态切换、input 管理、预览卡片 |
| mathBlock 瘦身           | plugins/mathBlock.ts            | 移除 inline regex，仅保留 `$$...$$`     |
| 样式                     | app/styles/editor-document.css  | 渲染态、input、预览卡片样式             |

## 测试策略

- **已覆盖**：markdown-it inline ruler 识别准确性、schema + markdown 往返一致性、边界场景（货币、代码块、转义、未闭合、display math）
- **未覆盖**：MathInlineNodeView DOM 交互（需 jsdom + KaTeX mock，投入产出比低）；CSS 样式（视觉回归由人工审核）
- **测试范式**：遵循现有 tableMarkdown.test.ts 模式，Vitest + jsdom
