# Task Breakdown & Execution Board: Workspace Groups & H1 Title Sync (Tasks)

> This document is used by AI and developers to break down and track atomic tasks. Before starting coding, be sure to complete this checklist and check them off one by one during execution.

## Phase 1: Tauri Backend & Core Types
- [ ] Task 1.1: Keep SQLite `app_settings` limited to preferences, tab state, and migration cleanup for deprecated settings.
- [ ] Task 1.2: Do not add a default workspace initialization command; folder trees are loaded only after an explicit user folder selection.
- [ ] Task 1.3: Add Tauri commands for recursive directory reading (`read_dir_recursive`), directory creation (`create_group`), file creation (`create_file`), file content writing (`write_file`), and file/folder renaming (`rename_file`).

## Phase 2: Frontend State & Initialization
- [ ] Task 2.1: Keep frontend folder state as the current explicitly opened folder, not a persisted storage root.
- [ ] Task 2.2: Implement initialization logic that restores tabs/preferences without creating or auto-loading a default folder.
- [ ] Task 2.3: Define `FileNode` recursive type for Svelte and implement state logic to manage the recursive directory tree.

## Phase 3: Left Panel UI (Explorer Sidebar)
- [ ] Task 3.1: Update `ExplorerSidebar.svelte` to display the explicitly opened folder tree recursively (nested folders).
- [ ] Task 3.2: Implement "Add Folder" UI: "Create Folder" icon in header and next to existing folders. Displays an inline input underneath, auto-expanding the parent.
- [ ] Task 3.3: Implement double-click to rename existing folders.
- [ ] Task 3.4: Integrate "Add Folder" and rename UI with Tauri backend commands. Handle empty input fallback (e.g., "新建文件夹").

## Phase 4: File Creation & Tab Integration
- [ ] Task 4.1: Add "Create File" icon next to each folder in the sidebar.
- [ ] Task 4.2: Implement file creation logic: call Tauri to create an `.md` file pre-filled with `# 文件名\n\n`. Handle empty input fallback (e.g., "无标题.md").
- [ ] Task 4.3: Integrate file creation with Tab system: open a new Tab for the created file and switch the editor to it.

## Phase 5: Editor Auto-Save & H1 Sync
- [ ] Task 5.1: Update ProseMirror `onChange` event to extract the first H1 text from the document.
- [ ] Task 5.2: Implement debounced save logic (e.g., 1000ms delay) in `documentActionsController.ts` or editor wrapper.
- [ ] Task 5.3: Integrate auto-save with Tauri `write_file` command.
- [ ] Task 5.4: Implement file renaming logic: if extracted H1 differs from current filename, sanitize string, resolve conflicts, and call Tauri `rename_file`. Update Tab and recursive Sidebar tree states.

## Phase 6: UI Refinement & Polish
- [ ] Task 6.1: Add a transient "已保存" (Saved) toast notification after a successful auto-save.
- [ ] Task 6.2: Ensure styling matches modern UI/UX preferences (glassmorphism, Radix UI / @lobehub/ui components if applicable).
- [ ] Task 6.3: Perform self-testing against the Verification Checklist in `checklist.md`.
- [ ] Task 6.4: Clean up debug logs and unused code.

# Task Dependencies
- [Task 1.2] and [Task 1.3] depend on [Task 1.1]
- [Task 2.1] and [Task 2.2] depend on [Task 1.2]
- [Task 2.3] depends on [Task 1.3]
- [Task 3.1] depends on [Task 2.2] and [Task 2.3]
- [Task 3.2], [Task 3.3], and [Task 3.4] depend on [Task 1.3] and [Task 3.1]
- [Task 4.2] depends on [Task 1.3]
- [Task 4.3] depends on [Task 4.2]
- [Task 5.2] depends on [Task 5.1]
- [Task 5.3] and [Task 5.4] depend on [Task 5.2] and [Task 1.3]
- [Task 6.1] depends on [Task 5.3]
- [Task 1.2] and [Task 1.3] can run in parallel
- [Task 2.1] and [Task 3.1] can run in parallel once dependencies are met
