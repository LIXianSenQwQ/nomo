# PRD：补齐 0-3 阶段 Tauri 原生能力

Status: ready-for-agent

## Problem Statement

阶段 0-3 因 Rust/Cargo 环境未就绪，桌面壳、原生文件对话框、原生文件读写、最近文件、设置和快照只能以浏览器降级方式验证。

## Solution

补齐 Tauri 2 原生能力：使用 dialog 插件提供 Windows 原生打开/保存对话框，使用 Rust command 读写 Markdown 文件，使用 SQLite 保存最近文件、应用设置和文档快照。前端采用 Tauri 优先、浏览器降级策略，确保 Web dev server 仍可运行。

## Acceptance

- `tauri info` 能识别 Rust/Cargo/WebView2/MSVC。
- Rust `cargo check` 通过。
- Tauri 应用本体可通过 `tauri build --debug --no-bundle` 编译出 exe。
- 前端 `pnpm check`、`pnpm test`、`pnpm build` 通过。
- UI 在 Tauri 环境下优先使用原生打开/保存、最近文件、设置和快照。
