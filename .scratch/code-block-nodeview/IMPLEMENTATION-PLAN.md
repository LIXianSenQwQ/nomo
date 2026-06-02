# 实现计划：跨行代码块节点增强

## 架构决策

**核心变更**：将 `CodeBlockNodeView` 从 contentDOM 模式（ProseMirror 直接管理文本）转为 atom 模式（无 contentDOM），参照 `MathBlockNodeView` 的展示态/编辑态切换模式。

**理由**：
- PRD 要求编辑态使用「输入层 + 高亮层」叠层方案，contentDOM 模式无法实现
- PRD 要求明确的展示态/编辑态切换，atom 模式更清晰
- 保持 code_block 在 schema 中仍为 text block（`content: "text*"`），markdown 序列化不受影响
- NodeView 不设置 contentDOM，ProseMirror 不会尝试管理文本内容

**不改 schema 的原因**：
- `code_block` 继承自 `prosemirror-markdown`，保持 `content: "text*"` + `attrs.params`
- markdown 解析/序列化无需任何改动
- `node.textContent` 仍然可用，序列化器正常工作

---

## Phase 1：清理现有代码块边界

**目标**：移除 Mermaid 预览逻辑，简化 CodeBlockNodeView 职责。

**改动文件**：`src/lib/editor-core/nodeViews/CodeBlockNodeView.ts`

**具体改动**：
- 移除 `diagramContainer`、`previewBtn`、`previewVisible` 字段
- 移除 `togglePreview()`、`showPreview()`、`hidePreview()`、`renderDiagram()` 方法
- 移除 `getDiagramRenderer` 导入
- 移除构造函数中 Mermaid 预览按钮的创建逻辑
- 保留：复制按钮、语言标签、行号、语法高亮

**验证**：
- Mermaid 语言的代码块正常显示为普通代码块
- 复制、高亮、行号功能不受影响

---

## Phase 2：Markdown 与节点行为基线

**目标**：确认 markdown 解析/序列化基线正确。

**改动文件**：无代码改动，仅验证。

**验证项**：
- ` ```js\ncode\n``` ` 正确解析为 code_block，`params: "js"`
- 空代码块 ` ```\n``` ` 正确解析和序列化
- 语言名正确存储在 `params` 属性中
- 三个反引号输入规则正常工作
- `insertCodeBlock` 命令正常工作

---

## Phase 3：展示态体验

**目标**：将 CodeBlockNodeView 转为 atom 模式，渲染高亮代码为 innerHTML。

**改动文件**：`CodeBlockNodeView.ts`

**具体改动**：

### 3.1 移除 contentDOM
- 删除 `contentDOM` 属性
- 删除 `codePre` 和 `contentDOM` 的创建逻辑
- 改为直接渲染高亮 HTML 到 `codeBody`

### 3.2 展示态渲染
```
section.code-card
  header
    span.lang-label
    div.actions
      button.copy-btn
  div.code-body
    div.line-numbers-gutter
    pre.code-display
      code (高亮 HTML，innerHTML 渲染)
```

### 3.3 高亮渲染方式
- 使用 `codeTokenizer.tokenize()` 获取 tokens
- 新增 `tokensToHtml(tokens)` 辅助函数，将 `CodeTokenLine[]` 转为 HTML 字符串
- 将 HTML 设置到 `code` 元素的 innerHTML
- 异步渲染，使用 renderId 防止过期结果

### 3.4 节点选中复制
- 在 `selectNode()` 中不特殊处理（ProseMirror 的 NodeSelection 自动处理 Ctrl+C）
- 序列化器会输出完整的 fenced code block markdown

### 3.5 高亮失败降级
- tokenize 失败时显示纯文本（escapeHtml）
- 不阻塞编辑和保存

### 3.6 update 方法
- 更新语言标签
- 重新渲染高亮 HTML
- 更新行号

**验证**：
- 代码块正确显示高亮
- 行号正确显示
- 复制按钮复制代码正文
- 选中节点后 Ctrl+C 复制完整 markdown

---

## Phase 4：编辑态基础闭环

**目标**：实现点击进入编辑态、textarea 输入、保存/取消退出。

**改动文件**：`CodeBlockNodeView.ts`、`editor-document.css`

### 4.1 状态管理
```typescript
private editing = false;
private originalCode = '';
private originalLanguage = '';
private textarea: HTMLTextAreaElement | null = null;
private highlightLayer: HTMLElement | null = null;
private needsAutoEdit = false;  // InputRule 新建时自动进入编辑态
```

### 4.2 编辑态 DOM 结构
```
section.code-card.is-editing
  header
    span.lang-label (点击打开语言选择器，Phase 6)
    div.actions
      button.copy-btn
  div.code-body
    div.line-numbers-gutter (编辑态也显示行号)
    div.code-edit-area (position: relative)
      pre.code-highlight-layer (position: absolute, pointer-events: none)
        code (高亮 HTML)
      textarea.code-input (position: relative, transparent text, visible caret)
```

### 4.3 进入编辑态（enterEdit）
- 设置 `editing = true`
- 保存 `originalCode` 和 `originalLanguage`
- 添加 `is-editing` class
- 清空 `codeBody`，构建编辑态 DOM
- 创建 textarea，设置初始值为 `node.textContent`
- 创建高亮层，初始渲染
- 绑定 textarea 事件：input、keydown、blur、scroll
- `requestAnimationFrame` 聚焦 textarea

### 4.4 退出编辑态（exitEdit）
- 参数 `save: boolean`
- 如果 save：获取 textarea 值，通过 `tr.replaceWith()` 更新节点内容
- 如果 !save：恢复 originalCode
- 清理编辑态 DOM
- 恢复展示态渲染
- 设置 `editing = false`

### 4.5 键盘处理
- **Ctrl+Enter**：`exitEdit(true)` — 保存退出
- **Escape**：`exitEdit(false)` — 取消退出
- **Enter**：正常换行（不拦截）
- **Tab**：Phase 5
- **Shift+Tab**：Phase 5

### 4.6 事件处理
- **click（header 以外）**：进入编辑态
- **blur**：`exitEdit(true)` — 保存退出
- **input**：更新高亮层
- **scroll**：同步高亮层和行号滚动

### 4.7 节点内容更新
```typescript
private saveContent(newCode: string, newLanguage?: string): void {
  const pos = this.getPos();
  const node = this.view.state.doc.nodeAt(pos);
  if (!node) return;
  const attrs = { params: newLanguage ?? node.attrs.params };
  const content = newCode ? this.view.state.schema.text(newCode) : undefined;
  const newNode = node.type.create(attrs, content);
  this.view.dispatch(this.view.state.tr.replaceWith(pos, pos + node.nodeSize, newNode));
}
```

### 4.8 selectNode 处理
- 如果 `needsAutoEdit`（InputRule 新建的空块），自动进入编辑态
- 否则添加 `ProseMirror-selectednode` class

### 4.9 stopEvent
- 编辑态内拦截所有事件（防止 ProseMirror 处理）
- 展示态只拦截 button 点击

### 4.10 ignoreMutation
- 返回 `true`（因为没有 contentDOM，不需要 ProseMirror 跟踪 DOM 变化）

### 4.11 CSS 样式
```css
.code-card.is-editing { /* 编辑态容器 */ }
.code-edit-area { position: relative; }
.code-highlight-layer {
  position: absolute;
  top: 0; left: 0; right: 0;
  pointer-events: none;
  /* 与 textarea 相同的字体、行高、padding */
}
.code-input {
  width: 100%;
  border: none;
  background: transparent;
  color: transparent;       /* 文字透明 */
  caret-color: inherit;     /* 光标可见 */
  resize: none;
  /* 与高亮层相同的字体、行高、padding */
}
```

**验证**：
- 点击代码块进入编辑态
- 编辑态显示高亮代码
- Ctrl+Enter 保存退出
- Esc 取消退出
- 点击外部保存退出
- Enter 正常换行

---

## Phase 5：编辑态工程细节

**改动文件**：`CodeBlockNodeView.ts`、`editor-document.css`

### 5.1 Tab 缩进
- Tab：在光标位置插入 2 个空格
- Shift+Tab：当前行减少 2 个空格前导缩进

### 5.2 高度控制
- 最小高度：3 行（约 `3 * 1.65em`）
- 最大高度：`min(24行, 60vh)`
- 超过最大高度：内部滚动

### 5.3 滚动同步
- textarea scroll 事件 → 同步高亮层和行号的 scrollTop/scrollLeft

### 5.4 长行处理
- 横向滚动，不自动换行
- `white-space: pre` + `overflow-x: auto`

### 5.5 点击定位
- 尝试将点击位置映射到 textarea 的光标位置
- 如果精确映射成本过高，至少聚焦到点击的行附近

**验证**：
- Tab 插入 2 空格
- Shift+Tab 减少缩进
- 短代码块随内容增长
- 长代码块内部滚动
- 长行横向滚动

---

## Phase 6：语言选择器与测试收口

**改动文件**：`CodeBlockNodeView.ts`、`editor-document.css`

### 6.1 语言选择器 UI
- 位置：编辑态右下角
- 触发：点击 header 中的语言标签
- 样式：下拉浮层，带搜索输入框

### 6.2 语言列表
```typescript
const LANGUAGES = [
  { label: 'Plain Text', value: 'text', aliases: ['plaintext', 'txt'] },
  { label: 'JavaScript', value: 'javascript', aliases: ['js'] },
  { label: 'TypeScript', value: 'typescript', aliases: ['ts'] },
  { label: 'HTML', value: 'html', aliases: [] },
  { label: 'CSS', value: 'css', aliases: [] },
  { label: 'JSON', value: 'json', aliases: [] },
  { label: 'Markdown', value: 'markdown', aliases: ['md'] },
  { label: 'Python', value: 'python', aliases: ['py'] },
  { label: 'Java', value: 'java', aliases: [] },
  { label: 'Shell', value: 'shell', aliases: ['sh', 'bash'] },
  { label: 'SQL', value: 'sql', aliases: [] },
  { label: 'YAML', value: 'yaml', aliases: ['yml'] },
  { label: 'Diff', value: 'diff', aliases: [] },
  { label: 'Mermaid', value: 'mermaid', aliases: [] },
  // ... 更多语言
];
```

### 6.3 搜索功能
- 输入框实时过滤语言列表
- 匹配 label 和 aliases
- 支持自定义输入（不在列表中的语言名）

### 6.4 语言切换
- 选择语言后更新 `node.attrs.params`
- 立即重新触发高亮渲染
- Enter 提交语言并返回代码编辑

### 6.5 测试
- Markdown 往返测试
- 复制行为测试（按钮复制 vs 节点选中复制）
- 行号隔离测试
- 编辑快捷键测试
- 语言切换测试
- 高亮降级测试

---

## 关键风险与应对

| 风险 | 应对 |
|------|------|
| 无 contentDOM 导致 ProseMirror 选区异常 | 使用 NodeSelection，不依赖 TextSelection |
| 异步高亮延迟导致闪烁 | 使用 renderId 防止过期结果，初始显示纯文本 |
| textarea 与高亮层滚动不同步 | 绑定 scroll 事件同步 |
| 大代码块 tokenize 性能 | 添加 debounce，使用缓存（Shiki 已有缓存） |
| InputRule 创建后光标位置 | 使用 needsAutoEdit 自动进入编辑态 |

---

## 不改动的文件

- `schema.ts` — code_block 保持继承自 prosemirror-markdown
- `markdown.ts` — 解析/序列化无需改动
- `ProseMirrorEditorCore.ts` — NodeView 注册无需改动
- `editorCommands.ts` — insertCodeBlock 命令无需改动
- `codeHighlight.ts` — 保留但不再被 CodeBlockNodeView 使用（Phase 3+ 后可考虑清理）

---

## 实施顺序

1. Phase 1 → 单独提交（清理 Mermaid）
2. Phase 2 → 验证通过即可（无代码改动）
3. Phase 3 + Phase 4 → 合并实施（展示态 + 编辑态基础）
4. Phase 5 → 独立提交（工程细节）
5. Phase 6 → 独立提交（语言选择器 + 测试）
