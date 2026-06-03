# 修复窗口图标与拖动边界 Spec

## Why

1. 当前 Tauri 应用的图标配置不正确或缺失有效图标文件，导致任务栏显示为红色报错图标。
2. 启用了无边框窗口（`decorations: false`），但顶部拖动区域（drag region）可能覆盖了窗口边缘，导致无法在顶部进行窗口缩放，或者拖动区域干扰了其他交互组件的边界。

## What Changes

- **图标修复**：生成一个有效的 PNG 图标并使用 Tauri CLI 重新生成所有格式的图标文件（`.ico`, `.icns`, `.png`），并更新 `tauri.conf.json` 以确保正确引用。
- **拖动边界修复**：优化顶部标题栏的拖动区域设置，在标题栏顶部保留约 4px 的非拖动区域（用于原生窗口调整大小），并确保右侧窗口控制按钮区域和左侧菜单交互区域不受拖动属性干扰。

## Impact

- Affected specs: 窗口交互体验、应用打包与图标显示。
- Affected code:
  - `src-tauri/tauri.conf.json`
  - `src-tauri/icons/*`
  - `src/app/components/AppTitleBar.svelte`
  - `src/app/styles/app-responsive.css`

## MODIFIED Requirements

### Requirement: 桌面端窗口外观与交互

**图标**：应用必须具有清晰有效的桌面/任务栏图标。
**拖动与缩放**：用户可以通过拖动标题栏空白处移动窗口，同时鼠标悬停在窗口最顶部边缘时，能够正常触发系统的垂直缩放操作。

#### Scenario: 缩放与拖动

- **WHEN** 鼠标移动到窗口最上方（0-4px）范围内。
- **THEN** 鼠标指针变为垂直缩放（resize）箭头，按住可调整窗口高度。
- **WHEN** 鼠标移动到标题栏空白处（>4px）并拖动。
- **THEN** 窗口跟随鼠标移动。
