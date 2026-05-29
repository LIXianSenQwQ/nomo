# PRD：阶段 2 Markdown-first 写作体验

Status: ready-for-agent

## Problem Statement

阶段 1 已完成 Markdown 可编辑闭环，但界面仍偏工程验证：缺少长文档导航、写作统计、主题排版设置、图片插入体验和可替换代码高亮服务。

## Solution

在不破坏 EditorCore 边界的前提下，补齐 Markdown-first 写作体验：Outline 从 Markdown 标题派生，状态栏实时显示统计，工具栏提供主题、字号和行高设置，图片拖放/粘贴插入资源目录相对路径，Shiki 作为 codeTokenizer 深模块接入并可测试。

## Acceptance

- Outline 能从 Markdown 标题派生，并能跳到源码对应行。
- 字符数、词数、标题数、阅读时间能随文档更新。
- 图片拖放或粘贴不写入 base64，而是插入 `./文档名.assets/图片名` 相对路径。
- 字号、行高、明暗主题通过 CSS 变量生效，并保存到 localStorage。
- Shiki tokenizer 能处理已知语言，并对未知语言回退为纯文本。
- `pnpm check`、`pnpm test`、`pnpm build` 通过。
