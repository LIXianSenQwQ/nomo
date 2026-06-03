# Tasks

- [x] Task 1: 修复桌面端图标
  - [x] SubTask 1.1: 编写一个简单的 Node.js 脚本或命令，在 `src-tauri/icons/` 下生成一个有效的、带有基本图形（如带颜色的方块和首字母）的 256x256 或 512x512 的 `app-icon.png`。
  - [x] SubTask 1.2: 运行 `pnpm tauri icon src-tauri/icons/app-icon.png` 生成完整的图标集。
  - [x] SubTask 1.3: 检查 `src-tauri/tauri.conf.json` 中的 `bundle.icon` 配置，确保引用了生成的 `icon.ico` 等标准图标路径。

- [x] Task 2: 修复顶部拖动边界
  - [x] SubTask 2.1: 修改 `src/app/styles/app-responsive.css` 中的 `.titlebar`，移除 `-webkit-app-region: drag`，并在顶部增加 `padding-top: 4px` 留出缩放区域。
  - [x] SubTask 2.2: 确保 `src/app/components/AppTitleBar.svelte` 中，仅 `.titlebar-row.top-row` 及内部非交互文本/空白处带有 `data-tauri-drag-region` 属性。
  - [x] SubTask 2.3: 检查右侧控制按钮（最大化、最小化、关闭）和左侧菜单的容器是否明确标记了非拖拽属性（`-webkit-app-region: no-drag` 或在 Svelte 模板中去除 `data-tauri-drag-region`）。

# Task Dependencies

- [Task 2] depends on [Task 1] (无强依赖，可并行或按顺序执行)
