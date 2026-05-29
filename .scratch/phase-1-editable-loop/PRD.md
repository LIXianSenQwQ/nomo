# PRD：阶段 1 可编辑闭环

Status: ready-for-agent

## Problem Statement

阶段 0 只验证了 Svelte 工作台和 EditorCore API 形状，还不能证明 Markdown 文件能进入语义编辑器并保存回标准 Markdown。

## Solution

接入 ProseMirror Adapter，支持基础 Markdown 语义编辑、源码模式反写、Markdown 序列化、撤销重做和 Windows-first 文件打开/导出降级流。由于当前机器缺 Rust/Cargo，Tauri 原生文件系统能力先保留配置骨架，Web 端使用浏览器文件选择和下载导出完成可验证闭环。

## Acceptance

- 语义编辑区由 ProseMirror 挂载。
- ProseMirror 文档变化能通过 EditorCore 序列化为 Markdown。
- 源码模式修改能反写语义编辑区。
- 支持打开本地 `.md` 文件并导出保存 Markdown。
- `pnpm check`、`pnpm test`、`pnpm build` 通过。
