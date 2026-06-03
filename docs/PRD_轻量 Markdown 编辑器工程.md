# PRD：轻量 Markdown 编辑器工程

> 文档日期：2026-05-29  
> 输入资料：`Svelte_ProseMirror_Markdown_编辑器技术架构文档.md`、`Typora_Typedown_功能总结.md`  
> 产品方向：本地优先、Markdown-first、语义编辑、轻量桌面 Markdown 阅读与写作工具  
> 当前状态：本地 PRD 文档。当前目录不是 Git 仓库，且未配置 issue tracker，因此暂不发布到 Issue。

## Problem Statement

Markdown 用户在技术文档、项目笔记和日常写作中，经常需要在“源码可控”和“阅读体验舒适”之间来回切换。传统左右分栏编辑器打断写作流，普通源码编辑器缺少图片、表格、公式、图表和目录等语义化能力，而重型知识库或云端协作工具又引入账户、同步、数据库和复杂工作区负担。

本项目要解决的问题是：做一个轻量、本地优先、Markdown-first 的桌面编辑器，让用户可以直接打开、阅读、编辑和保存本地 `.md` 文件，并获得接近 Typora 的语义编辑体验和接近 Typedown 的桌面轻量感。

## Solution

第一版采用 Tauri 2 + Svelte + TypeScript + EditorCore + ProseMirror + Markdown Parser / Serializer 的工程路线。Markdown 文件是长期主数据，ProseMirror Doc 是运行时编辑状态，SQLite 只负责最近文件、索引、设置、缓存和快照等辅助数据。

产品上提供语义编辑作为主体验，同时保留源码模式。工程上通过 EditorCore 隔离应用 UI 与 ProseMirror，避免 Svelte 组件直接绑定底层编辑器 API。渲染能力通过 imageLoader、codeTokenizer、mathRenderer、diagramRenderer 等服务接口逐步接入，先保证可编辑闭环，再增强图片、代码高亮、公式、图表、表格和 Outline。

## User Stories

1. As a Markdown writer, I want to open a local `.md` file, so that I can continue writing without importing it into a private format.
2. As a Markdown writer, I want edits to save back as standard Markdown, so that my documents remain portable.
3. As a technical writer, I want headings, lists, links, quotes and code blocks to render semantically while editing, so that the document is easier to read.
4. As a Markdown power user, I want a source mode, so that I can inspect and edit the original Markdown when needed.
5. As a Chinese user, I want IME input to be stable in paragraphs, headings and lists, so that normal writing is not disrupted.
6. As a writer, I want undo and redo to work consistently, so that I can recover from editing mistakes.
7. As a writer, I want Markdown shortcuts such as `#`, `-`, `>`, and fenced code blocks, so that writing remains fast.
8. As a technical writer, I want code blocks to support language labels and syntax highlighting, so that examples are readable.
9. As a documentation author, I want Mermaid blocks to preview diagrams, so that diagrams live with the Markdown source.
10. As a documentation author, I want inline and block math to render correctly, so that technical formulas are readable.
11. As a note taker, I want task lists with checkboxes, so that simple work tracking stays in Markdown.
12. As a documentation author, I want basic table editing, so that structured information can be maintained without hand-aligning every cell.
13. As a writer, I want images to preview from relative paths, so that Markdown documents remain useful outside this app.
14. As a writer, I want pasted or dropped images to be copied into a resource directory, so that the document and assets can move together.
15. As a writer, I want missing images to show a clear placeholder, so that broken references are visible.
16. As a long-form writer, I want an Outline panel, so that I can jump between sections.
17. As a writer, I want dirty state and save status, so that I know whether the file has unsaved changes.
18. As a writer, I want word count and reading metadata, so that I can understand document size.
19. As a desktop user, I want recent files, so that I can reopen active documents quickly.
20. As a desktop user, I want open, save and save-as to use native dialogs, so that the app feels like a normal desktop tool.
21. As a desktop user, I want file drag-and-drop open behavior, so that I can start editing quickly.
22. As a Windows user, I want shortcuts, menus and theme behavior to feel native, so that the app does not feel like a web page pasted into a window.
23. As a theme user, I want light and dark themes backed by CSS variables, so that the editor, UI and rendered content stay visually consistent.
24. As a maintainer, I want Svelte UI to depend on EditorCore instead of ProseMirror directly, so that the editing engine can evolve.
25. As a maintainer, I want Markdown parsing and serialization in a dedicated MarkdownBridge, so that storage and rendering stay decoupled.
26. As a maintainer, I want renderers to be service interfaces, so that Shiki, KaTeX and Mermaid can be replaced or optimized later.
27. As a maintainer, I want SQLite to store metadata rather than document bodies, so that local Markdown files remain the source of truth.
28. As a maintainer, I want editor snapshots, so that accidental overwrites or failed saves can be recovered.
29. As a maintainer, I want behavior tests around Markdown serialization, IME, paste and file save flows, so that core editing stays stable.
30. As a future maintainer, I want the app to record clear boundaries and terms, so that later self-developed editor experiments do not break MVP scope.

## Implementation Decisions

- Use Tauri 2 as the desktop shell for native window, file system, dialogs, menus and local commands.
- Use Svelte + TypeScript for the application UI, layout, toolbars, status bar, side panels and settings.
- Use EditorCore as the single application-facing editor API. UI components call EditorCore methods and subscribe to EditorCore state; they do not call ProseMirror internals directly.
- Use ProseMirror as the first editing engine implementation to avoid rebuilding selection, transaction, undo, paste, IME and NodeView complexity in MVP.
- Treat Markdown text as the durable source of truth. Runtime editor documents are derived state and must be serializable back to Markdown.
- Use MarkdownBridge for Markdown parse and serialize. It owns CommonMark/GFM extension mapping, raw block preservation strategy and front matter handling.
- Make source mode and semantic editing two views of the same Markdown document, not two independent documents.
- Introduce command-based editing through EditorCommand, including marks, headings, lists, links, images, code blocks, math blocks, Mermaid blocks, undo, redo and document formatting.
- Use immutable EditorCore change events so application state can be tracked without leaking mutable editor internals.
- Use imageLoader to resolve image paths, import pasted or dropped images, write resource files and return Markdown-safe relative paths.
- Use codeTokenizer as the syntax highlighting interface, with Shiki as the default implementation.
- Use mathRenderer for KaTeX rendering and diagramRenderer for Mermaid rendering.
- Use CSS variables from the first version to theme the application shell, editor content, code blocks, tables, selections, math and diagram containers.
- Use local `.md` files as main storage and SQLite as an auxiliary data layer for recent files, settings, search index, render cache and snapshots.
- Default resource storage to a sibling assets directory for single-file workflows.
- Support a file-folder workspace later, but keep single-document open/edit/save as the first stable path.
- Define Markdown preservation as semantic-first. Headings, links, lists, code, images and document text must survive round trips; exact whitespace and table alignment can be normalized in early versions.
- Keep AI writing, cloud sync, plugin marketplace and full export pipelines out of MVP until EditorCore command and snapshot contracts are stable.

## Engineering Modules

- Desktop Shell: Tauri commands for open, save, save-as, path resolution, resource copy, recent file integration and SQLite access.
- App UI: Svelte layout, editor host, toolbar, status bar, source mode switch, outline panel, settings and theme controls.
- EditorCore: stable editor API, command model, change events, snapshot model, error reporting and runtime option updates.
- ProseMirror Adapter: schema, plugins, keymaps, input rules, paste handling, history, node views and command translation.
- MarkdownBridge: parser, serializer, GFM extensions, front matter preservation, raw block strategy and round-trip test fixtures.
- Render Services: imageLoader, codeTokenizer, mathRenderer, diagramRenderer and cache boundaries.
- Storage Services: file storage, resource directory management, SQLite repositories, recent file list, settings and snapshots.
- Outline Service: heading extraction from runtime document or Markdown AST, selection tracking and navigation.
- Theme System: CSS variable tokens, light/dark themes, editor typography and rendered content styling.
- Quality Harness: unit tests for deep modules, integration tests for editor behavior, desktop flow tests and Markdown fixture tests.

## Testing Decisions

- Tests should focus on externally observable behavior: Markdown in/out, commands, file persistence, renderer fallback, and user-visible editor state.
- Do not test ProseMirror internals directly. Test EditorCore and MarkdownBridge contracts instead.
- MarkdownBridge needs fixture-based round-trip tests for headings, lists, nested lists, task lists, links, images, fenced code blocks, tables, front matter, math and Mermaid blocks.
- EditorCore needs command tests for common formatting, undo/redo, source/semantic mode switching, snapshot restore and dirty state.
- ProseMirror Adapter needs interaction tests for key editing behavior where bugs are user-visible: Enter, Backspace, Tab, paste, selection and IME composition.
- imageLoader needs tests for relative path resolution, missing files, paste/import naming, duplicate assets and paths with spaces or Chinese characters.
- Render services need fallback tests for unknown code languages, invalid math and invalid Mermaid syntax.
- Storage needs tests for open/save/save-as, file encoding, external file missing, permission failure and snapshot creation.
- Desktop flows should be checked on Windows first because the current target environment and Typedown reference both emphasize Windows behavior.
- Visual checks should cover light/dark themes, code blocks, tables, images, math, Mermaid containers and text overflow in the shell UI.

## Out of Scope

- Multi-user collaboration.
- Cloud sync and account system.
- Plugin marketplace or public third-party plugin API.
- Full Typora feature parity in the first version.
- Full-fidelity Markdown formatting preservation.
- Full docx, epub, LaTeX and publishing pipeline.
- Self-developed DOMD-style editor kernel as MVP implementation.
- Deep AI writing workflows, streaming generation and automated rewriting.
- Mobile application.

## Phased Implementation Steps

### 阶段 0：工程基线与边界确认

目标：建立可持续开发的工程骨架和术语边界。

主要工作：

- 初始化 Tauri 2 + Svelte + TypeScript 工程。
- 配置 JDK、Node、pnpm、lint、format、test 和基础构建脚本。
- 定义 EditorCore、EditorCommand、EditorSnapshot、EditorChangeEvent 的最小接口。
- 定义 MarkdownBridge、imageLoader、codeTokenizer、mathRenderer、diagramRenderer 的接口草案。
- 建立 CSS 变量主题基线。
- 建立 Markdown fixture 测试目录和第一批基础用例。

验收标准：

- 应用能启动空白窗口。
- Svelte 页面能挂载一个 editor host。
- TypeScript 类型检查和基础测试可运行。
- UI 层没有直接依赖 ProseMirror 类型。

### 阶段 1：可编辑闭环

目标：证明本地 Markdown 文件可以稳定打开、编辑、保存。

主要工作：

- 接入 ProseMirror 基础 schema、history、keymap 和 input rules。
- 实现 Markdown parse / serialize 的基础能力。
- 支持标题、段落、粗体、斜体、链接、引用、无序列表、有序列表、行内代码和代码块。
- 实现打开、保存、另存为和 dirty 状态。
- 实现 EditorCore 的 `getMarkdown`、`setMarkdown`、`execute`、`subscribe`、`destroy`。
- 做中文 IME、撤销重做、复制粘贴、文件编码和路径含中文的基础验证。

验收标准：

- 打开 `.md` 文件后能以语义编辑形态显示。
- 编辑标题、段落、列表和代码块后能保存回 Markdown。
- 保存后的文件能被其他 Markdown 编辑器正常打开。
- 中文输入不出现明显丢字、跳光标或重复提交。

### 阶段 2：Markdown-first 写作体验

目标：让应用从编辑器 demo 变成可用写作工具。

主要工作：

- 增加源码模式和语义编辑模式切换。
- 完善 Markdown 快捷输入规则。
- 实现 toolbar、状态栏、文件标题、保存状态、字数统计。
- 接入 imageLoader，支持相对路径预览、拖放图片、粘贴图片和缺失占位。
- 接入 Shiki codeTokenizer，支持异步代码高亮和 unknown language fallback。
- 实现 Outline 生成与点击跳转。
- 完善亮色、暗色主题和基础设置。

验收标准：

- 用户可以在源码模式和语义编辑模式之间切换且内容一致。
- 图片拖放或粘贴后进入资源目录，Markdown 保存相对路径。
- 代码块显示高亮，失败时回退为纯文本。
- Outline 能随文档标题变化更新。

### 阶段 3：技术文档能力增强

目标：覆盖技术文档常见写作能力。

主要工作：

- 支持 task list 的编辑、勾选和 Markdown 同步。
- 支持基础表格的插入、编辑和序列化。
- 支持 front matter 保留。
- 接入 KaTeX，支持行内公式和块级公式。
- 接入 Mermaid，支持源码和预览切换、错误显示和安全策略。
- 引入 SQLite 保存最近文件、基础设置、文档索引和快照。

验收标准：

- 任务列表、表格、公式、Mermaid 块保存后仍是可读 Markdown。
- front matter 不被编辑器破坏。
- 最近文件和设置能跨启动保留。
- Mermaid 和公式错误不会破坏原文。

### 阶段 4：桌面体验与稳定性打磨

目标：让应用接近可日常使用的桌面工具。

主要工作：

- 完善原生菜单、快捷键、最近文件、文件拖放打开和窗口状态恢复。
- 增加文件被外部修改、权限不足、路径不存在、资源丢失等异常提示。
- 增加历史快照和保存失败恢复策略。
- 优化大文件打开体验，先支持只读预览或延迟高亮。
- 做 Windows-first 的交互和视觉检查，再扩展 macOS / Linux。
- 补齐核心回归测试和端到端桌面流程。

验收标准：

- 常见文件错误有明确反馈，不静默失败。
- 保存失败时不丢失编辑内容。
- 大文件不会让应用无响应。
- Windows 上菜单、快捷键、文件路径和主题行为稳定。

### 阶段 5：长期内核与扩展探索

目标：在不影响稳定版本的前提下，为未来自研内核和高级能力做准备。

主要工作：

- 记录 EditorCore API 的实际使用压力，收敛不稳定接口。
- 实验 Markdown source map、raw block 和更高格式保真策略。
- 实验大文件分块解析和局部渲染。
- 探索 DOMD 式 Markdown-native 数据模型，但不替换稳定编辑路径。
- 在 EditorCore command / transaction 稳定后评估 AI 插入、批注、重写和插件协议。

验收标准：

- 自研内核实验不影响 ProseMirror 主线。
- 新能力必须先适配 EditorCore，而不是绕过它直连 UI。
- 能清晰判断哪些接口需要进入公开扩展点，哪些只是内部实现。

## Further Notes

关键风险：

- Markdown 序列化不保真会伤害用户信任，需要提前声明保真等级并建立 fixture 测试。
- ProseMirror 泄漏到 Svelte UI 会让未来内核替换困难，需要代码审查守住 EditorCore 边界。
- 图片、表格、列表、IME、粘贴和撤销重做是最容易暴露编辑器质量的问题，需要优先测试。
- SQLite 不能替代 Markdown 主存储，否则会偏离本地优先和 Markdown-first 的产品承诺。
- Mermaid、HTML 和外部资源要注意安全渲染策略，避免把不可信内容直接注入应用环境。

待确认项：

- 第一版首发平台是否明确 Windows-first，还是从一开始要求 Windows / macOS / Linux 同等体验。
- MVP 中 KaTeX、Mermaid、基础表格是否作为必做，还是放入第一版增强包。
- 是否需要单文件模式之外的文件夹工作区作为第一版必做能力。
- Markdown 格式保真的最低承诺是否只要求语义保真，还是需要保留更多原始空行、列表符号和表格排版。
