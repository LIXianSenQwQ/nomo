# Task Breakdown & Execution Board: Replace SQLite With JSON Config

## Phase 1: Audit & Data Model
- [x] Task 1.1: Confirm all SQLite usage points from `src-tauri/src/database`, `src-tauri/src/lib.rs`, `src-tauri/src/window`, `src-tauri/src/i18n.rs`, and frontend storage services.
- [x] Task 1.2: Define backend `AppConfig` sections and defaults for app, editor, window, recent, workspace, and snapshots.
- [x] Task 1.3: Define key mapping helpers that convert existing `app_settings` keys to structured JSON sections and back to `SettingRecord[]`.

## Phase 2: ConfigManager Core
- [x] Task 2.1: Add `src-tauri/src/config/` module with `AppConfig`, `ConfigManager`, load/default/recovery logic, and atomic save.
- [x] Task 2.2: Add thread-safe update APIs using managed Tauri state and lock-protected in-memory config.
- [x] Task 2.3: Add focused Rust tests for default creation, missing-field defaulting, broken JSON recovery, and setting key mapping where practical.

## Phase 3: Backend Command Replacement
- [x] Task 3.1: Replace settings commands (`list_app_settings`, `update_app_setting`, `update_app_settings`) with JSON-backed implementations.
- [x] Task 3.2: Replace recent entry commands and native menu recent lookup with JSON-backed implementations.
- [x] Task 3.3: Replace snapshot commands with JSON-backed implementations.
- [x] Task 3.4: Replace window state persistence with `ConfigManager`.
- [x] Task 3.5: Replace tray close behavior, i18n language lookup, pending folder, and pending external-open state with `ConfigManager`.
- [x] Task 3.6: Update `src-tauri/src/lib.rs` setup and invoke registration to manage `ConfigManager` instead of `AppDatabase`.

## Phase 4: Frontend Integration
- [x] Task 4.1: Keep or adapt `src/lib/desktop/tauriStorage.ts` so existing app services continue to receive equivalent data shapes.
- [x] Task 4.2: Verify `src/app/services/settings.ts` loads and saves preferences through the JSON-backed commands.
- [x] Task 4.3: Verify `src/app/App.svelte` workspace state save/restore behavior remains unchanged.
- [x] Task 4.4: Verify document file services continue to remember recent entries and use snapshots correctly.

## Phase 5: SQLite Removal
- [x] Task 5.1: Delete SQLite connection management, schema creation, migration code, and obsolete database tests.
- [x] Task 5.2: Remove `rusqlite` from `src-tauri/Cargo.toml` and refresh `Cargo.lock`.
- [x] Task 5.3: Remove or rename source references to SQLite, `nomo.sqlite`, SQL queries, and SQLite-specific errors.

## Phase 6: Verification
- [x] Task 6.1: Run TypeScript diagnostics/build checks relevant to frontend storage changes.
- [x] Task 6.2: Run Rust formatting, tests, and Tauri backend compile checks.
- [x] Task 6.3: Verify first launch creates `config.json` through backend unit coverage.
- [ ] Task 6.4: Manually verify restart persistence for theme, editor font size, recent files, recent folders, workspace tabs, and window state.
- [x] Task 6.5: Verify malformed `config.json` recovery through backend unit coverage.

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.2]
- [Task 2.1] depends on [Task 1.2]
- [Task 2.2] depends on [Task 2.1]
- [Task 2.3] depends on [Task 2.1] and [Task 1.3]
- [Task 3.1], [Task 3.2], [Task 3.3], [Task 3.4], and [Task 3.5] depend on [Task 2.2]
- [Task 3.6] depends on [Task 3.1], [Task 3.2], [Task 3.3], [Task 3.4], and [Task 3.5]
- [Task 4.1], [Task 4.2], [Task 4.3], and [Task 4.4] depend on [Task 3.6]
- [Task 5.1] depends on [Task 3.6]
- [Task 5.2] depends on [Task 5.1]
- [Task 5.3] depends on [Task 5.2]
- [Task 6.1] and [Task 6.2] depend on [Task 5.3]
- [Task 6.3], [Task 6.4], and [Task 6.5] depend on [Task 6.1] and [Task 6.2]
- [Task 3.1], [Task 3.2], and [Task 3.3] can run in parallel after [Task 2.2]
