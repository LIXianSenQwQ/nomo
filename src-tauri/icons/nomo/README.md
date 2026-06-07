# Nomo 图标候选资源

本目录存放从 `C:\Users\admin\Pictures\Nomo logo设计` 下两张设计展示图裁切出的 Nomo 图标候选资源。

`app/nomo-app-light-final-preview.png` 已作为 Nomo 正式应用图标源图接入，并通过 Tauri CLI 生成 `src-tauri/icons` 根目录下的正式打包图标。

托盘当前正式使用 `tray/nomo-tray-dark-active-24-preview.png` 和 `tray/nomo-tray-dark-inactive-24-preview.png`，用于窗口可见态与隐藏到托盘态。其他文件仍作为候选资产池和视觉参考保留。

所有 PNG 候选资源已在裁切后补充 alpha 透明通道：应用图标、深色托盘图标和图标变体按圆角底板切出透明四角；纯标识、文字组合和概念图形移除了设计稿白色画板背景。

深色应用图标和深色托盘图标已按设计稿中的深色圆角底板真实边界重新裁切，并居中放入透明正方形画布，避免外围白色画板残留造成视觉偏移。

## 目录说明

- `app/`: 应用图标候选，包含浅色、深色和设计稿标注尺寸的展示裁切；`nomo-app-light-final-preview.png` 当前作为正式应用图标源图。
- `tray/`: 托盘/系统栏图标候选，包含浅色系统栏、深色系统栏、激活态、未激活态和参考小尺寸；深色 24px active/inactive 当前作为正式托盘图标。
- `brand/`: 品牌主图标、品牌组合、线框变体、深色变体和状态栏标识。
- `concept/`: 设计理念区出现的图形元素，作为后续视觉参考保留。
- `preview/`: 裁切后的接触表，仅用于快速检查所有候选图标。
- `preview/nomo-icons-contact-sheet.png`: 棋盘格背景接触表，用于检查透明背景和圆角裁切效果。

## 命名规则

- 文件名前缀统一使用 `nomo-`。
- `app-light` / `app-dark` 表示应用图标浅色或深色版本。
- `tray-light` / `tray-dark` 表示托盘或系统栏图标适配浅色或深色系统栏。
- `active` / `inactive` 表示激活态或未激活态。
- `label-1024`、`label-512`、`label-256`、`label-128` 表示设计稿中的尺寸标注；由于源文件是 1448x1086 的展示图，这些 PNG 是展示图上的实际裁切像素，不是对应尺寸的原始高清导出。
- `preview` 表示文件来自设计展示图裁切，尚未作为正式应用图标接入。

## 当前接入状态

- 已按需求排除渐变版图标。
- 已修改 `src-tauri/tauri.conf.json`，应用外显名称迁移为 Nomo。
- 已覆盖 `src-tauri/icons/icon.png`、`icon.ico`、`icon.icns`、`32x32.png` 等当前生效图标。
