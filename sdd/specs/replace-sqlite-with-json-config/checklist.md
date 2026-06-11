# Verification Checklist: Replace SQLite With JSON Config

## Functional Verification
- [x] First startup without `config.json` creates a default JSON config in the Tauri application data/config directory.
- [x] Existing valid `config.json` loads successfully and missing fields are filled with defaults.
- [x] Malformed `config.json` is backed up as a broken config file and the app starts with defaults instead of white-screening.
- [ ] Changing theme persists after application restart.
- [ ] Changing editor font size persists after application restart.
- [ ] Recent files persist after application restart.
- [ ] Recent folders persist after application restart.
- [ ] Workspace tabs, active tab, and current folder persist after application restart.
- [ ] Window size and position persist after application restart.
- [ ] Multiple windows can update configuration without corrupting JSON.
- [x] Document snapshot save/read behavior remains equivalent or is explicitly verified as unused and removed.

## SQLite Removal
- [x] No source file opens, initializes, queries, migrates, or depends on SQLite.
- [x] `rusqlite` is removed from `src-tauri/Cargo.toml`.
- [x] `Cargo.lock` no longer retains `rusqlite` due to this project.
- [x] No runtime code references `nomo.sqlite`.
- [x] SQL table definitions and SQL query strings for old persistence are removed.

## Code Quality
- [x] Backend config code is isolated under a dedicated config module with clear responsibility boundaries.
- [x] Business code cannot directly mutate a bare shared config object.
- [x] All writes use temporary-file atomic save semantics.
- [x] No debug logs, commented-out code, or obsolete SQLite comments remain in production paths.

## Testing
- [x] Rust tests for config loading/defaulting/recovery/mapping pass where added.
- [x] TypeScript checks pass for frontend storage adapters and services.
- [x] Rust formatting and backend compile checks pass.
- [ ] Manual smoke test on the target desktop platform passes.
