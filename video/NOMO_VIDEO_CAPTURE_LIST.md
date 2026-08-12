# Nomo 视频页面与状态采集清单

> 状态：仅完成采集规划，尚未启动 Nomo、截图、录屏或制作 Remotion 视频。
>
> 目标：建立一套可以同时支撑约 50 秒完整版、30 秒精简版、封面和后续功能短片的真实 UI 素材库。

## 1. 采集原则

- 采集“页面 + 关键状态 + 必要操作序列”，不机械遍历每一个菜单项。
- 慢镜头保存完整操作关键帧；快闪镜头只保存清晰的最终效果。
- 同一功能的前后状态必须使用相同窗口尺寸、文档、滚动位置和缩放比例。
- 默认使用简体中文界面，不混入私人文件名、用户名、最近文件或真实路径。
- 优先采集当前 Windows 版本能够真实复现的功能；macOS 专属状态单独标记。
- 先完成截图和 Contact Sheet 复核，再录制慢操作、选择 BGM 或进入 Remotion。
- 采集时不修改系统默认应用、右键菜单、图床配置或远程服务，除非另行明确授权。

## 2. 优先级与素材类型

| 标记 | 含义 | 处理方式 |
| --- | --- | --- |
| P0 | 主片必须使用 | 缺失时阻塞正式制作 |
| P1 | 建议采集 | 可进入完整版或功能短片 |
| P2 | 归档参考 | 不保证进入第一版成片 |
| SLOW | 慢操作 | 采集连续关键帧或真实操作录屏 |
| FLASH | 快闪结果 | 只采集最终状态，按 BGM 鼓点切换 |
| REF | 页面参考 | 用于核对真实 UI 或后续补镜头 |

## 3. 输出目录与命名

计划中的素材目录：

```text
video/capture/
├─ reference/
├─ slow/
│  ├─ text-input/
│  ├─ table-edit/
│  ├─ code-formula-diagram/
│  ├─ outline-drag/
│  └─ search-replace/
├─ flash/
│  ├─ themes/
│  ├─ mini-window/
│  ├─ workspace/
│  ├─ markdown-features/
│  └─ export/
├─ settings/
├─ dialogs/
├─ context-menus/
├─ upgrade-env/
│  ├─ packages/
│  ├─ before/
│  ├─ download/
│  ├─ install/
│  └─ after/
├─ verify/
├─ capture-manifest.json
└─ contact-sheet.png
```

文件命名规则：

```text
<类型>-<分组>-<编号>-<状态>.<扩展名>

SLOW-TEXT-001-empty.png
SLOW-TEXT-002-heading-typed.png
FLASH-THEME-001-nomo-light.png
FLASH-MINI-003-pinned.png
REF-SETTINGS-004-appearance.png
```

## 4. 采集前准备

- [ ] P0 确认 Nomo 版本号和构建号，写入 `capture-manifest.json`。
- [ ] P0 确认当前系统、屏幕缩放、Nomo 窗口尺寸和应用缩放。
- [ ] P0 固定主窗口尺寸，建议内容区至少 1440×900。
- [ ] P0 关闭系统通知、聊天浮窗和其他可能泄露信息的窗口。
- [ ] P0 清理或遮挡最近文件、真实用户名、私人路径和个人头像。
- [ ] P0 创建专用演示文件夹，统一显示名称为 `Nomo Demo`。
- [ ] P0 创建统一演示文档，建议名称为 `产品发布说明.md`。
- [ ] P0 为演示文档准备标题、正文、表格、代码、公式、Mermaid、Callout、任务列表、脚注、图片和多级章节。
- [ ] P0 确认演示文档没有真实 API Key、邮箱、仓库 Token 或内部链接。
- [ ] P0 将界面语言固定为简体中文。
- [ ] P0 将正文缩放、字号、行高和内容宽度恢复到适合拍摄的统一值。
- [ ] P0 确认鼠标指针尺寸正常，不启用夸张的系统指针主题。
- [ ] P0 确认主题切换前后保持相同文档位置。
- [ ] P0 确认慢操作开始前文档可以安全恢复到相同初始状态。
- [ ] P1 准备第二、第三个演示文档，用于多标签和文件树镜头。
- [ ] P1 准备一张无版权争议的本地示例图片。
- [ ] P1 准备一个 TXT 和一个 JSON 文件，用于可选的分段编辑器镜头。
- [ ] P1 记录每个镜头需要的鼠标位置、起始状态和结束状态。
- [ ] P1 确认采集工具可以在窗口被遮挡时稳定截取 Nomo。
- [ ] P1 先拍一张测试图，检查文字清晰度、色彩和阴影。
- [ ] P0 升级流程必须使用 Windows Sandbox、虚拟机或其他可丢弃隔离环境，不直接降级当前主环境。

## 5. 演示文档内容准备

- [ ] P0 H1：`让 Markdown 回到写作本身`。
- [ ] P0 一段适合逐字输入的简短正文，控制在 25～40 个汉字。
- [ ] P0 一处加粗、一处斜体、一处高亮和一处行内代码。
- [ ] P0 一处超链接，链接文字使用公开站点或占位域名。
- [ ] P0 一张 3×4 产品对比表格。
- [ ] P0 一个 TypeScript 代码块，控制在 6～10 行。
- [ ] P0 一个行内公式和一个公式块。
- [ ] P0 一个 Mermaid 流程图或时序图。
- [ ] P0 一个 Note Callout 和一个 Warning Callout。
- [ ] P0 一组包含已完成与未完成项目的任务列表。
- [ ] P1 一处引用块。
- [ ] P1 一条脚注引用及其底部定义。
- [ ] P1 一个 Front matter 卡片。
- [ ] P1 一个正文 TOC 块。
- [ ] P1 一张本地图片，适合展示缩放、对齐和全屏预览。
- [ ] P0 至少 6 个多级标题，保证大纲可以折叠和拖拽。
- [ ] P0 为大纲拖拽准备一个包含子标题和两段正文的完整章节。

## 6. 慢操作镜头

### 6.1 文字与语义编辑

- [ ] P0 SLOW-TEXT-001：空白编辑区与闪烁光标。
- [ ] P0 SLOW-TEXT-002：逐字输入 H1 标题。
- [ ] P0 SLOW-TEXT-003：标题输入完成并呈现语义样式。
- [ ] P0 SLOW-TEXT-004：逐字输入正文。
- [ ] P0 SLOW-TEXT-005：输入 Markdown 加粗标记并显示最终加粗效果。
- [ ] P0 SLOW-TEXT-006：输入行内代码并显示最终样式。
- [ ] P1 SLOW-TEXT-007：切换标题级别。
- [ ] P1 SLOW-TEXT-008：插入超链接并打开快速编辑状态。
- [ ] P1 SLOW-TEXT-009：清除行内样式，保留正文与块结构。
- [ ] P1 SLOW-TEXT-010：语义模式切换到源码模式，再返回语义模式。

### 6.2 表格编辑

- [ ] P0 SLOW-TABLE-001：插入表格前的光标位置。
- [ ] P0 SLOW-TABLE-002：选择表格尺寸。
- [ ] P0 SLOW-TABLE-003：空表格插入完成。
- [ ] P0 SLOW-TABLE-004：依次填写表头。
- [ ] P0 SLOW-TABLE-005：依次填写两行数据。
- [ ] P0 SLOW-TABLE-006：在两行之间插入新行。
- [ ] P0 SLOW-TABLE-007：在两列之间插入新列。
- [ ] P0 SLOW-TABLE-008：切换列对齐方式。
- [ ] P1 SLOW-TABLE-009：切换表头行。
- [ ] P1 SLOW-TABLE-010：删除一行或一列后的最终状态。
- [ ] P1 SLOW-TABLE-011：表格控件全部可见的干净参考图。

### 6.3 代码、公式与 Mermaid

- [ ] P0 SLOW-CODE-001：插入 TypeScript 代码块。
- [ ] P0 SLOW-CODE-002：输入代码并逐步出现语法高亮。
- [ ] P1 SLOW-CODE-003：显示代码块行号。
- [ ] P0 SLOW-MATH-001：输入行内公式并完成渲染。
- [ ] P0 SLOW-MATH-002：输入公式块并完成渲染。
- [ ] P0 SLOW-MERMAID-001：输入简短 Mermaid 源码。
- [ ] P0 SLOW-MERMAID-002：Mermaid 图表渲染完成。
- [ ] P1 SLOW-MERMAID-003：打开 Mermaid 全屏预览。

### 6.4 大纲拖拽与导航

- [ ] P0 SLOW-OUTLINE-001：拖拽前的标题顺序和正文位置。
- [ ] P0 SLOW-OUTLINE-002：鼠标按住大纲标题。
- [ ] P0 SLOW-OUTLINE-003：出现标题拖拽预览。
- [ ] P0 SLOW-OUTLINE-004：悬停在目标标题之前，显示前置落点。
- [ ] P1 SLOW-OUTLINE-005：悬停在目标标题内部，显示层级落点。
- [ ] P0 SLOW-OUTLINE-006：标题落位。
- [ ] P0 SLOW-OUTLINE-007：正文整段与子章节同步完成重排。
- [ ] P1 SLOW-OUTLINE-008：撤销重排，恢复原顺序。
- [ ] P1 SLOW-OUTLINE-009：折叠某个章节。
- [ ] P1 SLOW-OUTLINE-010：一键折叠到默认层级，再一键展开全部。

### 6.5 搜索与替换

- [ ] P1 SLOW-SEARCH-001：打开搜索浮窗。
- [ ] P1 SLOW-SEARCH-002：输入关键词并高亮全部匹配。
- [ ] P1 SLOW-SEARCH-003：跳转到下一个匹配项。
- [ ] P1 SLOW-SEARCH-004：展开替换区域。
- [ ] P1 SLOW-SEARCH-005：单次替换后的正文状态。
- [ ] P1 SLOW-SEARCH-006：全部替换后的正文状态。
- [ ] P2 SLOW-SEARCH-007：拖动搜索浮窗到新位置。

## 7. 快闪结果镜头

### 7.1 主题与外观

所有主题画面必须使用同一篇文档、相同滚动位置和相同窗口尺寸。

- [ ] P0 FLASH-THEME-001：Nomo 默认 · 浅色。
- [ ] P0 FLASH-THEME-002：Nomo 默认 · 深色。
- [ ] P0 FLASH-THEME-003：琥珀纸页 · 浅色。
- [ ] P0 FLASH-THEME-004：琥珀纸页 · 深色。
- [ ] P0 FLASH-THEME-005：经典灰 · 浅色。
- [ ] P0 FLASH-THEME-006：经典灰 · 深色。
- [ ] P0 FLASH-THEME-007：GitHub · 浅色。
- [ ] P0 FLASH-THEME-008：GitHub · 深色。
- [ ] P1 FLASH-THEME-009：现代文档样式。
- [ ] P1 FLASH-THEME-010：经典文档样式。
- [ ] P1 FLASH-THEME-011：系统主题模式选中状态。
- [ ] P1 REF-THEME-012：外观设置页完整参考图。

### 7.2 Markdown 小窗

- [ ] P0 FLASH-MINI-001：主窗口正常状态。
- [ ] P0 FLASH-MINI-002：Markdown 小窗最终状态。
- [ ] P0 FLASH-MINI-003：小窗置顶按钮激活。
- [ ] P0 FLASH-MINI-004：小窗悬浮在另一普通窗口上方。
- [ ] P1 FLASH-MINI-005：小窗编辑当前文档。
- [ ] P1 FLASH-MINI-006：小窗显示未保存状态点。
- [ ] P1 FLASH-MINI-007：小窗显示外部文件变化状态点。
- [ ] P2 FLASH-MINI-008：大文档小窗只读锁定状态。
- [ ] P1 FLASH-MINI-009：返回主窗口后的恢复状态。

### 7.3 工作区与导航

- [ ] P0 FLASH-WORKSPACE-001：文件树展开，当前文件高亮。
- [ ] P0 FLASH-WORKSPACE-002：三个文档标签页同时打开。
- [ ] P1 FLASH-WORKSPACE-003：预览标签状态。
- [ ] P1 FLASH-WORKSPACE-004：标签页固定后的状态。
- [ ] P1 FLASH-WORKSPACE-005：标签过多时的隐藏标签下拉菜单。
- [ ] P0 FLASH-WORKSPACE-006：文档大纲展开。
- [ ] P0 FLASH-WORKSPACE-007：文档大纲折叠到默认层级。
- [ ] P1 FLASH-WORKSPACE-008：当前阅读标题在大纲中高亮。
- [ ] P0 FLASH-WORKSPACE-009：专注模式隐藏资源管理器。
- [ ] P1 FLASH-WORKSPACE-010：隐藏编辑工具栏。
- [ ] P1 FLASH-WORKSPACE-011：状态栏显示字符数、行数或词数。
- [ ] P1 FLASH-WORKSPACE-012：状态栏显示缩放百分比。
- [ ] P1 FLASH-WORKSPACE-013：Markdown 格式检查结果。
- [ ] P2 FLASH-WORKSPACE-014：恢复已保存的阅读位置。

### 7.4 Markdown 功能结果

- [ ] P0 FLASH-MD-001：代码块高亮最终状态。
- [ ] P0 FLASH-MD-002：行内公式和公式块最终状态。
- [ ] P0 FLASH-MD-003：Mermaid 图表最终状态。
- [ ] P0 FLASH-MD-004：完整表格最终状态。
- [ ] P0 FLASH-MD-005：Note Callout。
- [ ] P1 FLASH-MD-006：Tip Callout。
- [ ] P1 FLASH-MD-007：Important Callout。
- [ ] P1 FLASH-MD-008：Warning Callout。
- [ ] P1 FLASH-MD-009：Caution Callout。
- [ ] P0 FLASH-MD-010：任务列表最终状态。
- [ ] P1 FLASH-MD-011：脚注引用和脚注内容弹层。
- [ ] P1 FLASH-MD-012：Front matter 卡片。
- [ ] P1 FLASH-MD-013：正文 TOC 块。
- [ ] P1 FLASH-MD-014：Markdown 注释卡片。
- [ ] P1 FLASH-MD-015：引用块。
- [ ] P1 FLASH-MD-016：超链接快速编辑状态。
- [ ] P1 FLASH-MD-017：本地图片嵌入文档。
- [ ] P1 FLASH-MD-018：图片居中或调整尺寸后的状态。
- [ ] P1 FLASH-MD-019：图片全屏预览。

### 7.5 本地文件与导出

- [ ] P0 FLASH-EXPORT-001：演示 `.md` 文件在资源管理器中可见。
- [ ] P0 FLASH-EXPORT-002：保存成功后的干净状态。
- [ ] P1 FLASH-EXPORT-003：外部文件变化提示。
- [ ] P1 FLASH-EXPORT-004：重新载入外部版本选项。
- [ ] P0 FLASH-EXPORT-005：导出 HTML 菜单入口。
- [ ] P0 FLASH-EXPORT-006：导出完成的自包含 HTML 页面。
- [ ] P0 FLASH-EXPORT-007：导出 PDF 菜单入口。
- [ ] P0 FLASH-EXPORT-008：导出完成的 PDF 页面。
- [ ] P1 FLASH-EXPORT-009：HTML 与 PDF 两个交付文件并列。
- [ ] P1 FLASH-EXPORT-010：Windows 与 macOS 平台标识收束画面。

## 8. 设置窗口页面

设置页以 REF 为主，除外观页外不要求进入第一版成片。

- [ ] P1 REF-SETTINGS-001：设置窗口首页 / 常规。
- [ ] P1 REF-SETTINGS-002：编辑器设置。
- [ ] P0 REF-SETTINGS-003：外观设置，主题模式与主题卡片完整可见。
- [ ] P1 REF-SETTINGS-004：文件与窗口设置。
- [ ] P1 REF-SETTINGS-005：图片设置。
- [ ] P1 REF-SETTINGS-006：统计与导航设置。
- [ ] P2 REF-SETTINGS-007：高级设置。
- [ ] P1 REF-SETTINGS-008：关于页面与版本号。
- [ ] P1 REF-SETTINGS-009：自定义快捷键列表。
- [ ] P1 REF-SETTINGS-010：界面语言选择。
- [ ] P2 REF-SETTINGS-011：代码块默认语言与 Mermaid 默认图表类型。
- [ ] P2 REF-SETTINGS-012：图片资源策略选项。
- [ ] P2 REF-SETTINGS-013：文档统计与阅读时间选项。
- [ ] P2 REF-SETTINGS-014：更新检查状态。

## 9. 菜单、弹窗与上下文状态

### 9.1 标题栏菜单

- [ ] P1 REF-MENU-001：文件菜单。
- [ ] P1 REF-MENU-002：编辑菜单。
- [ ] P1 REF-MENU-003：段落菜单。
- [ ] P1 REF-MENU-004：格式菜单。
- [ ] P1 REF-MENU-005：视图菜单。
- [ ] P1 REF-MENU-006：最近文件子菜单，内容必须为演示文件。
- [ ] P1 REF-MENU-007：代码块语言子菜单。
- [ ] P1 REF-MENU-008：Mermaid 图表类型子菜单。

### 9.2 应用弹窗

- [ ] P1 REF-DIALOG-001：未保存文档关闭确认。
- [ ] P1 REF-DIALOG-002：外部文件变更处理。
- [ ] P2 REF-DIALOG-003：文件夹打开方式选择。
- [ ] P2 REF-DIALOG-004：关闭窗口行为选择。
- [ ] P2 REF-DIALOG-005：软件更新提示。
- [ ] P2 REF-DIALOG-006：软件更新详情。
- [ ] P2 REF-DIALOG-007：链接快速编辑。
- [ ] P2 REF-DIALOG-008：图片尺寸设置。
- [ ] P2 REF-DIALOG-009：图片全屏查看。
- [ ] P2 REF-DIALOG-010：Mermaid 全屏查看。
- [ ] P2 REF-DIALOG-011：脚注内容查看。
- [ ] P2 REF-DIALOG-012：Front matter 编辑状态。

### 9.3 右键菜单

- [ ] P2 REF-CONTEXT-001：文档标签页右键菜单。
- [ ] P2 REF-CONTEXT-002：标签栏空白区域右键菜单。
- [ ] P2 REF-CONTEXT-003：资源管理器文件右键菜单。
- [ ] P2 REF-CONTEXT-004：资源管理器文件夹右键菜单。
- [ ] P2 REF-CONTEXT-005：编辑区正文右键菜单。
- [ ] P2 REF-CONTEXT-006：链接右键菜单。
- [ ] P2 REF-CONTEXT-007：图片右键菜单。
- [ ] P2 REF-CONTEXT-008：表格右键菜单或行列控件。
- [ ] P2 REF-CONTEXT-009：大纲标题右键菜单。
- [ ] P2 REF-CONTEXT-010：Windows 标题栏右键窗口菜单。

## 10. 升级流程专项环境与镜头

### 10.1 场景目标

主动创建一个“旧版本发现新版本”的真实环境，展示 Nomo 的更新检查、版本详情、下载、MD5 校验、用户确认安装和升级后版本验证。

当前计划基线为：

- 旧版本：Nomo 0.4.6。
- 目标版本：Nomo 0.4.7。
- 正式采集前必须重新核对当前稳定版；如果版本已经变化，则使用“当前稳定版的前一个补丁版本 → 当前稳定版”。
- 只从 Nomo 官方 GitHub Releases 获取安装包、发布说明和校验清单。

### 10.2 隔离环境要求

- [ ] P0 首选 Windows Sandbox 或带还原快照的 Windows 虚拟机。
- [ ] P0 不在当前开发环境、日常 Nomo 安装或真实用户配置上执行降级。
- [ ] P0 为隔离环境创建一次性本地用户或一次性配置目录。
- [ ] P0 隔离环境中只放入演示文档副本，不挂载私人文档目录。
- [ ] P0 创建安装前快照或确认 Sandbox 可以直接销毁。
- [ ] P0 记录隔离系统版本、架构、显示缩放和屏幕分辨率。
- [ ] P0 固定系统时间、区域和简体中文界面，避免镜头之间跳变。
- [ ] P0 禁止登录私人 GitHub、浏览器、邮箱或云盘账号。
- [ ] P0 确认网络只用于访问官方 Release 与更新服务。
- [ ] P1 预留升级安装需要的磁盘空间，并记录安装目录。

### 10.3 旧版本获取与校验

- [ ] P0 下载官方 Nomo 0.4.6 Windows 安装包。
- [ ] P0 下载同一 Release 提供的 MD5 或其他官方校验清单。
- [ ] P0 记录 Release 页面、资产名称、文件大小和下载时间。
- [ ] P0 在安装前验证安装包摘要与官方清单一致。
- [ ] P0 将安装包和校验结果保存到 `upgrade-env/packages/`。
- [ ] P0 检查文件数字签名或发布者信息；如果不存在，记录事实但不自行补造。
- [ ] P0 安装 Nomo 0.4.6 后，在“关于”页确认真实版本号。
- [ ] P0 将自动检查更新设置恢复为开启。
- [ ] P0 复制演示文档到隔离环境，并确认 0.4.6 能正常打开。
- [ ] P1 记录旧版应用图标、标题栏和关于页，便于升级前后对照。

### 10.4 升级前镜头

- [ ] P0 UPGRADE-BEFORE-001：0.4.6 关于页，版本号完整可见。
- [ ] P0 UPGRADE-BEFORE-002：0.4.6 正常打开演示文档。
- [ ] P1 UPGRADE-BEFORE-003：启动时自动检查更新选项开启。
- [ ] P1 UPGRADE-BEFORE-004：冷启动前的干净桌面或窗口状态。
- [ ] P1 UPGRADE-BEFORE-005：演示文档已保存，无未保存状态。

### 10.5 发现更新与版本详情

- [ ] P0 UPGRADE-NOTICE-001：冷启动后出现“有新版本可以使用”提示。
- [ ] P0 UPGRADE-NOTICE-002：更新提示显示“稍后提醒”和“查看更新”。
- [ ] P0 UPGRADE-DETAIL-001：打开 Nomo 0.4.7 更新详情。
- [ ] P0 UPGRADE-DETAIL-002：版本标题和 Release Notes 完整可见。
- [ ] P1 UPGRADE-DETAIL-003：显示“安装前不会重启应用”的安全提示。
- [ ] P1 UPGRADE-DETAIL-004：显示“稍后更新”和“下载更新”操作。
- [ ] P2 UPGRADE-NOTICE-003：关闭并不再提醒当前版本的状态，仅做归档参考。

### 10.6 下载与校验

- [ ] P0 UPGRADE-DOWNLOAD-001：点击“下载更新”后的初始下载状态。
- [ ] P0 UPGRADE-DOWNLOAD-002：下载进度约 25%。
- [ ] P0 UPGRADE-DOWNLOAD-003：下载进度约 50%。
- [ ] P0 UPGRADE-DOWNLOAD-004：下载进度约 75%。
- [ ] P0 UPGRADE-DOWNLOAD-005：下载进度约 100%。
- [ ] P0 UPGRADE-DOWNLOAD-006：更新包完成 MD5 校验。
- [ ] P0 UPGRADE-DOWNLOAD-007：状态变为“可安装”。
- [ ] P0 UPGRADE-DOWNLOAD-008：“重启并安装”按钮可用。
- [ ] P1 UPGRADE-DOWNLOAD-009：设置页显示相同的下载或就绪状态。
- [ ] P1 UPGRADE-DOWNLOAD-010：下载期间继续查看演示文档，证明安装前不会强制重启。

### 10.7 安装与重启

- [ ] P0 确认所有演示文档已经保存后再进入安装阶段。
- [ ] P0 UPGRADE-INSTALL-001：点击“重启并安装”。
- [ ] P1 UPGRADE-INSTALL-002：存在未保存文档时的安全确认，仅在隔离环境中主动构造。
- [ ] P0 UPGRADE-INSTALL-003：安装流程启动状态。
- [ ] P1 UPGRADE-INSTALL-004：官方安装器界面或系统安装进度。
- [ ] P0 UPGRADE-INSTALL-005：安装完成并重新启动 Nomo。
- [ ] P1 UPGRADE-INSTALL-006：应用窗口重新出现，演示文件仍可正常访问。

### 10.8 升级后验证镜头

- [ ] P0 UPGRADE-AFTER-001：0.4.7 关于页，版本号完整可见。
- [ ] P0 UPGRADE-AFTER-002：升级前的演示文档内容保持完整。
- [ ] P0 UPGRADE-AFTER-003：再次检查更新，显示“当前已是最新版本”。
- [ ] P1 UPGRADE-AFTER-004：升级前后的版本号并列对比。
- [ ] P1 UPGRADE-AFTER-005：升级前后的相同文档画面对齐对比。
- [ ] P1 UPGRADE-AFTER-006：更新后的新功能入口或本次版本亮点。
- [ ] P0 记录最终安装版本、安装结果和演示文档完整性。

### 10.9 可选失败状态

以下状态只在可丢弃环境中复现，不污染官方安装包，不绕过证书或校验：

- [ ] P2 UPGRADE-ERROR-001：断网时的更新检查失败提示。
- [ ] P2 UPGRADE-ERROR-002：下载中断后的错误提示。
- [ ] P2 UPGRADE-ERROR-003：当前为免安装版时的手动更新提示。
- [ ] P2 UPGRADE-ERROR-004：不支持自动更新环境的提示。
- [ ] P2 不主动篡改真实安装包来制造校验失败；如需该画面，后续使用明确标注的 UI 模拟稿。

### 10.10 视频使用建议

- [ ] P0 快闪镜头：0.4.6 → 更新提示 → 下载进度 → 0.4.7，每个状态约 0.6～1.0 秒。
- [ ] P1 慢镜头：保留“下载完成后由用户决定何时安装”的安全提示约 1.5 秒。
- [ ] P1 使用同一演示文档作为升级前后 Match Cut，强调本地文档保持不变。
- [ ] P1 BGM 在更新提示出现时增加轻量提示音，在进度完成时加入干净确认音。
- [ ] P1 不在主片中完整播放安装器流程，只保留开始、重启和完成三个结果状态。

### 10.11 清理与恢复

- [ ] P0 确认所有升级镜头、版本信息和校验记录已经保存到项目素材目录。
- [ ] P0 关闭隔离环境，不把演示数据同步回真实用户目录。
- [ ] P0 销毁 Windows Sandbox，或将虚拟机恢复到安装前快照。
- [ ] P0 确认当前主机上的 Nomo、文件关联、右键菜单和用户配置没有变化。
- [ ] P0 在 `capture-manifest.json` 中记录隔离环境已清理。

> 实际下载、安装和重启属于外部状态变更。开始专项采集前，需要再次确认目标 Release、隔离环境和允许执行的安装范围。

## 11. 可选扩展素材

- [ ] P2 REF-TEXT-001：大型 TXT 分段编辑界面。
- [ ] P2 REF-JSON-001：大型 JSON 分段编辑界面。
- [ ] P2 REF-JSON-002：JSON 校验通过状态。
- [ ] P2 REF-JSON-003：JSON 格式化后的状态。
- [ ] P2 REF-WINDOW-001：系统托盘图标与托盘菜单。
- [ ] P2 REF-WINDOW-002：关闭到托盘后的状态。
- [ ] P2 REF-WINDOW-003：Windows `.md` 打开方式设置页。
- [ ] P2 REF-WINDOW-004：Windows 文件或文件夹右键菜单中的 Nomo 入口。
- [ ] P2 REF-WINDOW-005：从系统资源管理器双击 Markdown 文件进入 Nomo。
- [ ] P2 REF-MAC-001：macOS 原生标题栏状态，当前 Windows 环境不可采集。
- [ ] P2 REF-MAC-002：macOS Quick Look Markdown 预览，需在 macOS 环境另行采集。

## 12. 主片候选镜头筛选

### 慢镜头候选

- [ ] 文字逐字输入与即时渲染。
- [ ] 表格插入、填写和增减行列。
- [ ] 代码、公式或 Mermaid 中选择一个作为第二个输入演示。
- [ ] 大纲标题拖拽并带动整段章节重排。

### 快闪镜头候选

- [ ] 4 套主题快速切换。
- [ ] 浅色与深色切换。
- [ ] 主窗口切换为 Markdown 小窗。
- [ ] 小窗置顶。
- [ ] 文件树、多标签、大纲折叠。
- [ ] 搜索、替换后的结果。
- [ ] 代码、公式、Mermaid、Callout、任务列表结果。
- [ ] HTML 与 PDF 导出结果。
- [ ] 旧版本、更新提示、下载完成和新版本结果。

### 收尾镜头候选

- [ ] Nomo 应用图标。
- [ ] 产品名 `Nomo`。
- [ ] 文案：`让 Markdown 回到写作本身`。
- [ ] 平台：Windows / macOS。
- [ ] GitHub 仓库或下载入口，最终发布前核对准确地址。

## 13. BGM 与声音采集提示

- [ ] 计划采用 100～108 BPM、无歌词、现代极简电子风 BGM。
- [ ] 慢操作段减少鼓组，为键盘和 UI 反馈留空间。
- [ ] 快闪功能段使用完整节拍，每 1～2 拍切换一个结果。
- [ ] 文字输入单独采集干净键盘声或后期配置轻量键盘 SFX。
- [ ] 表格插入与行列变化配置轻微 click / pop。
- [ ] 主题切换配置柔和 swipe。
- [ ] 小窗收缩配置短促 whoosh。
- [ ] 大纲标题落位配置轻量 snap。
- [ ] Logo 收尾配置单个干净提示音。
- [ ] BGM、SFX 和旁白使用来源明确、允许当前用途的素材。
- [ ] 第一版建议只在开头与结尾使用旁白，中间让真实操作和音乐主导。

## 14. 单张素材验收

- [ ] 画面尺寸、窗口尺寸和缩放符合本轮统一规格。
- [ ] UI 文字清晰，不存在插值模糊或压缩噪点。
- [ ] 没有真实用户名、私人路径、最近文件或通知内容。
- [ ] 没有鼠标停在无意义位置。
- [ ] 没有菜单、Tooltip 或焦点框意外遮挡主体。
- [ ] 当前主题、文档位置和目标状态与镜头 ID 一致。
- [ ] 快闪前后画面可以对齐，不发生窗口跳动。
- [ ] 慢操作序列没有遗漏起始、过程或结束状态。
- [ ] 文件名与镜头 ID 一致。
- [ ] `capture-manifest.json` 已记录状态、用途和备注。

## 15. 整批素材验收

- [ ] 所有 P0 项已采集或写明无法采集的原因。
- [ ] 8 个主题深浅色状态使用完全相同的构图。
- [ ] 文字输入、表格编辑和大纲拖拽序列可以顺畅连贯播放。
- [ ] 快闪素材能够按统一节拍进行硬切或 Match Cut。
- [ ] HTML、PDF 与本地 `.md` 的展示不包含私人路径。
- [ ] Windows 专属与 macOS 专属素材已明确区分。
- [ ] 已生成 Contact Sheet，并按分组标注镜头 ID。
- [ ] 已由用户完成第一次页面完整性复核。
- [ ] 已标出确定进入 50 秒完整版的素材。
- [ ] 已标出确定进入 30 秒精简版的素材。
- [ ] 未开始 Remotion 制作前，采集清单中的缺口已明确。
- [ ] 升级流程已在隔离环境完成，当前主机安装和配置未受影响。

## 16. 采集记录模板

每个镜头在 `capture-manifest.json` 中至少记录：

```json
{
  "id": "FLASH-THEME-001",
  "priority": "P0",
  "mode": "FLASH",
  "title": "Nomo 默认 · 浅色",
  "source": "Nomo 0.4.7",
  "window_size": "1440x900",
  "app_scale": "100%",
  "theme": "nomo-default/light",
  "document": "产品发布说明.md",
  "status": "planned",
  "file": "",
  "intended_use": ["full", "short"],
  "notes": "与其他主题保持相同滚动位置"
}
```

## 17. 当前阶段完成条件

本阶段只在以下条件同时满足后结束：

1. P0 页面与状态全部采集完成。
2. Contact Sheet 已生成并完成一次人工复核。
3. 慢操作与快闪素材已经分组。
4. 没有隐私信息、路径泄露或错误产品文案。
5. 用户确认可以进入 BGM 选择、时间轴锁定和 Remotion 制作。
