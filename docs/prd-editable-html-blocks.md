# PRD: 语义模式可编辑 HTML 块（第一版）

日期：2026-06-01
类型：Feature
状态：In Progress

---

## Problem Statement

Nomo 在语义模式下将所有 Markdown 中的 HTML 块渲染为 `contenteditable=false` 的 widget（`<span class="html-widget">`），用户只能预览不能所见即所得编辑。当 Markdown 文档中包含简单 HTML（如 `<section>` 包裹的内容区块）时，用户希望在语义模式下直接编辑其中的文字，而不是被迫切回源码模式修改。

## Solution

实现分层方案：

1. **简单 HTML** 转成 ProseMirror 可编辑节点（`html_block` 节点类型），内容可自由编辑
2. **复杂/未知 HTML** 继续走现有 widget 预览（非破坏性降级）
3. **危险 HTML**（script/iframe/form 等）不直接渲染，只保留源码或安全预览

第一版支持以下标签：

- **块级**：`<section>`, `<div>`
- **内联**：`<span>`, `<strong>`, `<em>`, `<a>`, `<code>`
- **允许属性**：`class`, `id`, `href`, `title`

## User Stories

1. As a 文档作者，I want 在语义模式中直接编辑 HTML 块内的文字，so that 不需要切回源码模式修改 HTML
2. As a 编辑者，I want `<section class="demo">` 包裹的内容在语义模式正常渲染，so that 样式框架可见且内容可改
3. As a 编辑者，I want 块内的 `<strong>` 和 `<em>` 样式保留在可编辑内容中，so that 所见即所得
4. As a 安全敏感用户，I want 包含 `<script>` 或 `<iframe>` 的 HTML 不进入可编辑 schema，so that 不会意外执行恶意代码
5. As a 用户，I want 复杂 HTML（表单、SVG 等）继续以预览模式显示，so that 现有功能不受影响
6. As a 作者，I want 保存文档后 HTML 块能正确序列化回 Markdown，so that 切换源码模式后内容不丢失
7. As a 用户，I want 在 HTML 可编辑块内的 undo/redo 正常走 ProseMirror 事务，so that 编辑体验与普通段落一致
8. As a 开发者，I want HTML 块的卡片外壳显示标签名和 class/id 信息，so that 一眼能看出这是 HTML 块而非普通段落
9. As a 用户，I want 块内的 `<a>` 链接标签保留可点击的 href 属性，so that 链接功能不丢失
10. As a 用户，I want `<code>` 标签内的代码以等宽字体显示，so that 行内代码样式正常工作

## Implementation Decisions

### 模块架构

新增模块（均为 deep module，接口简单、可独立测试）：

| 模块                | 职责                                           | 接口                                                                   |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `htmlPolicy`        | 标签/属性白名单黑名单常量                      | 导出的 `Set` / `Record` 常量                                           |
| `htmlClassifier`    | 判断 raw HTML 是否可编辑                       | `classifyHtmlBlock(rawHtml)` → 分类结果 + 解析出的 tag/innerHTML/attrs |
| `htmlToPmLogic`     | raw HTML → ProseMirror MarkdownParseState 操作 | `parseHtmlContent(state, innerHTML, schema)` 直接操作 parser state     |
| `pmToHtml`          | ProseMirror node → HTML 字符串                 | `serializeHtmlBlock(node)` → string                                    |
| `HtmlBlockNodeView` | 卡片 UI 外壳 + contentDOM 可编辑内容           | 标准 ProseMirror NodeView 接口                                         |

### Schema 决策

- 新增一个 `html_block` 节点类型，`content: inline*`，`group: block`
- 用 `tag` attr 区分 `<section>` / `<div>`，不按标签名拆分多节点类型
- `class` 和 `id` 存为独立 attr
- **不新增 mark**：内联标签 `<strong>/<em>/<code>/<a>` 直接映射到 ProseMirror 已有 mark（strong/em/code/link），`<span>` 第一版原样保留文本

### Parser 决策

- markdown-it 从 `html: false` 改为 `html: true`
- 覆盖 MarkdownParser 的 `html_block` token handler：分类 → 走 `html_block` 节点或 fallback paragraph
- 覆盖 `html_inline` token handler：已知标签 → openMark/closeMark，未知 → addText 原始文本
- 使用模块级 tag 栈管理内联标签嵌套，每次 parse 前重置

### Serializer 决策

- `html_block` 节点序列化时使用 `pmToHtml.serializeHtmlBlock()`，遍历子节点的 marks 反向生成 HTML
- 对于映射到已有 mark 的内联内容（strong/em/code/link），序列化为 HTML 标签而非 Markdown 语法
- fallback 的复杂 HTML 保持原始文本不变

### 交互决策

- `HtmlBlockNodeView` 提供卡片外壳（header 显示标签名 + class/id）+ `contentDOM`（ProseMirror 管理的可编辑区域）
- NodeView 不做 innerHTML 冒充可编辑
- 已解析的 `html_block` 节点在 `tableHtmlPlugin` 中被跳过（不重复渲染 widget）

## Testing Decisions

### 测试策略

- 只测试外部行为（输入 → 输出），不测试内部实现细节
- 往返测试：parse → serialize 后内容一致
- 分类测试：各类 HTML 正确分为 editable / fallback

### 测试模块

| 模块                     | 测试内容                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `htmlClassifier.test.ts` | section/div → editable；script/iframe/input/form → fallback；未知标签 → fallback；嵌套允许标签 → editable |
| `tableMarkdown.test.ts`  | 补充 HTML 块往返测试：简单 HTML 往返不丢内容；fallback HTML 不丢内容                                      |

### 测试模式参照

- `tableMarkdown.test.ts`（管表往返）
- `createEditorCore.test.ts`（编辑器初始化与模式切换）

## Out of Scope

- 不支持 `<script>`, `<style>`, `<iframe>`, `<form>`, `<input>`, `<button>`, `<svg>` 等复杂交互标签
- 不支持 `<article>`, `<header>`, `<footer>`, `<nav>` 等 CommonMark 块标签的可编辑模式（可后续添加）
- `<span>` 第一版不映射到 mark，保留原始 HTML 文本
- 不支持 HTML 块内嵌套表格
- 不支持自定义属性（只支持 class/id/href/title）
- 不支持花式 NodeView 工具栏（如复制按钮等）

## Further Notes

- 此改动依赖 markdown-it `html: true`。测试已验证现有管表往返测试和编辑器初始化测试全部通过，无回归。
- `html: true` 意味着 CommonMark 规范中的所有块标签（`<p>`, `<table>`, `<ul>` 等）都会产生 `html_block` token。分类器必须将这些不在允许列表的标签导向 fallback，避免与原生 ProseMirror 段落/标题/列表等节点冲突。
- 后续版本可扩展支持更多块标签和内联标签，只需修改 `htmlPolicy.ts` 白名单和 `pmToHtml.ts` / `htmlToPmLogic.ts` 的映射逻辑。
