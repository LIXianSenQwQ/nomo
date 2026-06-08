# Nomo 图标资源

本目录存放 Nomo 已接入的正式图标源图和托盘图标。

Nomo 正式应用图标已改用 `source/nomo-app-light-256.png` 作为源图，并通过 Tauri CLI 生成 `src-tauri/icons` 根目录下的正式打包图标。图标生成链路必须只依赖项目内文件，不引用桌面或其他外部目录。

托盘当前正式使用 `tray/` 下四个 24px 图标，并按软件当前有效主题在 light/dark 间切换，按窗口可见状态在 active/inactive 间切换。任务栏窗口图标使用 `source/` 下的 256px light/dark 应用 logo，并跟随软件当前有效主题切换。

旧版应用图标候选、品牌预览、概念图和接触表预览已清理，不再作为项目内资产保留。当前保留 `source/` 中的新版 128/256 应用 logo 源图，方便后续重新生成派生图标。

## 目录说明

- `source/`: 应用 logo 源图，保留 light/dark 与 128/256 两组 PNG；当前正式生成源为 `source/nomo-app-light-256.png`。
- `tray/`: 托盘/系统栏图标，保留 dark/light 与 active/inactive 四个 24px 状态图标。

## 命名规则

- 文件名前缀统一使用 `nomo-`。
- `app-light` / `app-dark` 表示应用 logo 浅色或深色版本。
- `tray-light` / `tray-dark` 表示托盘或系统栏图标适配浅色或深色系统栏。
- `active` / `inactive` 表示激活态或未激活态。
- `128` / `256` 表示应用 logo 源图尺寸。
- `24` 表示 24px 托盘图标。

## 当前接入状态

- 已按需求排除渐变版图标。
- 已修改 `src-tauri/tauri.conf.json`，应用外显名称迁移为 Nomo。
- 已用 `source/nomo-app-light-256.png` 通过 Tauri CLI 重新生成 `src-tauri/icons/icon.png`、`icon.ico`、`icon.icns`、`32x32.png`、`128x128.png`、`128x128@2x.png`、Windows Store Logo、iOS 和 Android 派生图标。
- 已将四个 24px 托盘图标纳入 `tray/`，对应 active/inactive、light/dark 文件；前端主题变化会通过 `set_desktop_icon_theme` 同步后端托盘图标和任务栏窗口图标。
- 已清理旧版候选图标目录和未引用的 `src/app/assets/nomo-app-icon.png`。
