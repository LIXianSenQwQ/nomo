# Nomo 图标资源

本目录存放 Nomo 已接入的正式图标源图和托盘图标。

## macOS 两套图标（重要）

macOS 上 Dock / Cmd+Tab 看到的图标，**不只看 `icon.icns`**：

| 资源 | 用途 |
|------|------|
| `../icon.icns` | `.app` 包内图标；应用**未运行**时 Finder / 启动台显示 |
| `macos/nomo-app-light-256.png` / `dark` | 应用**运行后**由 Rust 调用 `setApplicationIconImage` 设置 Dock / Cmd+Tab |

因此只改 `icon.icns` 而应用已在运行，或只重打前端包、未重编译 Rust，Dock 图标**不会变化**。

调整 Dock 边距请直接编辑 `macos/nomo-app-light-256.png` / `nomo-app-dark-256.png`，然后执行：

```bash
bash scripts/regenerate-macos-icons.sh   # 仅根据 macos/*.png 更新 icon.icns
pnpm run build:macos                     # 或 pnpm tauri dev，重新编译 Rust
```

当前 macOS 运行时图标内容区约 **218px**（256 画布）。

托盘使用 `tray/` 下四个 24px 图标。Windows 等使用 `src-tauri/icons/icon.ico`，不随 macOS 边距策略变化。

## 目录说明

- `source/`: 未缩放的原始 logo 源图（light/dark × 128/256），供生成脚本读取。
- `macos/`: 已应用 macOS 安全边距的 256px Dock 运行时图标；`regenerate-macos-icons.sh` 据此生成 `icon.icns`。
- `tray/`: 托盘/系统栏图标（dark/light × active/inactive，24px）。

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
- macOS 运行时 Dock 图标由 `src-tauri/src/window/tray.rs` 嵌入 `macos/*.png`。
- 已将四个 24px 托盘图标纳入 `tray/`；前端主题变化通过 `set_desktop_icon_theme` 同步托盘与 Dock 图标。
- Windows 安装态任务栏图标保持固定 bundle 图标，避免动态切换导致任务栏按钮闪烁、消失、重排或受快捷方式图标缓存影响。
