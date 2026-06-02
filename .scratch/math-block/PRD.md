Status: needs-triage
Feature: math-block
Created: 2026-06-02

# PRD: math_block 跨行公式语义节点与阶段实现方案

## Problem Statement

当前跨行公式 `$$ ... $$` 仍依赖 decoration/widget 覆盖渲染。ProseMirror 文档树里没有真正的跨行公式节点，开闭 `$$` 和中间 LaTeX 都只是普通文本段落。

这会带来几个问题：

1. 用户不能像编辑行公式一样点击公式块进入源码编辑态。
2. display math 缺少语义结构，复制、删除、撤销、粘贴、导出都不稳定。
3. decoration 隐藏原文再插入 widget，容易与真实文档状态错位。
4. 行公式已经完成 `math_inline` 语义节点升级，跨行公式继续走旧方案会造成数学能力两套模型并存。

## Solution

将跨行公式升级为 `math_block` 语义节点。

目标体验：

- Markdown 源码中的 `$$ ... $$` 解析为一个块级公式节点。
- 语义模式默认显示 KaTeX display math 渲染结果。
- 点击或键盘选中公式块后进入多行源码编辑态。
- 编辑态显示实时预览。
- 保存后恢复渲染态，切源码模式时输出标准 `$$ ... $$` Markdown。

整体架构参照已完成的 `math_inline`：

```text
Markdown 源码
  -> Markdown 解析层识别 display math
  -> ProseMirror math_block 语义节点
  -> MathBlockNodeView 管理渲染态/编辑态
  -> Markdown serializer 输出标准 $$
```

## User Stories

### 渲染与阅读

1. As a 写作者, I want `$$ ... $$` 自动渲染为 KaTeX 跨行公式, so that 我能在语义模式直接阅读排版后的数学内容。
2. As a 阅读者, I want 跨行公式作为块级内容展示, so that 它与正文段落边界清晰。
3. As a 写作者, I want 长公式可以横向滚动或在容器内稳定展示, so that 它不会撑破文档布局。
4. As a 写作者, I want 渲染失败时看到源码 fallback, so that 错误公式不会丢失内容。
5. As a 写作者, I want 源码模式保存为标准 `$$ ... $$`, so that 文档仍兼容普通 Markdown 编辑器。

### 编辑交互

6. As a 写作者, I want 点击跨行公式进入源码编辑态, so that 我不用切换源码模式修改公式。
7. As a 写作者, I want 使用多行输入控件编辑 LaTeX, so that 矩阵、对齐公式、长公式都能自然输入。
8. As a 写作者, I want 编辑时看到实时预览, so that 我能及时发现 LaTeX 错误。
9. As a 写作者, I want Enter 保持为源码换行, so that 多行 LaTeX 编辑符合直觉。
10. As a 写作者, I want 使用确认快捷键保存退出, so that 编辑态不会被普通换行打断。
11. As a 写作者, I want 使用 Esc 放弃本次修改, so that 我可以安全取消误编辑。
12. As a 写作者, I want 点击外部时保存退出, so that 修改不会意外丢失。
13. As a 写作者, I want 选中公式块后可以整体删除, so that 删除操作不需要进入源码编辑。

### 语义输入与粘贴

14. As a 写作者, I want 在语义模式直接输入完整 `$$ ... $$` 后自动生成公式块, so that 我不用绕到源码模式创建公式。
15. As a 写作者, I want 粘贴包含 `$$ ... $$` 的 Markdown 时自动恢复公式块, so that 外部内容导入后结构不丢。
16. As a 写作者, I want 未闭合 `$$` 保持普通文本, so that 输入中途不会误生成节点。
17. As a 写作者, I want 代码块里的 `$$` 不触发公式块, so that 代码示例保持原样。

### 结构化能力

18. As a 写作者, I want 跨行公式作为一个整体参与复制粘贴, so that 复制到外部时能得到标准 Markdown。
19. As a 写作者, I want 公式块作为一个整体参与撤销重做, so that 编辑体验可预测。
20. As a 写作者, I want 公式块作为块级节点参与文档结构处理, so that 后续搜索、导出、统计有语义基础。

## Implementation Decisions

### 1. 节点模型

- 新增 `math_block`，作为块级 atomic node。
- 节点只持久化 LaTeX 源码。
- 渲染 HTML、错误状态、编辑状态不写入节点属性。
- 公式块可整体选中、整体删除，不允许拖拽作为第一阶段能力。

### 2. Markdown 解析与序列化

- Markdown 解析层识别独立 `$$` 包裹的 display math。
- 解析结果进入 ProseMirror 文档树时生成 `math_block`。
- 序列化时统一输出多行标准格式：

```md
$$
...
$$
```

- 保留公式内部换行和缩进，不做 LaTeX 格式化。
- 未闭合、空内容、代码块内部的 `$$` 不生成公式块。

### 3. NodeView 交互

- 使用 `MathBlockNodeView` 管理公式块渲染态和编辑态。
- 渲染态调用现有 KaTeX renderer，使用 display mode。
- 编辑态使用多行输入控件。
- 编辑态预览位于公式块内部，不使用行公式那种 fixed 浮层。
- 编辑过程中不持续同步 ProseMirror 文档；退出编辑态时一次性提交修改。

### 4. 语义模式自动转换

- 参考 `mathInlineInputPlugin`，新增 display math 输入转换能力。
- 监听文档变化后扫描普通段落中的成对 `$$`。
- 将完整 display math 段落组转换为 `math_block`。
- 第一阶段只处理顶层段落，不处理表格单元格、引用块等嵌套位置。

### 5. 旧 decoration 迁移

- `mathBlockPlugin` 的旧 display math decoration 方案要被 `math_block` 取代。
- 新旧方案不能同时处理同一段 `$$`。
- 第一阶段可以保留旧文件但不再注册，方便回退和对照。
- 稳定后再清理旧 decoration 代码和旧样式。

### 6. 与行公式的关系

- `math_inline` 与 `math_block` 使用同一个 math renderer。
- 两者都走“语义节点 + NodeView + Markdown serializer”架构。
- 不强行抽象公共 NodeView 基类，避免过早抽象。
- 可以共享少量纯函数，例如渲染 fallback 文案、LaTeX trim 策略，但不作为第一阶段重点。

## Stage Implementation Plan

### Stage 1: 语义节点与 Markdown 往返

目标：源码中的 display math 可以解析成 `math_block`，并能序列化回标准 Markdown。

范围：

- 扩展 schema。
- 扩展 Markdown parser。
- 扩展 Markdown serializer。
- 添加 parse/serialize 行为测试。

验收：

- `$$\nE = mc^2\n$$` 能生成 `math_block`。
- 多行公式往返后内容不丢。
- 未闭合 `$$` 不生成公式块。
- 代码块内 `$$` 不生成公式块。

### Stage 2: 渲染态 NodeView

目标：语义模式下公式块默认显示 KaTeX display math。

范围：

- 新增 `MathBlockNodeView`。
- 接入现有 math renderer。
- 接入 EditorCore nodeViews。
- 添加公式块基础样式。
- 停用旧 display math decoration 注册。

验收：

- 打开含 `$$` 的文档时显示为块级公式。
- 渲染错误时显示源码 fallback。
- 不出现旧 widget 和新 node 双重渲染。

### Stage 3: 编辑态闭环

目标：公式块可点击编辑、预览、保存、取消。

范围：

- NodeView 增加编辑态。
- 编辑态使用多行源码输入。
- 预览显示在公式块内部。
- 支持保存退出、取消退出、失焦保存。
- 修改作为一次 transaction 提交。

验收：

- 点击公式块进入编辑态。
- 修改公式后保存，Markdown 内容更新。
- Esc 取消后 Markdown 不变。
- Enter 在编辑态内换行，不退出。
- 撤销一次可撤回整次公式编辑。

### Stage 4: 语义模式直接输入

目标：语义模式输入或粘贴 display math 后自动形成公式块。

范围：

- 新增 display math 输入转换插件。
- 扫描顶层 paragraph 组成的 `$$ ... $$`。
- 完整闭合后转换为 `math_block`。
- 避免未闭合内容误转。

验收：

- 在语义模式输入三行 `$$`、内容、`$$` 后自动生成公式块。
- 粘贴完整 display math 后自动生成公式块。
- 未闭合不转换。
- 中间包含非段落块时不转换。

### Stage 5: 旧实现清理与回归

目标：移除旧 decoration 路线的影响，保证数学公式体系统一。

范围：

- 删除或标记旧 `mathBlockPlugin` 为 legacy。
- 清理不再使用的 `.math-widget` / `.math-display` 样式。
- 跑现有行公式、表格、基础编辑器测试。

验收：

- 不存在 display math 双渲染。
- 行公式能力不回归。
- 源码/语义切换后 display math 保持稳定。

### Stage 6: 体验打磨

目标：让跨行公式编辑达到可日常使用状态。

范围：

- 长公式横向滚动。
- textarea 高度自适应或可手动调整。
- 错误提示样式。
- 选中态与编辑态视觉区分。
- Windows 快捷键体验确认。

验收：

- 长公式不破坏布局。
- 错误公式可读、可编辑、可恢复。
- 鼠标、键盘、撤销、源码切换都符合预期。

## Testing Decisions

### 自动化测试

优先覆盖外部行为，不测试 NodeView 内部 DOM 细节。

必测：

- Markdown parse：`$$...$$` -> `math_block`
- Markdown serialize：`math_block` -> `$$...$$`
- 多行公式内容保留
- 未闭合边界
- 代码块边界
- 语义输入转换插件
- 与 `math_inline` 不互相干扰

参考：

- `mathInline.test.ts`
- `tableMarkdown.test.ts`
- `createEditorCore.test.ts`

### 手动验证

- 打开含 display math 的文档。
- 点击公式块进入编辑态。
- 多行编辑并实时预览。
- 保存、取消、撤销。
- 语义模式直接输入 display math。
- 源码模式切换往返。

## Out of Scope

- `\[` / `\]` 语法支持。
- 公式编号、交叉引用。
- LaTeX 自动补全和符号面板。
- 表格单元格内 display math。
- 图片导出或 SVG/PNG 公式导出。
- 抽象出统一 MathNodeView 基类。

## Further Notes

- 行公式已经验证了“语义节点 + NodeView”方向，跨行公式应沿用该路线。
- 第一阶段重点是统一结构和编辑闭环，不追求复杂 LaTeX 辅助能力。
- 最大风险是语义模式输入转换时机：必须只在完整闭合后转换，避免用户输入中途被打断。
- 第二风险是旧 decoration 插件遗留：需要确保新旧路线不同时处理 display math。
