# ADR-0001: Callout 解析策略——Token 后处理

## 状态

已接受

## 背景

需要实现 GitHub Alert 语法（`> [!NOTE]`、`> [!TIP]` 等）的 Callout 节点。markdown-it 将这种语法当作普通 blockquote 处理，不识别 `[!TYPE]` 标记。需要一种策略将其识别并转换为独立的 `callout` ProseMirror 节点。

## 决策

采用 **Token 后处理**方案：在 `markdownIt.parse()` 的 override 中，扫描 blockquote 的子 tokens，检测首行是否匹配 `[!TYPE]` 模式，如果匹配则替换 token 类型为 `callout_open`/`callout_close` 并移除标记文本。

## 考虑的替代方案

### 方案 B：自定义 markdown-it block rule
注册一个优先级高于默认 blockquote 的 rule，直接匹配 `> [!TYPE]` 语法。
- **否决原因**：需要重新实现 blockquote 的嵌套解析逻辑，实现复杂度高，且容易引入边界 bug。

### 方案 C：ProseMirror parser 层处理
在 parser token handler 中检查 blockquote 节点的首个子文本是否为 `[!TYPE]`。
- **否决原因**：prosemirror-markdown 的 handler API 不方便做"先看内容再决定节点类型"的逻辑，实现脆弱。

## 理由

1. 项目已有成熟的 markdownIt.parse override 模式——table 的 token 规范化（剥离 thead/tbody、包装 th/td 内容）就在同一位置完成。
2. callout 的 token 后处理逻辑与 table 后处理模式一致：扫描、检测、替换 token 类型。
3. 对普通 blockquote 解析零影响——只有首行匹配 `[!TYPE]` 的 blockquote 才会被改写。
4. 代码集中在 `markdown.ts` 的 parse override 中，便于维护。

## 影响

- `markdown.ts` 的 `markdownIt.parse` override 中新增 blockquote→callout 的 token 改写逻辑
- parser token mapping 中新增 `callout_open`→`callout` 节点的映射
- serializer 中新增 `callout` 节点的序列化逻辑（先输出 `> [!TYPE]`，再复用 blockquote 的子内容序列化）
