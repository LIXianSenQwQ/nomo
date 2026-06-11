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
| 窗口状态持久化 | `src-tauri/src/window/state.rs` | `src-tauri/src/lib.rs` | 窗口位置/尺寸/最大化状态恢复逻辑变更 |

### 编辑器核心（ProseMirror）

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 编辑器工厂与 API | `src/lib/editor-core/createEditorCore.ts` | `src/lib/editor-core/index.ts` | EditorCore 创建参数或对外接口变更 |
| ProseMirror 核心实现 | `src/lib/editor-core/ProseMirrorEditorCore.ts` | `src/lib/editor-core/markdown.ts`, `schema.ts`, plugins, nodeViews | EditorView 生命周期、事务、模式切换、命令执行 |
| Schema 定义 | `src/lib/editor-core/schema.ts` | `src/lib/editor-core/callout/calloutSchema.ts` | 新增/修改节点或 mark 类型 |
| Markdown 解析与序列化 | `src/lib/editor-core/markdown.ts` | `src/lib/editor-core/callout/calloutParser.ts`, `calloutSerializer.ts`, `html/` | Markdown 与 ProseMirror doc 互转规则变更 |
| 编辑器命令 | `src/lib/editor-core/editorCommands.ts` | `src/lib/editor-core/tableCommands.ts`, `codeBlockCommands.ts`, `callout/calloutCommands.ts` | 新增或修改编辑命令 |

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
| 其他 NodeView | `src/lib/editor-core/nodeViews/*NodeView.ts` | — | 脚注、注释、分割线、行内代码等 |

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

### 文件系统与文档操作

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 文档操作控制器 | `src/app/services/documentActionsController.ts` | `src/app/services/documentFiles.ts`, `tabs.ts`, `recoveryDraft.ts` | 打开/保存/另存/自动保存/外部变更 |
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
| 大纲状态 | `src/app/services/outlineState.ts` | — | 当前激活大纲项计算 |
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
| Rust 数据库设置 | `src-tauri/src/database/mod.rs` | `src-tauri/src/database/connection.rs` | SQLite 建表/迁移/设置读写 |

### 搜索与替换

| Responsibility | Primary code | Related code | Change when |
|---|---|---|---|
| 搜索替换逻辑 | `src/app/services/searchReplace.ts` | `src/app/components/SearchReplacePanel.svelte` | 搜索/替换算法和状态管理 |
| 搜索替换面板 | `src/app/components/SearchReplacePanel.svelte` | `src/app/services/searchReplace.ts` | 搜索替换 UI 交互 |

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
- 修改后端数据库表结构

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
- 不拥有后端数据库直接操作（通过 tauriStorage.ts）

**Called by:** `src/app/App.svelte`, `src/app/components/SettingsWindow.svelte`, `src/app/services/editorSettingsController.ts`

**Depends on:** `src/lib/desktop/tauriStorage.ts`

**Change this when：**
- 添加新的设置项
- 修改设置默认值
- 修改设置归一化逻辑
- 修改主题/布局应用逻辑

**Do not change this when：**
- 修改设置 UI 展示方式
- 修改后端数据库表结构

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
- 封装数据库、文件系统、图片资源、窗口设置等 Tauri `invoke` 调用
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
- Tauri 后端装配：初始化日志、插件、数据库、窗口、菜单、托盘
- 外部打开路由
- 关闭拦截
- IPC command 注册

**Does not own：**
- 不拥有具体业务模块实现（委派给 database/、file_system/、window/ 等子模块）

**Called by:** `src-tauri/src/main.rs`

**Depends on:** `src-tauri/src/database/`, `src-tauri/src/file_system/`, `src-tauri/src/window/`, `src-tauri/src/software_update.rs`, `src-tauri/src/external_link.rs`, `src-tauri/src/app_logger.rs`, `src-tauri/src/i18n.rs`

**Change this when：**
- 新增 IPC 命令
- 新增插件
- 修改窗口事件处理
- 修改启动流程

**Do not change this when：**
- 修改具体业务逻辑（在子模块中）

**Related tests:** —

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

### `src-tauri/src/database/mod.rs`

**Kind:** service

**Owns：**
- SQLite 数据库管理：最近打开、历史快照、应用设置
- 建表和迁移
- 核心表：`recent_entries`、`document_snapshots`、`app_settings`

**Does not own：**
- 不拥有数据库连接管理（在 connection.rs 中）

**Called by:** `src-tauri/src/lib.rs`（注册为 IPC）, 后端各模块

**Depends on:** `src-tauri/src/database/connection.rs`, `src-tauri/src/models.rs`

**Change this when：**
- 新增/修改数据库表结构
- 修改迁移逻辑
- 修改数据查询逻辑

**Do not change this when：**
- 修改前端设置模型

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

**Depends on:** `src-tauri/src/database/mod.rs`, `src-tauri/src/i18n.rs`

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

**Depends on:** `src-tauri/src/database/mod.rs`, Tauri 事件系统

**Change this when：**
- 修改启动参数解析逻辑
- 修改外部打开事件路由

**Do not change this when：**
- 修改前端文件打开流程

**Related tests:** —

**Confidence:** high

---

## 文件与目录速查

| 目录 | 用途 |
|---|---|
| `src/app/` | 前端 UI 层：应用壳、组件、控制器、服务、样式 |
| `src/app/components/` | Svelte UI 组件 |
| `src/app/services/` | 前端业务逻辑控制器和服务 |
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
| `src-tauri/src/database/` | SQLite 数据库 |
| `src-tauri/src/file_system/` | 文件系统与图片资源 |
| `src-tauri/src/window/` | 窗口、菜单、托盘、外部打开、文件关联 |
| `project.inlang/` | Inlang 本地化文案源文件（**修改这里而非 paraglide/**） |

---

## 置信度与漂移标记

- **high**: 基于 PROJECT_FILE_GUIDE.md 和实际代码扫描确认的职责划分。
- `src/app/App.svelte` 和 `src/app/components/SettingsWindow.svelte` 体积偏大，未来拆分后可能需要更新相关条目。
- `src/lib/editor-core/markdown.ts` 和 `editorCommands.ts` 体积极大，未来拆分为子模块后需要更新条目。
- `src-tauri/src/file_system.rs` 和 `database/mod.rs` 未来拆分后需要更新条目。
- `html/` 目录（`html/index.html`, `html/style.css`）作用不明确，未纳入本 map。
