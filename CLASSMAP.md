# CLASSMAP.md

## Purpose

本文件将 Nomo Markdown 编辑器的功能映射到具体代码单元，帮助后续 AI 编码会话快速定位文件，避免大范围搜索。

## How to Use

- 修改行为前先查本文件。
- 用 **Feature Index** 按功能找候选代码。
- 用 **Code Unit Entries** 了解各模块的职责边界与非职责。
- 若本文件与代码冲突，**以代码为准**并更新本文件。

---

## Feature Index

### 应用启动与窗口生命周期

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 前端入口挂载 | `src/main.ts` | `src/app/App.svelte`, `src/app/components/SettingsWindow.svelte` | 添加新入口视图或全局样式加载 |
| 应用装配中心 | `src/app/App.svelte` | 所有 service、editor-core、组件 | 标签页/文件系统/编辑器之间的协调逻辑变更 |
| 桌面窗口生命周期 | `src/app/services/desktopWindow.ts` | `src-tauri/src/window/` | 窗口事件、关闭行为、托盘交互变更 |
| Rust 后端入口 | `src-tauri/src/lib.rs` | `src-tauri/src/main.rs` | 新增 IPC 命令、插件、窗口事件 |
| 自定义标题栏菜单 | `src/app/components/AppTitleBar.svelte` | `src/app/App.svelte`, `src/app/services/appCommands.ts` | 添加/移除菜单项、修改菜单文案 |
| 窗口状态持久化 | `src-tauri/src/window/state.rs` | `src-tauri/src/lib.rs`, `src-tauri/src/models.rs` | 窗口位置/尺寸/最大化状态恢复逻辑变更 |
| 外部打开路由 | `src-tauri/src/window/external_open.rs` | `src-tauri/src/lib.rs` | 单实例/启动参数/macOS open 事件 |

### 编辑器核心（ProseMirror）

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 编辑器工厂与 API | `src/lib/editor-core/createEditorCore.ts` | `src/lib/editor-core/index.ts` | EditorCore 创建参数或对外接口变更 |
| ProseMirror 核心实现 | `src/lib/editor-core/ProseMirrorEditorCore.ts` | `src/lib/editor-core/markdown.ts`, `schema.ts`, plugins, nodeViews | EditorView 生命周期、事务、模式切换、命令执行 |
| Schema 定义 | `src/lib/editor-core/schema.ts` | `src/lib/editor-core/callout/calloutSchema.ts` | 新增/修改节点或 mark 类型 |
| Markdown 解析与序列化 | `src/lib/editor-core/markdown.ts` | `src/lib/editor-core/callout/calloutParser.ts`, `calloutSerializer.ts`, `html/` | Markdown 与 ProseMirror doc 互转规则变更 |
| HTML 安全策略 | `src/lib/editor-core/html/htmlPolicy.ts` | `src/lib/editor-core/html/htmlClassifier.ts` | 可编辑 HTML 标签/属性白名单变更 |
| HTML 块分类 | `src/lib/editor-core/html/htmlClassifier.ts` | `src/lib/editor-core/html/htmlPolicy.ts` | HTML 块可编辑性判断/属性提取规则变更 |
| 编辑器命令 | `src/lib/editor-core/editorCommands.ts` | `src/lib/editor-core/tableCommands.ts`, `codeBlockCommands.ts`, `callout/calloutCommands.ts` | 新增或修改编辑命令 |
| 图表模板 | `src/lib/editor-core/diagramTemplates.ts` | `src/app/components/EditorToolbar.svelte` | 新增/修改 Mermaid 图表模板 |
| 链接安全与规范化 | `src/lib/editor-core/link.ts` | `src/lib/editor-core/plugins/linkInteraction.ts`, `src/quicklook/preview.ts` | 链接协议白名单/序列化规则变更 |
| 编辑器类型定义 | `src/lib/editor-core/types.ts` | 所有使用 EditorCore 的模块 | EditorCommand、EditorMode、SetMarkdownOptions 等类型变更 |

### NodeView 渲染

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 代码块 NodeView | `src/lib/editor-core/nodeViews/CodeBlockNodeView.ts` | `src/lib/services/shikiCodeTokenizer.ts`, `renderers.ts` | 代码块展示/编辑/高亮行为变更 |
| 图片 NodeView | `src/lib/editor-core/nodeViews/ImageNodeView.ts` | `src/app/services/desktopImageLoader.ts` | 图片加载/对齐/尺寸/右键行为变更 |
| 公式 NodeView | `src/lib/editor-core/nodeViews/MathBlockNodeView.ts`, `MathInlineNodeView.ts` | `src/lib/services/katexMathRenderer.ts` | 公式渲染/编辑体验变更 |
| 图表 NodeView | `src/lib/editor-core/nodeViews/MermaidBlockNodeView.ts` | `src/lib/services/mermaidDiagramRenderer.ts` | Mermaid 图表渲染变更 |
| Callout NodeView | `src/lib/editor-core/nodeViews/CalloutNodeView.ts` | `src/lib/editor-core/callout/` | 提示块展示/编辑变更 |
| HTML 块 NodeView | `src/lib/editor-core/nodeViews/HtmlBlockNodeView.ts` | `src/lib/editor-core/html/` | 可编辑 HTML 块行为变更 |
| TOC 块 NodeView | `src/lib/editor-core/nodeViews/TocBlockNodeView.ts` | `src/lib/toc/tocService.ts` | 文档内目录展示变更 |
| 注释块/行内注释 NodeView | `src/lib/editor-core/nodeViews/CommentBlockNodeView.ts`, `CommentInlineNodeView.ts` | `src/lib/editor-core/nodeViews/activeEditRegistry.ts` | 注释卡片展示/编辑/编辑态协调 |
| 脚注 NodeView | `src/lib/editor-core/nodeViews/FootnoteDefNodeView.ts`, `FootnoteRefNodeView.ts` | — | 脚注定义/引用展示、跳转、预览 |
| 分割线 NodeView | `src/lib/editor-core/nodeViews/HorizontalRuleNodeView.ts` | — | 水平分割线渲染/选中 |
| 编辑态注册表 | `src/lib/editor-core/nodeViews/activeEditRegistry.ts` | `CommentInlineNodeView.ts`, `CommentBlockNodeView.ts` | 跨 NodeView 编辑态互斥协调 |

### 编辑器插件

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 代码块导航 | `src/lib/editor-core/plugins/codeBlockNavigation.ts` | — | 代码块内外光标移动 |
| 代码高亮装饰 | `src/lib/editor-core/plugins/codeHighlight.ts` | `src/lib/services/shikiCodeTokenizer.ts` | 语法高亮装饰逻辑 |
| 公式输入规则 | `src/lib/editor-core/plugins/displayMathInput.ts`, `mathInlineInput.ts`, `mathBlock.ts` | — | 公式快捷输入 |
| 行内 Markdown 输入 | `src/lib/editor-core/plugins/inlineMarkdownMarkInput.ts` | — | 粗体/斜体/删除线等快捷输入 |
| 表格控件 | `src/lib/editor-core/plugins/tableControls.ts` | `src/lib/editor-core/plugins/tableControlDom.ts`, `tableHtml.ts` | 表格行列控制 UI |
| 任务列表 | `src/lib/editor-core/plugins/taskList.ts` | — | 任务列表交互 |
| 链接交互 | `src/lib/editor-core/plugins/linkInteraction.ts` | `src/app/components/LinkQuickEditor.svelte` | 链接点击/悬浮/编辑 |
| 待输入 mark | `src/lib/editor-core/plugins/pendingInlineMark.ts` | — | 按钮样式持续输入 |
| 搜索高亮 | `src/lib/editor-core/plugins/searchHighlight.ts` | `src/app/services/searchReplace.ts` | 搜索/替换高亮 |
| 尾部段落补全 | `src/lib/editor-core/plugins/trailingParagraph.ts` | — | 非段落块插入后自动追加空段落 |
| 编辑器上下文菜单插件 | `src/lib/editor-core/plugins/contextMenu.ts` | `src/app/components/ContextMenu.svelte` | 编辑区右键菜单事件分发 |
| 行内代码语法高亮装饰 | `src/lib/editor-core/plugins/codeHighlightDecorationPlugin.ts` | — | 行内 code mark 的 token 着色 |

### 文件系统与文档操作

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 文档操作控制器 | `src/app/services/documentActionsController.ts` | `src/app/services/documentFiles.ts`, `tabs.ts`, `recoveryDraft.ts` | 打开/保存/另存/自动保存/外部变更 |
| 标签页状态管理 | `src/app/services/tabs.ts` | `src/app/types.ts` | 标签页创建/复用/状态写入 |
| 恢复草稿 | `src/app/services/recoveryDraft.ts` | `src/app/services/documentActionsController.ts` | 异常退出后草稿写入/恢复 |
| Markdown 桥接 | `src/lib/markdown/MarkdownBridge.ts` | `src/lib/markdown/frontMatter.ts` | front matter 与正文分离/合并规则变更 |
| 图片插入协调 | `src/app/services/imageInsertion.ts` | `src/app/services/imageMarkdown.ts`, `src/lib/editor-core/renderers.ts` | 粘贴/拖放图片导入、策略选择、源码插入 |
| 图片 Markdown 路径 | `src/app/services/imageMarkdown.ts` | `src/app/services/imageInsertion.ts` | 图片文件过滤、路径/Markdown 语法生成 |
| 文件存储与文档仓库接口 | `src/lib/services/storage.ts` | `src/lib/desktop/tauriStorage.ts` | FileStorage、DocumentRepository 接口定义变更 |
| 渲染服务类型接口 | `src/lib/services/render.ts` | `src/lib/services/shikiCodeTokenizer.ts`, `katexMathRenderer.ts`, `mermaidDiagramRenderer.ts` | ImageLoader、CodeTokenizer、MathRenderer、DiagramRenderer 接口变更 |
| 文档文件 IO | `src/app/services/documentFiles.ts` | `src/lib/desktop/tauriStorage.ts` | 文件读取/保存/最近文件/目录树前端调用 |
| 文件夹资源管理 | `src/app/services/folderExplorerController.ts` | `src/app/services/folderTree.ts`, `explorerRows.ts` | 目录树加载/展开/同步 |
| 目录树纯函数 | `src/app/services/folderTree.ts` | — | 树的归一化/查找/更新 |
| 资源管理器展示 | `src/app/services/explorerRows.ts` | — | 树形拍平为可渲染行 |
| Rust 文件系统 | `src-tauri/src/file_system.rs` | `src-tauri/src/models.rs` | 后端文件读写/目录扫描/索引 |
| 图片资源后端 | `src-tauri/src/file_system/image_assets.rs` | — | 图片导入/解析/PicGo 上传/删除 |

### 大纲与导航

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 大纲服务 | `src/lib/outline/outlineService.ts` | — | 标题大纲/字数统计/阅读统计 |
| 大纲交互控制器 | `src/app/services/outlineInteractionController.ts` | `src/app/services/outlineNavigation.ts` | 点击大纲滚动定位 |
| 大纲滚动定位 | `src/app/services/outlineNavigation.ts` | `src/app/services/editorInteractionController.ts` | 模式切换/源码与语义视图滚动同步 |
| 大纲状态 | `src/app/services/outlineState.ts` | — | 大纲展开/折叠/可见性/激活项计算 |
| TOC 服务 | `src/lib/toc/tocService.ts` | `src/lib/editor-core/nodeViews/TocBlockNodeView.ts` | 生成 TOC Markdown/目录项数据 |

### 渲染服务

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 渲染器注册表 | `src/lib/editor-core/renderers.ts` | `src/lib/services/render.ts` | 全局渲染器注册/获取 |
| 代码高亮 | `src/lib/services/shikiCodeTokenizer.ts` | `src/lib/editor-core/nodeViews/CodeBlockNodeView.ts` | Shiki 代码 token 化 |
| 公式渲染 | `src/lib/services/katexMathRenderer.ts` | `src/lib/editor-core/nodeViews/MathBlockNodeView.ts`, `MathInlineNodeView.ts` | KaTeX 公式渲染 |
| 图表渲染 | `src/lib/services/mermaidDiagramRenderer.ts` | `src/lib/editor-core/nodeViews/MermaidBlockNodeView.ts` | Mermaid 图表渲染 |
| 图片加载器 | `src/app/services/desktopImageLoader.ts` | `src/lib/editor-core/nodeViews/ImageNodeView.ts` | 本地/asset/远程图片解析 |

### 设置与偏好

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 设置模型与持久化 | `src/app/services/settings.ts` | `src/lib/desktop/tauriStorage.ts` | AppPreferences 定义/默认值/加载/保存 |
| 编辑器设置应用 | `src/app/services/editorSettingsController.ts` | `src/app/services/settings.ts` | 字体/主题/布局/模式同步到编辑器 |
| 设置窗口 UI | `src/app/components/SettingsWindow.svelte` | `src/app/services/settings.ts`, `src/lib/desktop/tauriUpdater.ts` | 设置界面/更新/文件关联/图片配置 |
| Rust 配置管理 | `src-tauri/src/config/mod.rs` | `src-tauri/src/models.rs` | 应用配置 JSON 持久化、设置读写、启动前读取 |

### 搜索与替换

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 搜索替换逻辑 | `src/app/services/searchReplace.ts` | `src/app/components/SearchReplacePanel.svelte` | 搜索/替换算法和状态管理 |
| 搜索替换面板 | `src/app/components/SearchReplacePanel.svelte` | `src/app/services/searchReplace.ts` | 搜索替换 UI 交互 |

### 确认对话框

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 确认对话框状态管理 | `src/app/services/confirmAction.ts` | `src/app/components/ConfirmDialog.svelte` | 确认对话框 Promise 模式/三按钮模式变更 |
| 通用确认对话框 | `src/app/components/ConfirmDialog.svelte` | `src/app/services/confirmAction.ts` | 确认/放弃/保存按钮 UI 变更 |
| 未保存确认对话框 | `src/app/components/UnsavedConfirmDialog.svelte` | `src/app/services/confirmAction.ts` | 未保存文档丢弃确认 UI |
| 外部变更对话框 | `src/app/components/ExternalChangeDialog.svelte` | `src/app/services/documentActionsController.ts` | 外部文件修改/删除提示 UI |
| 关闭窗口行为对话框 | `src/app/components/CloseWindowBehaviorDialog.svelte` | `src-tauri/src/window/tray.rs` | 关闭窗口 vs 关闭到托盘选择 UI |

### 平台与首次运行

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 平台检测 | `src/app/services/platform.ts` | `src/app/services/desktopWindow.ts`, `src/app/components/AppTitleBar.svelte` | 平台判断/窗口 chrome 模式变更 |
| 首次运行样本文档 | `src/app/services/firstRunSample.ts` | `src/app/App.svelte` | 首次启动判断/示例文档打开逻辑变更 |
| 应用 UI 状态 | `src/app/services/appUiState.ts` | `src/app/components/ExplorerSidebar.svelte` | 菜单切换/侧边栏 resize 纯函数 |

### 日志与导出

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 前端日志工具 | `src/lib/services/logger.ts` | `src-tauri/src/app_logger.rs` | 日志级别/缓冲区/性能计时/DevTools 输出 |
| 后端日志系统 | `src-tauri/src/app_logger.rs` | `src/lib/services/logger.ts` | 日志文件落盘/轮转/终端输出 |
| HTML 导出后端 | `src-tauri/src/export.rs` | `src/app/services/exportService.ts` | HTML 文件写入/Base64 读取 |
| Windows PDF 导出 | `src-tauri/src/export_windows.rs` | `src-tauri/src/export.rs` | Edge headless PDF 生成 |

### 导出

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| HTML/PDF 导出 | `src/app/services/exportService.ts` | `src/lib/desktop/tauriStorage.ts`, `src/app/styles/export-document.css` | 导出格式、图片内嵌策略、HTML 模板变更 |

### 本地化

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 前端本地化 | `src/app/i18n.ts` | `src/app/i18n.ja.ts`, `src/paraglide/` | 界面文案/语言切换 |
| 后端本地化 | `src-tauri/src/i18n.rs` | — | 菜单/托盘/系统集成文案 |
| Inlang 生成物 | `src/paraglide/messages*.js` | `project.inlang/messages/*.json` | 运行时语言消息（自动生成，不要手改） |

### Quick Look 预览（macOS）

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| Quick Look 渲染入口 | `src/quicklook/preview-entry.ts` | `src/quicklook/preview.ts` | 读取 payload 并渲染 |
| Quick Look Markdown 渲染 | `src/quicklook/preview.ts` | `src/lib/editor-core/callout/calloutParser.ts`, `src/lib/editor-core/link.ts` | markdown-it 渲染/Callout/公式/图片/链接安全 |
| Quick Look 样式 | `src/quicklook/preview.css` | — | 预览页面样式 |
| macOS 扩展入口 | `src-tauri/macos/NomoQuickLookPreview/PreviewViewController.swift` | `src/quicklook/` | Swift 扩展加载前端并注入 payload |

### 软件更新

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 更新前端适配 | `src/lib/desktop/tauriUpdater.ts` | `src/app/components/SettingsWindow.svelte` | 检查/下载/安装更新前端逻辑 |
| 更新后端 | `src-tauri/src/software_update.rs` | — | GitHub Release/下载/校验/安装器 |

### 原生系统集成

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 原生菜单 | `src-tauri/src/window/menu.rs` | `src-tauri/src/i18n.rs` | 菜单构建/快捷键/事件处理 |
| 系统托盘 | `src-tauri/src/window/tray.rs` | `src-tauri/src/window/commands.rs` | 托盘安装/刷新/关闭到托盘 |
| 外部打开路由 | `src-tauri/src/window/external_open.rs` | `src-tauri/src/lib.rs` | 单实例/启动参数/macOS open 事件 |
| Windows 文件关联 | `src-tauri/src/window/file_association.rs` | — | 注册/注销默认打开方式和右键菜单 |
| 平台适配 | `src-tauri/src/window/os/macos.rs`, `os/windows.rs` | `src-tauri/src/window/os/mod.rs` | macOS/Windows 窗口行为差异 |
| 外部链接安全 | `src-tauri/src/external_link.rs` | — | 打开外部链接/文件管理器定位 |
| 配置命令 IPC | `src-tauri/src/config/commands.rs` | `src-tauri/src/config/mod.rs` | 设置读写/最近文件/快照/应用设置 IPC |
| 窗口命令 IPC | `src-tauri/src/window/commands.rs` | `src-tauri/src/window/menu.rs`, `src-tauri/src/window/tray.rs` | 窗口状态保存/设置窗口/菜单安装/强制关闭 IPC |

### UI 通用组件

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 通用上下文菜单 | `src/app/components/ContextMenu.svelte` | `src/lib/editor-core/plugins/contextMenu.ts` | 右键菜单 UI 渲染/定位 |
| 状态栏 | `src/app/components/StatusBar.svelte` | `src/lib/outline/outlineService.ts` | 字数统计/缩放百分比展示 |
| Front Matter 卡片 | `src/app/components/FrontMatterCard.svelte` | `src/lib/markdown/frontMatter.ts` | YAML 元数据展示/编辑/删除 |
| 空工作区 | `src/app/components/EmptyWorkspace.svelte` | — | 无文档时的新建/打开引导 |
| 文件夹打开对话框 | `src/app/components/FolderOpenDialog.svelte` | `src/app/services/folderExplorerController.ts` | 打开文件夹窗口选择 UI |
| 链接快速编辑器 | `src/app/components/LinkQuickEditor.svelte` | `src/lib/editor-core/plugins/linkInteraction.ts` | 链接文字/地址编辑弹出层 |

### Svelte Actions

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 点击外部检测 | `src/app/actions/clickOutside.ts` | `ContextMenu.svelte`, `FrontMatterCard.svelte`, `StatusBar.svelte` | 下拉菜单/弹出层外部点击关闭 |
| 过渡动画 | `src/app/actions/motion.ts` | 多个对话框/弹出层组件 | fade/slide 动画统一配置 |

---

## Code Unit Entries

### `src/main.ts`

**Kind:** entry

**Owns:**
- 前端应用入口挂载逻辑
- 根据 URL 参数 (`view=settings`) 决定加载主应用或设置窗口
- 全局样式（theme.css, global.css）加载
- KaTeX 和 ProseMirror 样式在 main 视图下按需加载

**Does not own:**
- 不拥有具体业务组件逻辑（委派给 App.svelte / SettingsWindow.svelte）
- 不拥有编辑器初始化

**Called by:** `index.html`

**Depends on:** `src/app/App.svelte`, `src/app/components/SettingsWindow.svelte`, `src/lib/services/logger.ts`

**Change this when:**
- 添加新的入口视图
- 修改全局样式加载顺序
- 调整入口挂载逻辑

**Do not change this when:**
- 修改具体业务组件行为
- 修改编辑器功能

**Related tests:** —

**Confidence:** high

---

### `src/app/App.svelte`

**Kind:** component / app shell

**Owns:**
- 应用核心装配：连接 Tauri、编辑器核心、文件系统、设置、标签页
- 初始化渲染服务（Shiki、KaTeX、Mermaid、图片加载器）
- 创建 `EditorCore` 实例
- 加载设置和工作区状态
- 协调打开、保存、自动保存、模式切换、外部文件打开、关闭确认
- 订阅编辑器内容变化并同步 dirty/统计/大纲状态

**Does not own:**
- 不拥有具体 UI 子组件渲染逻辑（委派给 AppShell.svelte）
- 不拥有编辑器内部实现细节（通过 EditorCore API 交互）
- 不拥有文件系统直接 IO（通过 documentFiles.ts 调用）

**Called by:** `src/main.ts`

**Depends on:** `src/app/services/*`, `src/lib/editor-core/*`, `src/lib/desktop/*`, `src/lib/services/*`, `src/app/components/AppShell.svelte`

**Change this when:**
- 添加新的全局事件监听
- 修改编辑器初始化流程
- 修改文件打开/保存/自动保存协调逻辑
- 修改标签页管理流程

**Do not change this when:**
- 修改纯 UI 组件内部样式或布局
- 修改编辑器内部 ProseMirror 逻辑

**Related tests:** `src/app/App.layout.test.ts`

**Confidence:** high

---

### `src/app/components/AppShell.svelte`

**Kind:** component

**Owns:**
- 应用顶层布局：标题栏、侧边栏、标签栏、编辑区、状态栏、对话框
- 通过 props 和回调将 App.svelte 的状态下发给子组件

**Does not own:**
- 不拥有业务状态管理（由 App.svelte 传入）
- 不拥有具体编辑器逻辑

**Called by:** `src/app/App.svelte`

**Depends on:** `AppTitleBar.svelte`, `ExplorerSidebar.svelte`, `DocumentTabs.svelte`, `EditorToolbar.svelte`, `EditorWorkspace.svelte`, `StatusBar.svelte`, `ConfirmDialog.svelte`, `CloseWindowBehaviorDialog.svelte`, `FolderOpenDialog.svelte`, `EmptyWorkspace.svelte`, `SearchReplacePanel.svelte`

**Change this when:**
- 调整整体应用布局结构
- 添加/移除顶层 UI 区域

**Do not change this when：**
- 修改具体业务逻辑
- 修改编辑器内部行为

**Related tests:** `src/app/App.layout.test.ts`

**Confidence:** high

---

### `src/app/components/SettingsWindow.svelte`

**Kind:** component

**Owns:**
- 设置中心 UI：通用、编辑器、外观、文件、图片、统计、高级、关于等设置页
- 加载/保存 `AppPreferences`
- 软件更新、文件关联、右键菜单、图片上传配置等设置项交互

**Does not own:**
- 不拥有设置持久化后端逻辑（通过 settings.ts）
- 不拥有软件更新后端（通过 tauriUpdater.ts）

**Called by:** `src/main.ts`（当 `view=settings` 时）

**Depends on:** `src/app/services/settings.ts`, `src/lib/desktop/tauriUpdater.ts`, `src/lib/desktop/tauriStorage.ts`, `src/app/i18n.ts`

**Change this when:**
- 添加新的设置项 UI
- 修改设置分类布局
- 修改设置项交互方式

**Do not change this when:**
- 修改设置模型结构（在 settings.ts 中）
- 修改后端配置结构（在 config/mod.rs 中）

**Related tests:** —

**Confidence:** high

---

### `src/app/components/ExplorerSidebar.svelte`

**Kind:** component

**Owns:**
- 资源管理器侧边栏 UI
- 目录树、最近文件、行内重命名、创建文件/文件夹、右键菜单
- 侧边栏 resize 逻辑

**Does not own:**
- 不拥有目录树数据管理（由 folderExplorerController.ts 提供）
- 不拥有文件系统直接操作

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/services/explorerRows.ts`, `ContextMenu.svelte`, `src/app/types.ts`

**Change this when:**
- 修改侧边栏布局或交互
- 修改目录树行展示逻辑
- 修改右键菜单项

**Do not change this when：**
- 修改目录扫描后端逻辑
- 修改文件树数据结构定义

**Related tests:** —

**Confidence:** high

---

---

### `src/app/components/AppTitleBar.svelte`

**Kind:** component

**Owns:**
- Windows / Linux 自定义标题栏：窗口控制按钮、应用菜单（文件、编辑、段落、格式、查看、设置）。
- 将菜单点击转换为应用命令或调用传入的业务处理函数。

**Does not own：**
- 不拥有具体业务逻辑（由 App.svelte 通过 props 注入）。
- 不拥有 macOS 原生菜单（在 Rust `window/menu.rs` 中）。

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/i18n.ts`, `src/app/services/platform.ts`, `@lucide/svelte`

**Change this when：**
- 添加/移除自定义标题栏菜单项。
- 修改菜单快捷键展示文案。

**Do not change this when：**
- 修改菜单命令后端处理逻辑。

**Related tests:** —

**Confidence:** high

---

### `src/app/components/EditorWorkspace.svelte`

**Kind:** component

**Owns:**
- 编辑工作区 UI：源码 textarea、ProseMirror 挂载点
- Front Matter 卡片、大纲面板
- 外部变更提示
- 模式切换（语义编辑/源码编辑/只读/大文档提示）

**Does not own:**
- 不拥有编辑器核心实现（由 EditorCore 管理）
- 不拥有大纲数据计算（由 outlineService.ts 提供）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `FrontMatterCard.svelte`, `src/lib/editor-core/types.ts`

**Change this when：**
- 修改编辑区布局
- 修改模式切换 UI 行为
- 修改大纲面板展示

**Do not change this when：**
- 修改 ProseMirror 内部逻辑
- 修改 Markdown 解析规则

**Related tests:** —

**Confidence:** high

---

### `src/app/components/DocumentTabs.svelte`

**Kind:** component

**Owns:**
- 标签页 UI：展示打开文档、切换标签、关闭标签
- 固定预览标签状态
- 右键菜单

**Does not own:**
- 不拥有标签页状态管理（由 tabs.ts 和 documentActionsController.ts 管理）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `ContextMenu.svelte`, `src/app/types.ts`

**Change this when：**
- 修改标签页展示样式
- 修改标签切换/关闭交互

**Do not change this when：**
- 修改标签页数据管理逻辑

**Related tests:** —

**Confidence:** high

---

### `src/app/components/EditorToolbar.svelte`

**Kind:** component

**Owns:**
- 编辑工具栏 UI：标题、行内格式、列表、表格、公式、图表等命令按钮
- 将按钮操作转换为 `EditorCommand` 传给编辑器核心

**Does not own：**
- 不拥有命令具体实现（在 editorCommands.ts 中）
- 不拥有图表模板定义（在 diagramTemplates.ts 中）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/lib/editor-core/types.ts`, `src/lib/editor-core/diagramTemplates.ts`

**Change this when：**
- 添加新的工具栏按钮
- 修改工具栏布局
- 修改命令触发方式

**Do not change this when：**
- 修改命令内部实现逻辑

**Related tests:** `src/app/services/appCommands.test.ts`

**Confidence:** high

---

### `src/app/components/SearchReplacePanel.svelte`

**Kind:** component

**Owns:**
- 搜索/替换面板 UI
- 搜索输入、替换输入、选项控制

**Does not own：**
- 不拥有搜索替换算法（在 searchReplace.ts 中）
- 不拥有编辑器内高亮逻辑（在 searchHighlight.ts 中）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/services/searchReplace.ts`

**Change this when：**
- 修改搜索替换面板布局
- 修改搜索选项交互

**Do not change this when：**
- 修改搜索替换核心算法

**Related tests:** `src/app/services/searchReplace.test.ts`

**Confidence:** high

---

### `src/app/services/documentActionsController.ts`

**Kind:** controller

**Owns:**
- 文档操作协调：打开、拖拽打开、保存、另存、自动保存
- 外部文件变化检测与处理
- 标签页文档状态切换
- 恢复草稿管理

**Does not own：**
- 不拥有文件系统直接 IO（通过 documentFiles.ts）
- 不拥有标签页纯函数操作（通过 tabs.ts）
- 不拥有大纲计算（通过 outlineService.ts）

**Called by:** `src/app/App.svelte`

**Depends on:** `src/app/services/documentFiles.ts`, `src/app/services/tabs.ts`, `src/lib/markdown/normalize.ts`, `src/lib/outline/outlineService.ts`, `src/app/services/recoveryDraft.ts`

**Change this when：**
- 修改打开/保存/自动保存流程
- 修改外部文件变化处理逻辑
- 修改草稿恢复逻辑

**Do not change this when：**
- 修改文件系统后端实现
- 修改编辑器内部行为

**Related tests:** `src/app/services/externalFileChangeFlow.test.ts`

**Confidence:** high

---

### `src/app/services/editorInteractionController.ts`

**Kind:** controller

**Owns:**
- 编辑/源码模式切换
- 滚动锚点恢复（按大纲锚点恢复视觉焦点）
- 源码 textarea 高度同步
- 命令执行和 TOC 插入

**Does not own：**
- 不拥有编辑器核心创建（在 App.svelte 中）
- 不拥有大纲数据计算（通过 outlineNavigation.ts）

**Called by:** `src/app/App.svelte`

**Depends on:** `src/lib/editor-core/types.ts`, `src/app/services/outlineNavigation.ts`, `src/lib/toc/tocService.ts`

**Change this when：**
- 修改模式切换逻辑
- 修改滚动恢复行为
- 修改 TOC 插入流程

**Do not change this when：**
- 修改编辑器核心实现

**Related tests:** `src/app/services/editorInteractionController.test.ts`

**Confidence:** high

---

### `src/app/services/folderExplorerController.ts`

**Kind:** controller

**Owns:**
- 文件夹资源管理：加载文件夹、展开祖先目录
- 懒加载子目录
- 同步已加载目录
- 处理后台索引批次

**Does not own：**
- 不拥有目录树纯函数（在 folderTree.ts 中）
- 不拥有展示行拍平（在 explorerRows.ts 中）

**Called by:** `src/app/App.svelte`

**Depends on:** `src/app/services/documentFiles.ts`, `src/app/services/folderTree.ts`, `src/lib/desktop/tauriStorage.ts`

**Change this when：**
- 修改文件夹加载逻辑
- 修改目录展开/折叠行为
- 修改后台索引处理

**Do not change this when：**
- 修改目录树纯数据结构操作

**Related tests:** `src/app/services/folderExplorerController.test.ts`

**Confidence:** high

---

### `src/app/services/settings.ts`

**Kind:** model / service

**Owns:**
- `AppPreferences` 定义与默认值
- 设置归一化、加载、保存
- 主题/排版/布局应用逻辑

**Does not own：**
- 不拥有设置 UI（在 SettingsWindow.svelte 中）
- 不拥有后端配置存储直接操作（通过 tauriStorage.ts）

**Called by:** `src/app/App.svelte`, `src/app/components/SettingsWindow.svelte`, `src/app/services/editorSettingsController.ts`

**Depends on:** `src/lib/desktop/tauriStorage.ts`

**Change this when：**
- 添加新的设置项
- 修改设置默认值
- 修改设置归一化逻辑
- 修改主题/布局应用逻辑

**Do not change this when：**
- 修改设置 UI 展示方式
- 修改后端配置结构（在 config/mod.rs 中）

**Related tests:** `src/app/services/settings.test.ts`

**Confidence:** high

---

### `src/app/services/searchReplace.ts`

**Kind:** service

**Owns:**
- 搜索/替换算法和状态管理
- 搜索高亮与编辑器交互

**Does not own：**
- 不拥有搜索面板 UI（在 SearchReplacePanel.svelte 中）
- 不拥有编辑器内高亮插件（在 searchHighlight.ts 中）

**Called by:** `src/app/components/SearchReplacePanel.svelte`, `src/app/App.svelte`

**Depends on:** `src/lib/editor-core/types.ts`

**Change this when：**
- 修改搜索算法
- 修改替换逻辑
- 修改搜索状态管理

**Do not change this when：**
- 修改搜索面板 UI

**Related tests:** `src/app/services/searchReplace.test.ts`

**Confidence:** high

---

### `src/app/services/exportService.ts`

**Kind:** service

**Owns:**
- HTML/PDF 导出：构建自包含 HTML 文档
- 图片内嵌策略：将本地图片（本地路径、asset 协议）和远程图片（https://）转为 base64 data URL
- 编辑器 UI 痕迹清理（cleanEditorArtifacts）
- 完整 HTML 文档外壳生成（createExportHtmlDocument）
- 文件保存对话框调用（pickSavePath）

**Does not own：**
- 不拥有文件系统写入（通过 tauriStorage.ts 的 invoke 调用）
- 不拥有 PDF 渲染（通过 tauriStorage.ts 的 exportPdfFromHtml）
- 不拥有导出 UI 触发（在 AppShell.svelte / AppTitleBar.svelte 中）

**Called by:** `src/app/App.svelte`（通过菜单/快捷键触发导出）

**Depends on:** `src/lib/desktop/tauriStorage.ts`, `src/app/styles/export-document.css`

**Change this when：**
- 修改图片内嵌策略（新增/移除图片来源类型支持）
- 修改 HTML 模板结构或样式
- 修改编辑器痕迹清理规则

**Do not change this when：**
- 修改导出触发 UI
- 修改后端文件写入逻辑

**Related tests:** `src/app/services/exportService.test.ts`

**Confidence:** high

---

### `src/app/services/appCommands.ts`

**Kind:** service

**Owns:**
- 应用命令与快捷键分发：连接菜单命令、全局快捷键和编辑器命令
- 处理 `new-file`、`save-file`、`menu-link`、`insert-diagram:*` 等命令

**Does not own：**
- 不拥有编辑器命令具体实现（在 editorCommands.ts 中）
- 不拥有菜单 UI 构建（在 Rust 后端 menu.rs 中）

**Called by:** `src/app/App.svelte`

**Depends on:** `src/lib/editor-core/types.ts`, `src/app/services/settings.ts`

**Change this when：**
- 添加新的应用级命令
- 修改快捷键映射
- 修改命令分发逻辑

**Do not change this when：**
- 修改编辑器内部命令实现

**Related tests:** `src/app/services/appCommands.test.ts`

**Confidence:** high

---

### `src/lib/editor-core/index.ts`

**Kind:** entry

**Owns:**
- 编辑器核心导出入口
- 集中导出 `EditorCore`、类型、命令和创建函数

**Does not own：**
- 不拥有具体实现（委派给内部模块）

**Called by:** 应用层所有使用编辑器的地方

**Depends on:** `src/lib/editor-core/createEditorCore.ts`, `src/lib/editor-core/types.ts`

**Change this when：**
- 新增/移除对外暴露的编辑器 API
- 调整导出结构

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/createEditorCore.ts`

**Kind:** factory

**Owns：**
- `ProseMirrorEditorCore` 实例创建
- 对外提供稳定创建入口

**Does not own：**
- 不拥有编辑器运行时逻辑（在 ProseMirrorEditorCore.ts 中）

**Called by:** `src/app/App.svelte`, 应用层

**Depends on:** `src/lib/editor-core/ProseMirrorEditorCore.ts`

**Change this when：**
- 修改编辑器创建参数
- 修改初始化配置

**Do not change this when：**
- 修改编辑器运行时行为

**Related tests:** `src/lib/editor-core/createEditorCore.test.ts`

**Confidence:** high

---

### `src/lib/editor-core/ProseMirrorEditorCore.ts`

**Kind:** service

**Owns：**
- `EditorView` 生命周期管理
- 编辑器状态创建与事务派发
- Markdown 同步（编辑后序列化为 Markdown 通知应用层）
- 文档脏状态管理
- 模式切换（语义/源码）
- 命令执行
- 插件和 NodeView 注册

**Does not own：**
- 不拥有 Markdown 解析/序列化具体规则（在 markdown.ts 中）
- 不拥有 Schema 定义（在 schema.ts 中）
- 不拥有渲染服务实现（通过 renderers.ts 注册）

**Called by:** `src/lib/editor-core/createEditorCore.ts`

**Depends on:** `src/lib/editor-core/schema.ts`, `src/lib/editor-core/markdown.ts`, `src/lib/editor-core/editorCommands.ts`, `src/lib/editor-core/renderers.ts`, `src/lib/editor-core/plugins/*`, `src/lib/editor-core/nodeViews/*`

**Change this when：**
- 修改编辑器生命周期管理
- 修改事务处理逻辑
- 修改模式切换流程
- 修改插件/NodeView 注册方式

**Do not change this when：**
- 修改具体 Markdown 语法规则
- 修改具体渲染服务实现

**Related tests:** `src/lib/editor-core/*.test.ts`（多个测试覆盖不同命令和创建流程）

**Confidence:** high

---

### `src/lib/editor-core/markdown.ts`

**Kind:** service

**Owns：**
- 基于 `markdown-it` 和 `prosemirror-markdown` 的 Markdown 解析
- ProseMirror doc 序列化回 Markdown
- 表格、图片扩展属性、公式、脚注、HTML、Callout、TOC、Mermaid、注释等语法处理

**Does not own：**
- 不拥有基础 markdown-it 规则（依赖库提供）
- 不拥有 Callout 具体解析规则（在 callout/calloutParser.ts 中）
- 不拥有 HTML 转换逻辑（在 html/ 目录中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`

**Depends on:** `src/lib/editor-core/schema.ts`, `src/lib/editor-core/callout/calloutParser.ts`, `src/lib/editor-core/callout/calloutSerializer.ts`, `src/lib/editor-core/html/htmlToPmLogic.ts`, `src/lib/editor-core/html/pmToHtml.ts`

**Change this when：**
- 修改 Markdown 解析规则
- 修改 Markdown 序列化输出格式
- 新增 Markdown 语法支持

**Do not change this when：**
- 修改编辑器 UI 行为
- 修改渲染样式

**Related tests:** `src/lib/editor-core/markdown.test.ts`

**Confidence:** high

---

### `src/lib/editor-core/schema.ts`

**Kind:** model

**Owns：**
- ProseMirror Schema 定义
- 扩展 Markdown 基础 schema：图片属性、表格、公式、HTML、注释、脚注、TOC、Mermaid、Callout 等节点/mark

**Does not own：**
- 不拥有解析/序列化规则（在 markdown.ts 中）
- 不拥有 Callout schema 细节（在 callout/calloutSchema.ts 中）

**Called by:** `src/lib/editor-core/markdown.ts`, `src/lib/editor-core/ProseMirrorEditorCore.ts`, `src/lib/editor-core/editorCommands.ts`, nodeViews, plugins

**Depends on:** `src/lib/editor-core/callout/calloutSchema.ts`

**Change this when：**
- 新增/修改节点或 mark 类型
- 修改文档结构约束

**Do not change this when：**
- 修改解析规则
- 修改 UI 展示

**Related tests:** `src/lib/editor-core/*.test.ts`（涉及 schema 的测试）

**Confidence:** high

---

### `src/lib/editor-core/editorCommands.ts`

**Kind:** service

**Owns：**
- 编辑器命令实现：标题、粗体、斜体、链接、列表、引用、代码块、表格、公式、图表、TOC 等
- 将应用层 `EditorCommand` 转换为 ProseMirror transaction

**Does not own：**
- 不拥有表格命令细节（在 tableCommands.ts 中）
- 不拥有代码块命令细节（在 codeBlockCommands.ts 中）
- 不拥有 Callout 命令细节（在 callout/calloutCommands.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`, `src/app/services/appCommands.ts`

**Depends on:** `src/lib/editor-core/schema.ts`, `src/lib/editor-core/tableCommands.ts`, `src/lib/editor-core/codeBlockCommands.ts`, `src/lib/editor-core/callout/calloutCommands.ts`

**Change this when：**
- 新增编辑命令
- 修改现有命令行为
- 修改命令参数

**Do not change this when：**
- 修改编辑器事务底层逻辑
- 修改 UI 触发方式

**Related tests:** `src/lib/editor-core/editorCommands.test.ts`

**Confidence:** high

---

### `src/lib/editor-core/renderers.ts`

**Kind:** registry

**Owns：**
- 渲染器注册表：保存代码高亮、图表、公式、图片加载器等全局适配器
- 让 NodeView 不直接依赖具体第三方库实例

**Does not own：**
- 不拥有具体渲染服务实现（在 src/lib/services/ 中）

**Called by:** `src/app/App.svelte`（初始化注册）, `src/lib/editor-core/nodeViews/*`（读取使用）

**Depends on:** `src/lib/services/render.ts`

**Change this when：**
- 新增渲染器类型
- 修改渲染器注册方式

**Do not change this when：**
- 修改具体渲染算法

**Related tests:** —

**Confidence:** high

---

### `src/lib/services/shikiCodeTokenizer.ts`

**Kind:** service

**Owns：**
- 调用 Shiki 对代码进行 token 化并缓存
- 为代码块 NodeView 和装饰插件提供高亮数据

**Does not own：**
- 不拥有代码块展示逻辑（在 CodeBlockNodeView.ts 中）

**Called by:** `src/app/App.svelte`（注册到 renderers.ts）

**Depends on:** `shiki`

**Change this when：**
- 修改代码高亮算法
- 修改 token 缓存策略

**Do not change this when：**
- 修改代码块 UI

**Related tests:** `src/lib/services/shikiCodeTokenizer.test.ts`

**Confidence:** high

---

### `src/lib/services/katexMathRenderer.ts`

**Kind:** service

**Owns：**
- 调用 KaTeX 渲染行内/块级公式
- 为公式 NodeView 提供 HTML 结果

**Does not own：**
- 不拥有公式编辑交互（在 MathBlockNodeView.ts / MathInlineNodeView.ts 中）

**Called by:** `src/app/App.svelte`（注册到 renderers.ts）

**Depends on:** `katex`

**Change this when：**
- 修改公式渲染配置
- 修改错误处理方式

**Do not change this when：**
- 修改公式输入规则

**Related tests:** `src/lib/services/katexMathRenderer.test.ts`

**Confidence:** high

---

### `src/lib/services/mermaidDiagramRenderer.ts`

**Kind:** service

**Owns：**
- 调用 Mermaid 渲染图表
- 为 Mermaid NodeView 提供 SVG

**Does not own：**
- 不拥有图表代码编辑交互（在 MermaidBlockNodeView.ts 中）

**Called by:** `src/app/App.svelte`（注册到 renderers.ts）

**Depends on:** `mermaid`

**Change this when：**
- 修改 Mermaid 配置
- 修改图表渲染错误处理

**Do not change this when：**
- 修改图表插入流程

**Related tests:** `src/lib/editor-core/diagramBlock.test.ts`

**Confidence:** high

---

### `src/lib/outline/outlineService.ts`

**Kind:** service

**Owns：**
- 从 Markdown 计算标题大纲
- 字数统计和阅读统计

**Does not own：**
- 不拥有大纲 UI 展示（在 EditorWorkspace.svelte 中）
- 不拥有大纲交互（在 outlineInteractionController.ts 中）

**Called by:** `src/app/App.svelte`, `src/app/services/documentActionsController.ts`

**Depends on:** —

**Change this when：**
- 修改大纲提取算法
- 修改字数/阅读统计逻辑

**Do not change this when：**
- 修改大纲面板 UI

**Related tests:** `src/lib/outline/outlineService.test.ts`

**Confidence:** high

---

### `src/lib/toc/tocService.ts`

**Kind:** service

**Owns：**
- 生成 TOC Markdown 块
- 生成目录项数据

**Does not own：**
- 不拥有 TOC 块展示（在 TocBlockNodeView.ts 中）

**Called by:** `src/app/services/editorInteractionController.ts`, `src/lib/editor-core/nodeViews/TocBlockNodeView.ts`

**Depends on:** —

**Change this when：**
- 修改 TOC 生成逻辑
- 修改目录项数据结构

**Do not change this when：**
- 修改 TOC 块渲染样式

**Related tests:** `src/lib/toc/tocService.test.ts`

**Confidence:** high

---

### `src/lib/markdown/frontMatter.ts`

**Kind:** utility

**Owns：**
- 识别 Markdown 开头的 YAML front matter
- 拆出元数据块和正文

**Does not own：**
- 不拥有 front matter UI（在 FrontMatterCard.svelte 中）

**Called by:** `src/lib/markdown/MarkdownBridge.ts`, 编辑器/文档流程

**Depends on:** —

**Change this when：**
- 修改 front matter 解析规则
- 修改 YAML 边界检测

**Do not change this when：**
- 修改 front matter 展示 UI

**Related tests:** `src/lib/markdown/frontMatter.test.ts`

**Confidence:** high

---

### `src/lib/markdown/normalize.ts`

**Kind:** utility

**Owns：**
- 保存前规范化 Markdown 文本
- 末尾换行等格式统一

**Does not own：**
- 不拥有保存流程（在 documentActionsController.ts 中）

**Called by:** `src/app/services/documentActionsController.ts`

**Depends on:** —

**Change this when：**
- 修改保存规范化规则

**Related tests:** `src/lib/markdown/normalize.test.ts`

**Confidence:** high

---

### `src/lib/desktop/tauriStorage.ts`

**Kind:** service

**Owns：**
- 封装配置存储、文件系统、图片资源、窗口设置等 Tauri `invoke` 调用
- 为浏览器环境提供 fallback

**Does not own：**
- 不拥有后端具体实现（在 Rust 中）

**Called by:** `src/app/services/settings.ts`, `src/app/services/documentFiles.ts`, `src/app/services/folderExplorerController.ts`

**Depends on:** `@tauri-apps/api`

**Change this when：**
- 新增/修改前端 IPC 调用封装
- 修改 fallback 逻辑

**Do not change this when：**
- 修改后端 IPC 命令实现

**Related tests:** `src/lib/desktop/tauriStorage.test.ts`

**Confidence:** high

---

### `src/quicklook/preview.ts`

**Kind:** service

**Owns：**
- Quick Look Markdown 渲染
- 支持 Callout、公式、图片属性、任务列表、Mermaid 占位和链接安全处理
- 生成经过 sanitizer 过滤的预览 HTML

**Does not own：**
- 不拥有主编辑器 Markdown 解析（在 markdown.ts 中）

**Called by:** `src/quicklook/preview-entry.ts`

**Depends on:** `katex`, `markdown-it`, `src/lib/editor-core/callout/calloutParser.ts`, `src/lib/editor-core/link.ts`

**Change this when：**
- 修改 Quick Look 预览渲染规则
- 新增 Quick Look 支持的 Markdown 扩展

**Do not change this when：**
- 修改主编辑器行为

**Related tests:** `src/quicklook/preview.test.ts`

**Confidence:** high

---

### `src-tauri/src/lib.rs`

**Kind:** entry

**Owns：**
- Tauri 后端装配：初始化日志、插件、配置管理器、窗口、菜单、托盘
- 渲染模式检测（启动前从 config.json 读取 software render 设置）
- 外部打开路由
- 关闭拦截（`WindowEvent::CloseRequested`）
- IPC command 注册

**Does not own：**
- 不拥有具体业务模块实现（委派给 config/、file_system/、window/ 等子模块）

**Called by:** `src-tauri/src/main.rs`

**Depends on:** `src-tauri/src/config/`, `src-tauri/src/file_system/`, `src-tauri/src/window/`, `src-tauri/src/software_update.rs`, `src-tauri/src/external_link.rs`, `src-tauri/src/app_logger.rs`, `src-tauri/src/i18n.rs`, `src-tauri/src/export.rs`

**Change this when：**
- 新增 IPC 命令
- 新增插件
- 修改窗口事件处理（如 `CloseRequested` 关闭确认逻辑）
- 修改启动流程

**Do not change this when：**
- 修改具体业务逻辑（在子模块中）

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/models.rs`

**Kind:** model

**Owns：**
- 跨端序列化数据结构：DocumentPayload、RecentEntry、SnapshotRecord、SettingRecord、WindowStateInput、FileTreeEntry、ImageAssetPayload、DesktopActionPayload 等
- 窗口事件通信 payload（如 `WindowLabelPayload`）

**Does not own：**
- 不拥有具体业务逻辑

**Called by:** 前后端各模块

**Depends on:** `serde`

**Change this when：**
- 新增/修改 IPC 参数或返回值结构
- 新增前后端通信数据结构

**Do not change this when：**
- 修改业务逻辑

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/config/mod.rs`

**Kind:** service / data store

**Owns：**
- 应用配置 JSON 持久化：`config.json` 的读取、写入、备份
- `ConfigManager`：线程安全的配置管理器（`Arc<RwLock<AppConfig>>`）
- `AppConfig` 结构定义：app（设置）、editor（编辑器设置）、window（窗口状态）、recent（最近打开）、workspace（工作区标签）、snapshots（文档快照）
- 设置键值存储：为前端偏好设置提供后端读写
- 设置路由：按 key 前缀将设置分发到对应 section（`windowState:`、`workspaceTabs:`、`pendingFolder:` 等）
- 启动前设置读取：在 `AppHandle` 可用前从磁盘读取配置（渲染模式、开发者模式）

**Does not own：**
- 不拥有具体 IPC 命令实现（在 `config/commands.rs` 中）
- 不拥有前端设置模型与归一化（在 `settings.ts` 中）

**Called by:** `src-tauri/src/lib.rs`（setup 中初始化）, `src-tauri/src/config/commands.rs`, 启动流程

**Depends on:** `src-tauri/src/models.rs`, `src-tauri/src/app_logger.rs`, Tauri path API

**Change this when：**
- 新增/修改 AppConfig section 或字段
- 新增启动前需要读取的设置项
- 修改配置备份/恢复逻辑
- 修改设置路由规则

**Do not change this when：**
- 修改前端设置 UI
- 修改具体业务逻辑

**Related tests:** `src-tauri/src/config/mod.rs` 模块内测试

**Confidence:** high

---

### `src-tauri/src/file_system.rs`

**Kind:** service

**Owns：**
- 后端文件系统：读写 Markdown、创建/重命名/删除文件夹和文件
- 扫描目录树、后台索引
- 路径存在性检查
- 示例文档安装
- Markdown-like 文件过滤、忽略规则、`.gitignore`、目录优先排序

**Does not own：**
- 不拥有图片资源处理（在 file_system/image_assets.rs 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）, 前端 `documentFiles.ts`

**Depends on:** `src-tauri/src/models.rs`

**Change this when：**
- 修改文件读写逻辑
- 修改目录扫描规则
- 修改文件过滤/忽略规则

**Do not change this when：**
- 修改前端文件操作封装

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/file_system/image_assets.rs`

**Kind:** service

**Owns：**
- 导入/解析/删除本地图片
- PicGo-Core 上传
- PicGo Server 上传和连接测试
- 路径策略、文件名清洗、SHA-256 去重、临时文件处理

**Does not own：**
- 不拥有前端图片插入流程（在 imageInsertion.ts 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）

**Depends on:** `src-tauri/src/models.rs`

**Change this when：**
- 修改图片导入策略
- 修改 PicGo 上传逻辑
- 修改路径策略

**Do not change this when：**
- 修改前端图片展示 UI

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/software_update.rs`

**Kind:** service

**Owns：**
- 检查 GitHub Release
- 选择 Windows 安装包
- 下载、校验 MD5、启动安装器
- 仅 Windows 安装版支持应用内更新

**Does not own：**
- 不拥有前端更新 UI（在 tauriUpdater.ts 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）

**Depends on:** `reqwest`, `semver`, `sha2`, `md5`

**Change this when：**
- 修改更新检查逻辑
- 修改下载/安装流程
- 修改校验逻辑

**Do not change this when：**
- 修改前端更新界面

**Related tests:** `src/lib/desktop/tauriUpdater.test.ts`

**Confidence:** high

---

### `src-tauri/src/window/menu.rs`

**Kind:** service

**Owns：**
- 构建应用原生菜单
- 绑定快捷键
- 处理菜单事件（普通命令 emit 为 `nomo://menu-command`）

**Does not own：**
- 不拥有菜单命令前端处理（在 appCommands.ts 中）
- 不拥有后端特殊处理（quit、open-settings 在 lib.rs / commands.rs 中）

**Called by:** `src-tauri/src/lib.rs`, `src-tauri/src/window/commands.rs`

**Depends on:** `src-tauri/src/i18n.rs`, Tauri menu API

**Change this when：**
- 添加/修改菜单项
- 修改快捷键绑定
- 修改菜单事件处理

**Do not change this when：**
- 修改前端命令处理逻辑

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/window/tray.rs`

**Kind:** service

**Owns：**
- 安装系统托盘
- 刷新托盘菜单
- 切换图标
- 处理托盘点击
- 关闭到托盘行为

**Does not own：**
- 不拥有窗口关闭逻辑（在 lib.rs 的 WindowEvent::CloseRequested 中）

**Called by:** `src-tauri/src/lib.rs`, `src-tauri/src/window/commands.rs`

**Depends on:** `src-tauri/src/config/commands.rs`, `src-tauri/src/i18n.rs`

**Change this when：**
- 修改托盘菜单项
- 修改托盘图标切换逻辑
- 修改关闭到托盘行为

**Do not change this when：**
- 修改窗口关闭确认流程

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/window/external_open.rs`

**Kind:** service

**Owns：**
- 解析启动参数、单实例参数
- macOS open 事件中的文件/文件夹解析
- 把待打开路径写入 pending 设置并 emit `nomo://open-document` / `nomo://open-folder`

**Does not own：**
- 不拥有前端打开处理（在 App.svelte 中）

**Called by:** `src-tauri/src/lib.rs`（单实例插件、setup、RunEvent）

**Depends on:** `src-tauri/src/config/commands.rs`, Tauri 事件系统

**Change this when：**
- 修改启动参数解析逻辑
- 修改外部打开事件路由

**Do not change this when：**
- 修改前端文件打开流程

**Related tests:** —

**Confidence:** high

---

### `src/app/services/tabs.ts`

**Kind:** utility

**Owns:**
- 标签页纯函数操作：创建空白标签、判断可复用标签、获取目标标签
- `ActiveTabState` 定义与写入
- 标签 ID 生成

**Does not own:**
- 不拥有标签页 UI 展示（在 DocumentTabs.svelte 中）
- 不拥有标签页业务协调（在 documentActionsController.ts 中）

**Called by:** `src/app/services/documentActionsController.ts`, `src/app/App.svelte`

**Depends on:** `src/app/types.ts`, `src/app/i18n.ts`

**Change this when:**
- 修改标签页创建/复用策略
- 修改标签状态数据结构

**Do not change this when:**
- 修改标签页 UI 样式

**Related tests:** —

**Confidence:** high

---

### `src/app/services/confirmAction.ts`

**Kind:** service

**Owns:**
- 确认对话框 Promise 式状态管理
- 二按钮模式（确认/取消）和三按钮模式（保存/放弃/取消）
- `confirmDialogStore` Svelte store

**Does not own:**
- 不拥有确认对话框 UI（在 ConfirmDialog.svelte 中）

**Called by:** `src/app/App.svelte`, `src/app/services/documentActionsController.ts`

**Depends on:** `svelte/store`

**Change this when:**
- 修改确认对话框交互模式
- 添加新的确认对话框类型

**Do not change this when:**
- 修改对话框 UI 样式

**Related tests:** —

**Confidence:** high

---

### `src/app/services/recoveryDraft.ts`

**Kind:** utility

**Owns:**
- 恢复草稿数据结构定义
- 写入 localStorage 的恢复草稿

**Does not own:**
- 不拥有草稿恢复触发逻辑（在 documentActionsController.ts 中）

**Called by:** `src/app/services/documentActionsController.ts`

**Depends on:** —

**Change this when:**
- 修改恢复草稿数据结构
- 修改草稿存储方式

**Related tests:** —

**Confidence:** high

---

### `src/app/services/outlineState.ts`

**Kind:** utility

**Owns:**
- 大纲展开/折叠状态计算纯函数
- 大纲项可见性判断
- 按行号查找当前大纲项
- 折叠 ID 集合裁剪

**Does not own:**
- 不拥有大纲数据提取（在 outlineService.ts 中）
- 不拥有大纲 UI（在 EditorWorkspace.svelte 中）

**Called by:** `src/app/services/outlineInteractionController.ts`, `src/app/components/EditorWorkspace.svelte`

**Depends on:** `src/lib/outline/outlineService.ts`

**Change this when:**
- 修改大纲展开/折叠逻辑
- 修改可见性计算算法

**Related tests:** `src/app/services/outlineState.test.ts`

**Confidence:** high

---

### `src/app/services/imageInsertion.ts`

**Kind:** controller

**Owns:**
- 图片粘贴/拖放导入流程协调
- 图片策略判断（本地复制 vs 图床上传）
- 源码模式 Markdown 图片语法插入
- 图片属性文本生成（width/align）

**Does not own:**
- 不拥有图片文件过滤（在 imageMarkdown.ts 中）
- 不拥有图片后端导入（在 desktopImageLoader.ts 中）
- 不拥有编辑器 insertImage 命令（在 editorCommands.ts 中）

**Called by:** `src/app/App.svelte`

**Depends on:** `src/app/services/imageMarkdown.ts`, `src/lib/editor-core/renderers.ts`, `src/lib/services/render.ts`, `src/lib/services/logger.ts`

**Change this when:**
- 修改图片导入流程
- 修改图片策略选择逻辑
- 修改源码模式图片插入行为

**Do not change this when:**
- 修改图片后端处理
- 修改图片 NodeView 展示

**Related tests:** —

**Confidence:** high

---

### `src/app/services/imageMarkdown.ts`

**Kind:** utility

**Owns:**
- 从 FileList 过滤图片文件
- 生成图片相对路径（`./assets/` 下）
- 生成 Markdown 图片语法 `![alt](src)`

**Does not own:**
- 不拥有图片导入流程（在 imageInsertion.ts 中）

**Called by:** `src/app/services/imageInsertion.ts`

**Depends on:** —

**Change this when:**
- 修改图片路径生成策略
- 修改图片 Markdown 语法格式

**Related tests:** `src/app/services/imageMarkdown.test.ts`

**Confidence:** high

---

### `src/app/services/platform.ts`

**Kind:** utility

**Owns:**
- 平台检测（macOS / Windows / Linux）
- `PlatformCapabilities` 计算：窗口 chrome 模式、原生窗口控件判断

**Does not own:**
- 不拥有具体窗口操作（在 desktopWindow.ts 中）

**Called by:** `src/app/services/desktopWindow.ts`, `src/app/components/AppTitleBar.svelte`, `src/app/components/AppShell.svelte`

**Depends on:** —

**Change this when:**
- 新增平台支持
- 修改窗口 chrome 模式判断

**Related tests:** `src/app/services/platform.test.ts`

**Confidence:** high

---

### `src/app/services/firstRunSample.ts`

**Kind:** utility

**Owns:**
- 首次运行样本文档状态判断
- `shouldOpenFirstRunSample` / `hasHandledFirstRunSample` 纯函数

**Does not own:**
- 不拥有样本文件复制（在 Rust 后端 file_system.rs 中）

**Called by:** `src/app/App.svelte`

**Depends on:** `src/lib/desktop/tauriStorage.ts`

**Change this when:**
- 修改首次运行判断条件
- 修改样本文档打开策略

**Related tests:** `src/app/services/firstRunSample.test.ts`

**Confidence:** high

---

### `src/app/services/appUiState.ts`

**Kind:** utility

**Owns:**
- 菜单展开/关闭切换纯函数
- 侧边栏 resize 事件处理工厂

**Does not own:**
- 不拥有侧边栏 UI（在 ExplorerSidebar.svelte 中）

**Called by:** `src/app/components/ExplorerSidebar.svelte`, `src/app/components/AppTitleBar.svelte`

**Depends on:** —

**Change this when:**
- 修改菜单切换逻辑
- 修改侧边栏 resize 策略

**Related tests:** —

**Confidence:** high

---

### `src/app/components/ContextMenu.svelte`

**Kind:** component

**Owns:**
- 通用上下文菜单 UI：定位、渲染菜单项、视口边界调整

**Does not own:**
- 不拥有菜单项定义（由 contextMenu.ts 插件的 onOpen 回调提供）

**Called by:** `src/app/components/AppShell.svelte`（通过 contextMenu 插件回调）

**Depends on:** `src/lib/editor-core/plugins/contextMenu.ts`

**Change this when:**
- 修改菜单样式或定位逻辑
- 修改菜单项渲染方式

**Do not change this when:**
- 修改菜单项数据来源

**Related tests:** —

**Confidence:** high

---

### `src/app/components/StatusBar.svelte`

**Kind:** component

**Owns:**
- 状态栏 UI：字数/行数/词数统计展示、缩放百分比控制

**Does not own:**
- 不拥有统计数据计算（在 outlineService.ts 中）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/lib/outline/outlineService.ts`, `src/app/actions/clickOutside.ts`, `src/app/actions/motion.ts`

**Change this when:**
- 修改状态栏展示指标
- 修改缩放控件交互

**Do not change this when:**
- 修改统计计算逻辑

**Related tests:** —

**Confidence:** high

---

### `src/app/components/FrontMatterCard.svelte`

**Kind:** component

**Owns:**
- Front matter YAML 元数据卡片 UI：展示/编辑/删除
- textarea 编辑态管理

**Does not own:**
- 不拥有 front matter 解析（在 frontMatter.ts 中）

**Called by:** `src/app/components/EditorWorkspace.svelte`

**Depends on:** `src/lib/markdown/frontMatter.ts`, `src/app/actions/clickOutside.ts`, `src/app/actions/motion.ts`

**Change this when:**
- 修改 front matter 卡片样式
- 修改编辑交互

**Do not change this when:**
- 修改 YAML 解析规则

**Related tests:** —

**Confidence:** high

---

### `src/app/components/EmptyWorkspace.svelte`

**Kind:** component

**Owns:**
- 空工作区占位 UI：新建文件、打开文件、打开文件夹引导按钮

**Does not own:**
- 不拥有文件操作逻辑（通过回调传入）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/i18n.ts`

**Change this when:**
- 修改空工作区引导文案或布局

**Related tests:** —

**Confidence:** high

---

### `src/app/components/FolderOpenDialog.svelte`

**Kind:** component

**Owns:**
- 打开文件夹窗口选择对话框：当前窗口 vs 新窗口、记住选择

**Does not own:**
- 不拥有文件夹打开逻辑（通过 dispatch 事件传给父组件）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/i18n.ts`

**Change this when:**
- 修改打开文件夹选择 UI

**Related tests:** —

**Confidence:** high

---

### `src/app/components/LinkQuickEditor.svelte`

**Kind:** component

**Owns:**
- 链接快速编辑器弹出层：文字/地址输入、确认/删除/关闭

**Does not own:**
- 不拥有链接编辑逻辑（通过 props 回调传入）
- 不拥有链接安全校验（在 link.ts 中）

**Called by:** `src/app/components/AppShell.svelte`（通过 linkInteraction 插件回调）

**Depends on:** `src/app/actions/clickOutside.ts`, `src/app/actions/motion.ts`

**Change this when:**
- 修改链接编辑器 UI 或交互

**Related tests:** —

**Confidence:** high

---

### `src/app/components/ConfirmDialog.svelte`

**Kind:** component

**Owns:**
- 通用确认对话框 UI：二按钮（确认/取消）和三按钮（保存/放弃/取消）模式

**Does not own:**
- 不拥有对话框状态管理（在 confirmAction.ts 中）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/services/confirmAction.ts`, `src/app/actions/motion.ts`

**Change this when:**
- 修改确认对话框布局或按钮样式

**Related tests:** —

**Confidence:** high

---

### `src/app/components/UnsavedConfirmDialog.svelte`

**Kind:** component

**Owns:**
- 未保存文档确认对话框 UI：丢弃/取消按钮

**Does not own:**
- 不拥有确认逻辑（通过 props 回调传入）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/i18n.ts`, `src/app/actions/motion.ts`

**Change this when:**
- 修改未保存确认 UI

**Related tests:** —

**Confidence:** high

---

### `src/app/components/ExternalChangeDialog.svelte`

**Kind:** component

**Owns:**
- 外部文件变更提示对话框 UI：重载/覆盖/忽略

**Does not own:**
- 不拥有外部变更处理逻辑（在 documentActionsController.ts 中）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/types.ts`, `src/app/i18n.ts`, `src/app/actions/motion.ts`

**Change this when:**
- 修改外部变更提示 UI

**Related tests:** —

**Confidence:** high

---

### `src/app/components/CloseWindowBehaviorDialog.svelte`

**Kind:** component

**Owns:**
- 关闭窗口行为选择对话框 UI：关闭窗口 vs 关闭到托盘、记住选择

**Does not own:**
- 不拥有关闭行为执行（通过 dispatch 事件传给父组件）

**Called by:** `src/app/components/AppShell.svelte`

**Depends on:** `src/app/actions/motion.ts`

**Change this when:**
- 修改关闭行为选择 UI

**Related tests:** —

**Confidence:** high

---

### `src/app/actions/clickOutside.ts`

**Kind:** utility (Svelte action)

**Owns:**
- Svelte `use:clickOutside` action：检测点击元素外部并触发回调

**Does not own:**
- 不拥有具体关闭逻辑（由使用方定义回调）

**Called by:** `ContextMenu.svelte`, `FrontMatterCard.svelte`, `StatusBar.svelte`, `LinkQuickEditor.svelte`

**Depends on:** —

**Change this when:**
- 修改外部点击检测策略

**Related tests:** —

**Confidence:** high

---

### `src/app/actions/motion.ts`

**Kind:** utility (Svelte action)

**Owns:**
- Svelte 过渡动画工具：`motionIn`、`transitionDuration`、`pulseOnChange`
- 统一的 fade/slide 动画配置

**Does not own:**
- 不拥有具体组件的动画触发逻辑

**Called by:** 多个对话框和弹出层组件

**Depends on:** `svelte/transition`

**Change this when:**
- 修改全局动画时长或效果

**Related tests:** `src/app/actions/motion.test.ts`

**Confidence:** high

---

### `src/lib/editor-core/types.ts`

**Kind:** model

**Owns:**
- 编辑器核心类型定义：`EditorMode`、`EditorCommand`（union type）、`SetMarkdownOptions`、`EditorSelectionSnapshot`、`EditorLinkSnapshot`、`InlinePendingMarks` 等
- `EditorThemeOptions`、`EditorRuntimeOptions`

**Does not own:**
- 不拥有具体命令实现（在 editorCommands.ts 中）

**Called by:** 所有使用 EditorCore 的前端模块

**Depends on:** `src/lib/editor-core/diagramTemplates.ts`, `src/lib/services/render.ts`, `src/lib/editor-core/plugins/contextMenu.ts`

**Change this when:**
- 新增/修改 EditorCommand 类型
- 修改编辑器选项接口

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/diagramTemplates.ts`

**Kind:** model

**Owns:**
- Mermaid 图表模板定义：flowchart、sequenceDiagram、classDiagram、stateDiagram、pie、gantt、erDiagram
- `DiagramType` 类型

**Does not own:**
- 不拥有图表渲染（在 mermaidDiagramRenderer.ts 中）
- 不拥有图表插入命令（在 editorCommands.ts 中）

**Called by:** `src/app/components/EditorToolbar.svelte`, `src/lib/editor-core/types.ts`

**Depends on:** —

**Change this when:**
- 新增图表类型模板
- 修改现有模板代码

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/link.ts`

**Kind:** utility

**Owns:**
- 超链接安全校验与规范化：拒绝 `javascript:` 等脚本协议，允许 `https?`/`mailto`/相对路径
- 链接属性创建与序列化

**Does not own:**
- 不拥有链接交互 UI（在 linkInteraction.ts 和 LinkQuickEditor.svelte 中）

**Called by:** `src/lib/editor-core/plugins/linkInteraction.ts`, `src/lib/editor-core/markdown.ts`, `src/quicklook/preview.ts`

**Depends on:** —

**Change this when:**
- 修改链接协议白名单
- 修改链接序列化规则

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/html/htmlPolicy.ts`

**Kind:** model

**Owns:**
- HTML 安全白名单：可编辑块级标签（section/div）、内联标签、允许属性
- 危险标签集合（script/iframe/form 等）
- 内联标签到 ProseMirror mark 的映射表

**Does not own:**
- 不拥有 HTML 分类逻辑（在 htmlClassifier.ts 中）

**Called by:** `src/lib/editor-core/html/htmlClassifier.ts`, `src/lib/editor-core/html/htmlToPmLogic.ts`

**Depends on:** —

**Change this when:**
- 新增可编辑 HTML 标签
- 修改安全白名单

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/html/htmlClassifier.ts`

**Kind:** utility

**Owns:**
- HTML 块分类：判断 rawHtml 是否可编辑
- 标签名提取、危险属性检测、允许属性提取
- 行内 HTML 标签属性提取

**Does not own:**
- 不拥有白名单定义（在 htmlPolicy.ts 中）

**Called by:** `src/lib/editor-core/markdown.ts`

**Depends on:** `src/lib/editor-core/html/htmlPolicy.ts`

**Change this when:**
- 修改 HTML 块可编辑性判断规则
- 修改属性提取逻辑

**Related tests:** `src/lib/editor-core/html/__tests__/htmlClassifier.test.ts`

**Confidence:** high

---

### `src/lib/editor-core/utils/html.ts`

**Kind:** utility

**Owns:**
- `escapeHtml`：HTML 特殊字符转义
- `sanitizeHtml`：简单 HTML 安全过滤（检测 script/iframe/on* 事件）

**Does not own:**
- 不拥有 HTML 块分类（在 htmlClassifier.ts 中）

**Called by:** `src/quicklook/preview.ts`, 渲染相关模块

**Depends on:** —

**Change this when:**
- 修改 HTML 转义/过滤规则

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/plugins/trailingParagraph.ts`

**Kind:** plugin

**Owns:**
- 尾部段落补全插件：顶层非段落块插入后自动追加空段落
- 插入范围追踪与映射

**Does not own:**
- 不拥有具体块插入逻辑

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（插件注册）

**Depends on:** `src/lib/editor-core/schema.ts`

**Change this when:**
- 修改尾部段落补全策略
- 修改插入范围检测逻辑

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/plugins/contextMenu.ts`

**Kind:** plugin

**Owns:**
- 编辑器上下文菜单 ProseMirror 插件
- DOM 菜单工厂挂载/查找机制
- `ContextMenuItem`、`ContextMenuOpenEvent`、`ContextMenuCapable` 类型定义

**Does not own:**
- 不拥有菜单 UI 渲染（在 ContextMenu.svelte 中）
- 不拥有具体菜单项生成（由各 NodeView 的 getContextMenuItems 提供）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（插件注册）

**Depends on:** —

**Change this when:**
- 修改右键菜单事件处理
- 修改菜单工厂挂载机制

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/plugins/codeHighlightDecorationPlugin.ts`

**Kind:** plugin

**Owns:**
- 行内代码语法高亮 Decoration 插件
- 轻量 token 分类器（关键字/布尔值/数字/字符串/运算符）
- 全量扫描策略，每次 state 变化重新计算

**Does not own:**
- 不拥有代码块高亮（在 codeHighlight.ts 和 shikiCodeTokenizer.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（插件注册）

**Depends on:** —

**Change this when:**
- 修改行内代码高亮规则
- 修改 token 分类逻辑

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/nodeViews/activeEditRegistry.ts`

**Kind:** utility

**Owns:**
- 跨 NodeView 编辑态协调注册表
- 确保同一时刻只有一个 NodeView 处于编辑态

**Does not own:**
- 不拥有具体 NodeView 的编辑态实现

**Called by:** `src/lib/editor-core/nodeViews/CommentBlockNodeView.ts`, `src/lib/editor-core/nodeViews/CommentInlineNodeView.ts`

**Depends on:** —

**Change this when:**
- 修改编辑态互斥策略

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/nodeViews/CommentBlockNodeView.ts`

**Kind:** nodeView

**Owns:**
- 块级 Markdown 注释 NodeView：卡片展示、点击编辑、textarea 编辑态

**Does not own:**
- 不拥有注释解析（在 markdown.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（NodeView 注册）

**Depends on:** `src/lib/editor-core/nodeViews/activeEditRegistry.ts`, `src/app/i18n.ts`

**Change this when:**
- 修改注释块展示/编辑行为

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/nodeViews/CommentInlineNodeView.ts`

**Kind:** nodeView

**Owns:**
- 行内 Markdown 注释 NodeView：灰色标签展示、原位 input 编辑

**Does not own:**
- 不拥有注释解析（在 markdown.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（NodeView 注册）

**Depends on:** `src/lib/editor-core/nodeViews/activeEditRegistry.ts`, `src/app/i18n.ts`

**Change this when:**
- 修改行内注释展示/编辑行为

**Related tests:** `src/lib/editor-core/nodeViews/CommentInlineNodeView.test.ts`

**Confidence:** high

---

### `src/lib/editor-core/nodeViews/FootnoteDefNodeView.ts`

**Kind:** nodeView

**Owns:**
- 底部脚注定义 NodeView：定义标记、返回正文入口、内容区原生编辑

**Does not own:**
- 不拥有脚注解析（在 markdown.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（NodeView 注册）

**Depends on:** `src/app/i18n.ts`

**Change this when:**
- 修改脚注定义展示/交互

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/nodeViews/FootnoteRefNodeView.ts`

**Kind:** nodeView

**Owns:**
- 正文脚注引用 NodeView：跳转到底部定义、hover/focus 只读预览卡片

**Does not own:**
- 不拥有脚注解析（在 markdown.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（NodeView 注册）

**Depends on:** `src/app/i18n.ts`

**Change this when:**
- 修改脚注引用展示/预览行为

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/nodeViews/HorizontalRuleNodeView.ts`

**Kind:** nodeView

**Owns:**
- 水平分割线 NodeView：渲染 `<hr>`、点击选中（NodeSelection）

**Does not own:**
- 不拥有分割线解析（在 markdown.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（NodeView 注册）

**Depends on:** —

**Change this when:**
- 修改分割线渲染或选中行为

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/callout/calloutTypes.ts`

**Kind:** model

**Owns:**
- Callout 类型定义：5 种固定类型（note/tip/important/warning/caution）
- 类型配置表（图标、默认标题、颜色后缀）
- 多语言标签映射（zh-CN/zh-TW/en-US）

**Does not own:**
- 不拥有 Callout 解析/序列化（在 calloutParser.ts/calloutSerializer.ts 中）

**Called by:** `src/lib/editor-core/callout/calloutSchema.ts`, `src/lib/editor-core/nodeViews/CalloutNodeView.ts`

**Depends on:** —

**Change this when:**
- 新增 Callout 类型
- 修改类型配置或标签

**Related tests:** —

**Confidence:** high

---

### `src/lib/editor-core/callout/calloutPlugin.ts`

**Kind:** plugin

**Owns:**
- Callout ProseMirror 插件（当前仅保留插件位，键盘行为由 calloutCommands 处理）

**Does not own:**
- 不拥有 Callout 命令（在 calloutCommands.ts 中）

**Called by:** `src/lib/editor-core/ProseMirrorEditorCore.ts`（插件注册）

**Depends on:** —

**Change this when:**
- 需要为 Callout 添加插件级别的键盘/事务行为

**Related tests:** —

**Confidence:** high

---

### `src/lib/services/storage.ts`

**Kind:** model

**Owns:**
- 文件存储接口定义：`FileStorage`（open/save/saveAs）、`DocumentRepository`（rememberRecentFile/listRecentFiles/createSnapshot）
- `OpenDocumentResult`、`SaveDocumentInput`、`DocumentSnapshotRecord` 类型

**Does not own:**
- 不拥有具体实现（在 tauriStorage.ts 和 Rust 后端中）

**Called by:** `src/lib/desktop/tauriStorage.ts`

**Depends on:** —

**Change this when:**
- 修改存储接口契约

**Related tests:** —

**Confidence:** high

---

### `src/lib/services/render.ts`

**Kind:** model

**Owns:**
- 渲染服务类型接口：`ImageLoader`、`CodeTokenizer`、`MathRenderer`、`DiagramRenderer`
- 图片处理设置类型：`ImageHandlingSettings`、`ImageInsertStrategy`、`ImageUploadProvider`
- `ImageContext`、`ImageResolveResult`、`ImageImportResult` 等

**Does not own:**
- 不拥有具体渲染实现（在 shikiCodeTokenizer.ts、katexMathRenderer.ts、mermaidDiagramRenderer.ts 中）

**Called by:** `src/lib/services/shikiCodeTokenizer.ts`, `src/lib/services/katexMathRenderer.ts`, `src/lib/services/mermaidDiagramRenderer.ts`, `src/app/services/desktopImageLoader.ts`

**Depends on:** —

**Change this when:**
- 新增渲染服务类型
- 修改图片处理设置结构

**Related tests:** —

**Confidence:** high

---

### `src/lib/services/logger.ts`

**Kind:** service

**Owns:**
- 前端全局日志工具：debug/info/warn/error 级别
- DevTools 输出和 Tauri 原生日志转发
- 日志缓冲区（最大 500 条）
- 性能计时器（`createPerfTimer`、`perf`、`perfAsync`）
- `window.NomoLogger` 控制台控制接口

**Does not own:**
- 不拥有后端日志落盘（在 app_logger.rs 中）

**Called by:** 前端各模块（通过 `logInfo`/`logError` 等）

**Depends on:** `@tauri-apps/api/core`（可选）

**Change this when:**
- 修改日志输出策略
- 修改性能计时逻辑

**Related tests:** —

**Confidence:** high

---

### `src/lib/markdown/MarkdownBridge.ts`

**Kind:** service

**Owns:**
- Markdown 桥接：将 Markdown 文本拆分为 front matter + 正文，以及反向合并
- `MarkdownDocument` 接口

**Does not own:**
- 不拥有 front matter 解析细节（在 frontMatter.ts 中）
- 不拥有 ProseMirror 文档转换（在 markdown.ts 中）

**Called by:** 编辑器/文档流程

**Depends on:** `src/lib/markdown/frontMatter.ts`

**Change this when:**
- 修改 front matter 与正文的分离/合并策略

**Related tests:** `src/lib/markdown/MarkdownBridge.test.ts`

**Confidence:** high

---

### `src-tauri/src/export.rs`

**Kind:** service

**Owns:**
- HTML 导出 IPC：写入 HTML 文件
- Base64 文件读取
- 临时 HTML 文件写入/清理（供 PDF 导出使用）

**Does not own:**
- 不拥有 PDF 生成（在 export_windows.rs 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）, `src-tauri/src/export_windows.rs`

**Depends on:** `src-tauri/src/models.rs`, `src-tauri/src/app_logger.rs`

**Change this when:**
- 修改 HTML 导出逻辑
- 修改临时文件策略

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/export_windows.rs`

**Kind:** service

**Owns:**
- Windows PDF 导出：通过 Edge headless `--print-to-pdf` 生成 PDF
- Edge 可执行文件查找

**Does not own:**
- 不拥有 HTML 临时文件写入（在 export.rs 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）

**Depends on:** `src-tauri/src/export.rs`, `src-tauri/src/models.rs`

**Change this when:**
- 修改 PDF 生成方式
- 修改 Edge 查找路径

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/app_logger.rs`

**Kind:** service

**Owns:**
- 后端日志系统：文件落盘（`./logs/`）、5MB 轮转、终端输出
- 日志开关 IPC（`set_logger_enabled`、`get_logger_enabled`、`log_message`）
- 前端日志转发接收

**Does not own:**
- 不拥有前端日志生成（在 logger.ts 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）, 后端各模块（通过 `info`/`debug`/`error` 等）

**Depends on:** `chrono`, `src-tauri/src/config/mod.rs`

**Change this when:**
- 修改日志文件策略
- 修改日志轮转规则

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/config/commands.rs`

**Kind:** service

**Owns:**
- 数据操作 IPC 命令（原 database 层迁移至此）：
  - 最近打开：`remember_recent_entry`、`list_recent_entries`、`clear_recent_entries`
  - 文档快照：`create_document_snapshot`、`list_document_snapshots`
  - 应用设置：`update_app_setting`、`update_app_settings`、`list_app_settings`
- 内部工具：`query_recent_entries`、`get_setting_value`、设置路由到 AppConfig section

**Does not own:**
- 不拥有配置存储/结构定义（在 config/mod.rs 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）

**Depends on:** `src-tauri/src/config/mod.rs`, `src-tauri/src/models.rs`, `src-tauri/src/file_system.rs`

**Change this when:**
- 新增数据操作 IPC 命令
- 修改最近打开/快照/设置的查询逻辑

**Related tests:** `src-tauri/src/config/commands.rs` 模块内测试

**Confidence:** high

---

### `src-tauri/src/window/commands.rs`

**Kind:** service

**Owns:**
- 窗口相关 IPC 命令：`update_window_state`、`open_settings_window`、`install_window_menu`、`force_close_window`

**Does not own:**
- 不拥有窗口状态持久化逻辑（在 window/state.rs 中）
- 不拥有菜单构建（在 window/menu.rs 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）

**Depends on:** `src-tauri/src/window/menu.rs`, `src-tauri/src/window/tray.rs`, `src-tauri/src/config/commands.rs`

**Change this when:**
- 新增窗口相关 IPC 命令

**Related tests:** —

**Confidence:** high

---

### `src-tauri/src/window/mod.rs`

**Kind:** entry

**Owns:**
- 窗口子模块声明：commands、external_open、file_association、menu、os、state、tray

**Does not own:**
- 不拥有具体业务逻辑

**Called by:** `src-tauri/src/lib.rs`

**Depends on:** —

**Change this when:**
- 新增窗口子模块

**Related tests:** —

**Confidence:** high

---

### `src/app/services/desktopWindow.ts`

**Kind:** service

**Owns:**
- 桌面窗口操作：最小化、最大化、关闭
- 新窗口创建时的 chrome 选项（macOS overlay / Windows custom）

**Does not own:**
- 不拥有窗口状态持久化（在 Rust window/state.rs 中）
- 不拥有关闭到托盘逻辑（在 Rust window/tray.rs 中）

**Called by:** `src/app/App.svelte`, `src/app/components/AppShell.svelte`

**Depends on:** `@tauri-apps/api/window`, `@tauri-apps/api/dpi`, `src/app/services/platform.ts`

**Change this when:**
- 修改窗口操作行为
- 修改新窗口 chrome 选项

**Related tests:** —

**Confidence:** high

---

### `src/app/services/editorSettingsController.ts`

**Kind:** controller

**Owns:**
- 编辑器设置应用控制器：将主题、字体、行高、内容宽度、块样式同步到 EditorCore
- 加载/持久化编辑器设置

**Does not own:**
- 不拥有设置模型定义（在 settings.ts 中）
- 不拥有 EditorCore 内部实现

**Called by:** `src/app/App.svelte`

**Depends on:** `src/app/services/settings.ts`, `src/lib/editor-core/types.ts`

**Change this when:**
- 修改编辑器设置同步逻辑
- 新增编辑器设置项

**Related tests:** —

**Confidence:** high

---

### `src/app/services/desktopImageLoader.ts`

**Kind:** service

**Owns:**
- 桌面图片加载器实现：resolve/import/remove
- 通过 Tauri IPC 调用后端图片资源处理

**Does not own:**
- 不拥有图片后端处理逻辑（在 Rust file_system/image_assets.rs 中）
- 不拥有图片 NodeView 展示（在 ImageNodeView.ts 中）

**Called by:** `src/app/App.svelte`（注册到 renderers.ts）

**Depends on:** `src/lib/desktop/tauriStorage.ts`, `src/lib/services/render.ts`

**Change this when:**
- 修改图片 resolve/import/remove 前端调用
- 修改图片 context 构建逻辑

**Related tests:** —

**Confidence:** high

---

### `src/app/services/outlineInteractionController.ts`

**Kind:** controller

**Owns:**
- 大纲交互控制：点击大纲项触发滚动定位

**Does not own:**
- 不拥有大纲数据计算（在 outlineService.ts 中）
- 不拥有滚动定位实现（在 outlineNavigation.ts 中）

**Called by:** `src/app/App.svelte`

**Depends on:** `src/app/services/outlineNavigation.ts`, `src/app/services/outlineState.ts`

**Change this when:**
- 修改大纲点击交互行为

**Related tests:** —

**Confidence:** high

---

### `src/app/services/outlineNavigation.ts`

**Kind:** service

**Owns:**
- 大纲滚动定位：按大纲锚点恢复编辑区视觉焦点
- 源码与语义视图滚动同步

**Does not own:**
- 不拥有大纲数据计算（在 outlineService.ts 中）

**Called by:** `src/app/services/outlineInteractionController.ts`, `src/app/services/editorInteractionController.ts`

**Depends on:** `src/lib/editor-core/types.ts`

**Change this when:**
- 修改滚动定位算法
- 修改模式切换时的滚动同步

**Related tests:** `src/app/services/outlineNavigation.test.ts`

**Confidence:** high

---

## 文件与目录速查

| 目录 | 用途 |
|---|---|
| `src/app/` | 前端 UI 层：应用壳、组件、控制器、服务、样式 |
| `src/app/components/` | Svelte UI 组件 |
| `src/app/services/` | 前端业务逻辑控制器和服务 |
| `src/app/actions/` | Svelte actions（clickOutside、motion） |
| `src/app/styles/` | CSS 样式文件（主题、布局、编辑器、表格等） |
| `src/lib/editor-core/` | ProseMirror 编辑器核心 |
| `src/lib/editor-core/callout/` | Callout 提示块（schema、parser、serializer、命令、插件） |
| `src/lib/editor-core/html/` | HTML 块安全策略与转换 |
| `src/lib/editor-core/nodeViews/` | 各类 NodeView 实现 |
| `src/lib/editor-core/plugins/` | ProseMirror 插件 |
| `src/lib/markdown/` | Markdown 桥接、front matter、保存归一化 |
| `src/lib/outline/` | 大纲服务 |
| `src/lib/toc/` | TOC 服务 |
| `src/lib/services/` | 渲染服务接口与实现（Shiki、KaTeX、Mermaid） |
| `src/lib/desktop/` | Tauri IPC 适配（tauriStorage、tauriUpdater） |
| `src/quicklook/` | macOS Quick Look 预览 |
| `src/paraglide/` | Inlang/Paraglide 生成的本地化代码（**不要手改**） |
| `src-tauri/src/` | Rust 后端 |
| `src-tauri/src/config/` | JSON 配置管理（ConfigManager、commands）：设置、最近打开、快照、窗口状态 |
| `src-tauri/src/file_system/` | 文件系统与图片资源 |
| `src-tauri/src/window/` | 窗口、菜单、托盘、外部打开、文件关联 |
| `project.inlang/` | Inlang 本地化文案源文件（**修改这里而非 paraglide/**） |

---

## 置信度与漂移标记

- **high**: 基于代码扫描确认的职责划分。
- `src/app/App.svelte` 和 `src/app/components/SettingsWindow.svelte` 体积偏大，未来拆分后可能需要更新相关条目。
- `src/lib/editor-core/markdown.ts` 和 `editorCommands.ts` 体积极大，未来拆分为子模块后需要更新条目。
- `src-tauri/src/file_system.rs` 未来拆分后需要更新条目。
- `src-tauri/src/config/mod.rs` 承担了原 SQLite 数据库的全部职责（最近打开、快照、设置），未来若拆分需更新条目。
- `html/` 目录（`html/index.html`, `html/style.css`）作用不明确，未纳入本 map。
- `src/app/i18n.ts` 和 `src/app/i18n.ja.ts` 未单独建条目（已在 Feature Index 本地化节覆盖）。
