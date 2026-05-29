# 轻量 Markdown 编辑器

本上下文描述一个本地优先、Markdown-first、面向阅读与写作的桌面 Markdown 编辑器。它的核心目标是用稳定的工程边界承载接近 Typora 的语义编辑体验，同时保持 Typedown 式轻量桌面应用气质。

## Language

**轻量 Markdown 编辑器**:
以本地 Markdown 文件为主数据、提供语义编辑体验的桌面应用。
_Avoid_: 知识库、富文本文档系统、云端协作平台

**Markdown-first**:
文档的长期保存、导入导出和文件同步都以 `.md` 文本为准。
_Avoid_: 私有富文本格式、数据库主文档

**语义编辑**:
用户在同一编辑区中直接编辑标题、列表、引用、代码块等 Markdown 语义结构。
_Avoid_: 纯源码编辑、左右分栏预览、完全所见即所得

**源码模式**:
用户可切换到 Markdown 原文编辑形态，以处理保真、调试或高级语法场景。
_Avoid_: 原始模式、调试模式

**EditorCore**:
面向应用层的稳定编辑器 API 边界，封装编辑命令、状态订阅、Markdown 读写和渲染服务接入。
_Avoid_: ProseMirror 直连层、UI 适配器

**ProseMirror Adapter**:
EditorCore 内部的具体编辑内核实现，负责把编辑命令转换为 ProseMirror 的事务、插件和 NodeView 行为。
_Avoid_: 编辑器核心、业务编辑层

**MarkdownBridge**:
负责 Markdown 文本与运行时编辑文档之间双向转换的桥接层。
_Avoid_: 文件存储层、渲染服务

**渲染服务**:
图片、代码高亮、数学公式和图表等非文本能力的统一接入接口。
_Avoid_: NodeView 里的散装逻辑、UI 特效

**本地主存储**:
用户可直接访问和迁移的 `.md` 文件及其资源目录。
_Avoid_: SQLite 文档正文、云端主存储

**辅助数据层**:
SQLite 或本地缓存中保存的最近文件、索引、设置、快照和渲染缓存。
_Avoid_: 主数据层、内容源

**资源目录**:
与 Markdown 文档关联的图片和附件存放位置，默认使用文档同级 assets 目录。
_Avoid_: 图床默认上传、base64 内联图片

**保真等级**:
保存 Markdown 时对语义、文本和原始格式保持程度的产品承诺。
_Avoid_: 完全无损保存承诺

**技术文档能力**:
代码高亮、数学公式、Mermaid 图表、表格、任务列表和目录导航等面向技术写作的能力集合。
_Avoid_: 重型排版系统、完整出版工具链

**Task List**:
使用 Markdown `- [ ]` / `- [x]` 表示的轻量任务清单。
_Avoid_: 项目管理任务、Issue

**基础表格**:
使用 Markdown pipe table 表示的简单二维内容结构。
_Avoid_: 电子表格、复杂表格布局

**Front matter**:
文档开头由 `---` 包裹的 YAML 元数据块，编辑器应保留但不把它当正文语义节点。
_Avoid_: 应用设置、数据库元数据

**数学公式**:
使用 TeX 文本表达并由 KaTeX 渲染的行内或块级公式。
_Avoid_: 图片公式、公式编辑器私有格式

**Mermaid 图表**:
使用 fenced code block 中的 `mermaid` 语言标记表达的文本图表。
_Avoid_: 手绘 SVG、外部图片图表

**Outline**:
从 Markdown 标题派生的文档目录，用于长文档导航。
_Avoid_: 文件树、知识库目录

**资源管理器**:
用于承载本地文件夹、当前 Markdown 文件和最近文件入口的左侧导航区域。
_Avoid_: 文档大纲、正文结构目录

**写作统计**:
从当前 Markdown 文本派生的字符数、词数、标题数和阅读时间。
_Avoid_: 分析报表、用户行为统计

**Windows-first**:
第一版优先保证 Windows 下的文件路径、快捷键、窗口行为、原生文件体验和异常反馈。
_Avoid_: 跨平台同等优先、平台无差别实现

## Relationships

- **轻量 Markdown 编辑器** 以 **Markdown-first** 作为产品和数据原则。
- **Windows-first** 约束第一版的桌面能力验收顺序，但不否定后续跨平台支持。
- **语义编辑** 与 **源码模式** 是同一份 Markdown 文档的两种编辑形态。
- **EditorCore** 对应用层暴露稳定接口，并隐藏 **ProseMirror Adapter** 的实现细节。
- **MarkdownBridge** 在 Markdown 文本与 **ProseMirror Adapter** 的运行时文档之间转换。
- **渲染服务** 只负责派生预览，不改变 **本地主存储** 的主内容。
- **Outline** 和 **写作统计** 都从 Markdown 文本派生，不参与主存储。
- **资源管理器** 属于文件导航区域；**Outline** 属于内容区内的跟随导航，不应与左侧文件树合并。
- **Task List**、**基础表格**、**数学公式** 和 **Mermaid 图表** 都必须以 Markdown 文本为主数据。
- **Front matter** 属于文档元数据，需要在语义编辑事务中保留。
- **辅助数据层** 可以索引和缓存 **本地主存储**，但不能替代 `.md` 文件。
- **资源目录** 与 Markdown 文档共同构成用户可迁移的本地文件资产。

## Example dialogue

> **Dev:** “图片粘贴进编辑器后，是不是把图片 base64 写进 Markdown？”
> **Domain expert:** “不是。图片进入资源目录，Markdown 只保存相对路径。这样才符合 **Markdown-first** 和 **本地主存储** 的边界。”

> **Dev:** “Svelte 组件能不能直接调用 ProseMirror 的 `view.state`？”
> **Domain expert:** “不能。应用层只调用 **EditorCore**，ProseMirror 通过 **ProseMirror Adapter** 隔离，避免未来替换内核时牵动 UI。”

## Flagged ambiguities

- “所见即所得”容易暗示最终格式是富文本私有模型，本项目采用更准确的 **语义编辑**。
- “SQLite 存储文档”容易误解为数据库保存正文，本项目明确 SQLite 只是 **辅助数据层**。
- “MVP / 第一版”在两份文档中既包含必做项也包含建议项，本 PRD 将其拆成阶段交付，避免把全部 Typora 能力塞进第一阶段。
