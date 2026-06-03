# Verification Checklist: Settings Drawer & Workspace Path

> This checklist is used to verify that ALL features are implemented correctly before marking the requirement as completed. Every item must be objectively verifiable. It must be fully checked before closing the requirement.

## Functional Verification
- [ ] "设置" button is visible in the AppTitleBar next to "查看".
- [ ] Clicking "设置" opens the drawer from the right side.
- [ ] The drawer has a semi-transparent backdrop covering the main app.
- [ ] The drawer has an exit button on the top-left that closes it without saving.
- [ ] The drawer has a "保存" button on the bottom-right.
- [ ] Clicking "浏览..." opens a native OS folder selection dialog.
- [ ] Selecting a folder updates the displayed path in the drawer.
- [ ] Clicking "保存" applies the new path, refreshes the sidebar tree, and closes the drawer.
- [ ] Restarting the app persists the newly selected workspace path.

## Code Quality
- [ ] No new TypeScript type errors introduced.
- [ ] No new linting warnings introduced.
- [ ] Drawer CSS uses appropriate z-index and animations without breaking existing layout.

## Testing
- [ ] Manual smoke test on macOS/Windows target platforms passes.
