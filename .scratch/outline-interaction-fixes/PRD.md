# 文档大纲交互修复 PRD

Status: ready-for-agent

## Problem Statement

用户在使用文档大纲导航 Markdown 文档时遇到三个直接影响编辑体验的问题：大纲中的展开/关闭控件没有实际效果；点击某个大纲节点后，大纲高亮会跳到另一个节点，导致用户无法确认当前定位；点击大纲节点还会强制切换到源码模式，打断当前语义编辑流程。

## Solution

文档大纲需要成为一个稳定的独立浮层，只渲染一份，并提供真实可用的树形折叠能力。点击大纲节点时，应保留用户当前编辑模式：在语义模式中滚动到对应标题，在源码模式中滚动并选中对应源文本行。程序化滚动期间应保持用户点击的节点为高亮，避免滚动监听短暂覆盖选中状态。

## User Stories

1. As a Markdown writer, I want to collapse a parent heading in the document outline, so that I can temporarily hide its child headings.
2. As a Markdown writer, I want to expand a collapsed parent heading, so that I can see its child headings again.
3. As a Markdown writer, I want the expand/collapse control to be separate from heading navigation, so that toggling a group does not unexpectedly jump the document.
4. As a Markdown writer, I want clicking a heading in the outline to keep the outline highlight on that heading, so that I can trust the navigation state.
5. As a Markdown writer using semantic mode, I want outline navigation to scroll the semantic document, so that I stay in the writing surface I am using.
6. As a Markdown writer using source mode, I want outline navigation to scroll the source text, so that source editing remains precise.
7. As a Markdown writer, I do not want outline navigation to switch modes automatically, so that my editor context remains stable.
8. As a Markdown writer, I want only one outline panel to exist visually and semantically, so that duplicate panels do not fight over active state.
9. As a keyboard or screen-reader user, I want outline controls to expose clear labels and expanded state, so that the tree can be operated predictably.

## Implementation Decisions

- Modify the editor shell so the document outline is rendered once as a shared floating panel rather than duplicated inside both source and semantic panes.
- Add local collapsed-heading state keyed by outline item id.
- Treat a heading as expandable when a following outline item has a deeper heading level.
- Hide descendant outline rows when any ancestor heading is collapsed.
- Split each outline row into a toggle control and a navigation control so expand/collapse does not trigger document navigation.
- Change outline navigation to branch by current editor mode instead of forcing source mode.
- In semantic mode, map the clicked outline item to the corresponding rendered heading and scroll the semantic pane.
- In source mode, keep the existing source-line selection behavior.
- During programmatic outline scrolling, temporarily suppress scroll-spy updates so clicked-node highlight is not overwritten by intermediate scroll positions.
- Keep the existing floating outline visual styling, including border, shadow, blur, transparency, and right-offset calculation.

## Testing Decisions

- Use TDD with a red-green loop for the observed regressions.
- Add layout/behavior regression coverage around the public Svelte component source because this repo already has lightweight App layout tests for outline placement.
- Tests should verify user-visible behavior contracts: one shared outline panel, expandable outline controls, and no automatic source-mode switch from outline navigation.
- Existing outline extraction tests remain responsible for heading id, level, and line-number parsing.
- Full regression validation should include `vitest`, `svelte-check`, and production build.

## Out of Scope

- Reworking the entire outline data model into a separate tree module.
- Persisting collapsed outline state across app restarts.
- Adding drag, reorder, or document-structure editing from the outline.
- Changing document outline visual placement beyond the existing floating panel design.
- Resolving unrelated Svelte warnings already present in the app shell.

## Further Notes

This PRD captures the focused interaction repair requested on 2026-05-29. The issue is ready for implementation and validation against the existing local Markdown issue tracker workflow.
