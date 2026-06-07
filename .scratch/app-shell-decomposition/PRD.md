# App Shell 拆分 PRD

Status: ready-for-agent

## Problem Statement

当前 `App.svelte` 同时承担应用生命周期、桌面文件能力、窗口菜单、资源管理器、标签页、工具栏、编辑区、大纲、状态栏和样式定义，文件过长导致后续维护者难以快速定位职责边界，也不符合成熟工程中“应用编排”和“界面部件”分层的结构要求。

## Solution

将 `App.svelte` 收敛为 Nomo 的应用装配层：保留 EditorCore 协调、桌面存储流程、全局快捷键、文件变更检查和主状态；将可复用 UI 区域拆成独立 Svelte 组件；将跨组件类型、DOM action、路径展示工具和应用样式放到稳定目录中。

## User Stories

1. As a developer, I want `App.svelte` to read like an application shell, so that I can understand the page composition quickly.
2. As a developer, I want titlebar menus to live in a dedicated component, so that window/menu behavior can be maintained without scanning editor markup.
3. As a developer, I want the resource explorer to be isolated, so that folder tree behavior can evolve independently.
4. As a developer, I want document tabs to be isolated, so that tab state rendering remains easy to inspect.
5. As a developer, I want editor toolbar controls to be isolated, so that command wiring and display controls are not mixed with file IO logic.
6. As a developer, I want source mode, semantic editor host, and Outline rendering grouped together, so that Outline layout tests target the correct component boundary.
7. As a developer, I want CSS moved out of `App.svelte`, so that application structure and visual rules do not compete inside one file.

## Implementation Decisions

- `App.svelte` remains the orchestration boundary because it owns lifecycle, EditorCore, desktop integration, tab state, current document state, and global shortcuts.
- UI-only responsibilities are split into titlebar, explorer sidebar, document tabs, editor toolbar, editor workspace, and status bar components.
- Shared UI types are defined once and imported by both the shell and child components.
- The click-outside behavior is moved into a Svelte action because it is a DOM concern rather than application state.
- Windows-first path labels are moved into a utility module so display rules stay reusable and testable.
- App-level CSS is imported from `src/main.ts`, keeping Svelte components focused on markup and behavior.

## Testing Decisions

- Keep layout tests focused on externally visible structure: Outline is outside document layout flow, editor shell remains a container query boundary, and content width still uses the editor shell percentage.
- Update tests to read from the new component and style files instead of assuming all structure lives in `App.svelte`.
- Use `svelte-check` as the first guard for Svelte prop contracts and accessibility warnings.

## Out of Scope

- Rewriting EditorCore, MarkdownBridge, ProseMirror Adapter, or Markdown persistence behavior.
- Changing visual design, keyboard shortcuts, file IO semantics, or document save behavior.
- Introducing a new state management library.

## Further Notes

This refactor is intentionally structural and low-risk: it moves responsibilities into clearer files while preserving the existing runtime behavior and the user-facing Windows-first desktop experience.
