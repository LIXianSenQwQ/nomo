# Task Breakdown & Execution Board: Settings Drawer & Workspace Path (Tasks)

> This document is used by AI and developers to break down and track atomic tasks. Before starting coding, be sure to complete this checklist and check them off one by one during execution.

## Phase 1: Settings Drawer Component
- [ ] Task 1.1: Create `SettingsDrawer.svelte` component with the required layout (backdrop, right-aligned panel, top-left exit, bottom-right save).
- [ ] Task 1.2: Add CSS styles for the drawer animation (slide-in from right) and layout in `app-layout.css` or component-scoped styles.

## Phase 2: AppTitleBar Integration
- [ ] Task 2.1: In `AppTitleBar.svelte`, add a "设置" menu button to the right of the "查看" menu.
- [ ] Task 2.2: Pass a `toggleSettings` or `openSettings` prop/function to manage the drawer's visibility state.

## Phase 3: Workspace Path Configuration Logic
- [ ] Task 3.1: Inside `SettingsDrawer.svelte`, add the UI for the workspace path (label, read-only input, "浏览..." button).
- [ ] Task 3.2: Implement the "浏览..." button click handler using `@tauri-apps/plugin-dialog` (`open({ directory: true })`) to pick a folder.
- [ ] Task 3.3: Implement the Save logic: on click, invoke a callback with the new path.

## Phase 4: App State Integration
- [ ] Task 4.1: In `App.svelte`, define the `isSettingsOpen` state.
- [ ] Task 4.2: Add the `SettingsDrawer` to `AppShell.svelte` (or `App.svelte` directly overlaying the shell).
- [ ] Task 4.3: Implement the `onSaveSettings` handler in `App.svelte` to update `currentFolderPath`, save to SQLite via `updateAppSetting`, call `loadFolder(newPath)`, and close the drawer.

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 2.2] depends on [Task 2.1]
- [Task 3.2] and [Task 3.3] depend on [Task 3.1]
- [Task 4.2] depends on [Task 1.1] and [Task 4.1]
- [Task 4.3] depends on [Task 3.3] and [Task 4.2]
