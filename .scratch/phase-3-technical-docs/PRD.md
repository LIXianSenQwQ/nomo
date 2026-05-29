# PRD：阶段 3 技术文档能力

Status: ready-for-agent

## Problem Statement

阶段 2 已具备写作工具基础体验，但技术文档中的 task list、基础表格、front matter、数学公式和 Mermaid 图表还缺少稳定的 Markdown-first 支持。

## Solution

以 Markdown 文本为主数据，新增技术文档块提取服务和渲染服务：task list、基础表格、数学公式和 Mermaid 从 Markdown 派生预览；KaTeX 和 Mermaid 通过服务接口接入；EditorCore 保留 front matter，并提供技术块插入命令。

由于当前环境缺 Rust/Cargo，SQLite 最近文件和索引暂不落地为 Tauri 插件实现，本阶段只保留存储接口和浏览器降级体验。

## Acceptance

- Front matter 在 ProseMirror 语义编辑事务后仍保留在 Markdown 顶部。
- 支持插入 task list、基础表格、数学公式和 Mermaid fenced block。
- 技术文档面板能展示 task list、基础表格、KaTeX 公式和 Mermaid 图表预览。
- KaTeX 渲染服务有测试覆盖。
- 技术块提取服务有测试覆盖。
- `pnpm check`、`pnpm test`、`pnpm build` 通过。
