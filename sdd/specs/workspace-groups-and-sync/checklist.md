# Verification Checklist: Workspace Groups & H1 Title Sync

> This checklist is used to verify that ALL features are implemented correctly before marking the requirement as completed. Every item must be objectively verifiable. It must be fully checked before closing the requirement.

## Functional Verification
- [ ] First launch does not auto-initialize a workspace directory in the OS Documents folder.
- [ ] Opening a folder explicitly loads that folder into the Explorer Sidebar.
- [ ] Clicking "Create Folder" in Explorer header adds a new group folder on disk.
- [ ] Clicking "Create Folder" next to an existing folder adds a nested folder underneath it and auto-expands the parent.
- [ ] Creating a file or folder with an empty name (triggering blur) correctly falls back to a default name (e.g., "新建文件夹" or "无标题").
- [ ] Double-clicking a folder allows renaming it, reflecting the change on disk.
- [ ] Clicking "Create File" next to a folder creates a new Markdown file pre-filled with `# 文件名\n\n`.
- [ ] Creating a file automatically opens a new Tab and focuses the editor.
- [ ] Typing in the editor triggers a debounced save to the physical file.
- [ ] Changing the first H1 in the editor automatically renames the physical `.md` file.
- [ ] Invalid OS characters in H1 or inputted names are stripped/replaced during creation/renaming.
- [ ] Naming conflicts during H1 sync or folder creation are resolved (e.g., appending a number).
- [ ] "已保存" toast notification appears briefly after an auto-save.

## Code Quality
- [ ] No new TypeScript type errors introduced.
- [ ] No new linting warnings introduced.
- [ ] No debug logs, commented-out code, or `console.log` left in the production path.
- [ ] Rust backend logic follows DDD separation (no mixing commands/state/menu in single files).

## Testing
- [ ] Unit/Integration tests for path sanitization and conflict resolution pass.
- [ ] Manual smoke test on macOS/Windows target platforms passes.
- [ ] Existing Tab switching and initialization logic has no regressions.

## Non-Functional
- [ ] UI displays correctly across supported resolutions / viewports, maintaining the glassmorphism/modern aesthetic.
- [ ] Recursive folder tree indents correctly and renders efficiently.
- [ ] Performance is acceptable (debounce prevents excessive disk IO; no noticeable typing lag).
- [ ] Error states show user-friendly messages for disk/IO failures.
