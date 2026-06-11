---
id: "replace-sqlite-with-json-config"
kind: feature
parent: ""
status: in_progress
impact_radius:
  - "src-tauri/src/database"
  - "src-tauri/src/config"
  - "src-tauri/src/window"
  - "src-tauri/src/i18n.rs"
  - "src/lib/desktop/tauriStorage.ts"
  - "src/app/services/settings.ts"
  - "src/app/App.svelte"
dependencies:
  - "none"
key_results: []
---

# Specification: Replace SQLite With JSON Config

## 1. Scope
- **In Scope**: Remove SQLite-backed persistence, introduce JSON-backed `ConfigManager`, preserve persistence for settings, workspace tabs, window state, recent entries, document snapshots, tray close behavior, i18n language, and external-open pending state.
- **In Scope**: Store `config.json` in the existing Tauri application data/config directory mechanism without hardcoded OS paths.
- **In Scope**: Ensure default creation, missing-field defaulting, broken-file backup, and atomic writes.
- **In Scope**: Remove `rusqlite`, SQLite connection pooling, SQL schema/migration code, and SQLite runtime initialization.
- **Out of Scope**: Migrating old `nomo.sqlite` data into `config.json`.
- **Out of Scope**: Introducing TOML, YAML, a new database, or frontend direct file access.
- **Out of Scope**: Redesigning editor UI or changing product behavior unrelated to persistence.

## 2. Functional Requirements

### ADDED
#### Requirement: JSON Configuration Store
The system SHALL persist application configuration in a single JSON file named `config.json` under the Tauri application data/config directory.

##### Scenario: First Launch
- **WHEN** the application starts and `config.json` does not exist
- **THEN** the backend creates the directory if needed, writes default configuration, and continues startup successfully

##### Scenario: Existing Config
- **WHEN** the application starts and `config.json` exists
- **THEN** the backend loads it into memory and uses it as the source of persisted configuration

#### Requirement: Global Config Manager
The system SHALL expose a backend `ConfigManager` that owns config loading, in-memory access, mutation, and saving.

##### Scenario: Business Code Reads Config
- **WHEN** backend business code needs settings, recent entries, window state, or workspace state
- **THEN** it reads through `ConfigManager` or typed helper functions instead of direct file IO or SQL

##### Scenario: Business Code Updates Config
- **WHEN** backend business code mutates persisted state
- **THEN** it uses a typed update API that locks the in-memory config and saves through the manager

#### Requirement: Atomic JSON Writes
The system SHALL write configuration atomically by writing pretty JSON to a temporary file, flushing/syncing it, and renaming it to `config.json`.

##### Scenario: Process Interruption During Save
- **WHEN** the process is interrupted while writing a config update
- **THEN** the application must not leave a partially written `config.json`

#### Requirement: Corruption Recovery
The system SHALL recover from malformed JSON by backing up the broken config file and recreating defaults.

##### Scenario: Broken Config
- **WHEN** `config.json` contains malformed JSON
- **THEN** the backend renames it to a broken backup file, writes default config, logs the recovery, and avoids frontend white screen

#### Requirement: Thread-Safe Multi-Window Access
The system SHALL serialize mutations and protect reads/writes for multi-window and asynchronous backend access.

##### Scenario: Concurrent Updates
- **WHEN** multiple windows update settings or window state around the same time
- **THEN** writes are lock-protected and the final JSON remains valid

#### Requirement: Recent Entries Persistence
The system SHALL preserve recent file and folder behavior without SQLite.

##### Scenario: Remember Recent Entry
- **WHEN** a user opens or saves a local document or folder
- **THEN** the backend updates `recent.entries`, keeps newest ordering semantics, and the native recent menu can render it

##### Scenario: Clear Recent Entries
- **WHEN** the user clears recent entries
- **THEN** `recent.entries` becomes empty and persists across restart

#### Requirement: Workspace State Persistence
The system SHALL preserve per-window `WorkspaceState` persistence without SQLite.

##### Scenario: Restore Workspace
- **WHEN** the app restarts
- **THEN** the frontend can restore tabs, active tab, and current folder path from JSON-backed settings

#### Requirement: Window State Persistence
The system SHALL preserve per-window size and position without SQLite.

##### Scenario: Move Or Resize Window
- **WHEN** a window is moved or resized
- **THEN** the backend stores the latest state in JSON and can restore it on next launch

#### Requirement: Editor And App Preferences Persistence
The system SHALL preserve theme, editor font size, line height, content width, block style, close behavior, tray behavior, and interface language without SQLite.

##### Scenario: Update Theme
- **WHEN** the user changes the theme
- **THEN** the setting is saved to JSON and survives restart

##### Scenario: Update Editor Font Size
- **WHEN** the user changes editor font size
- **THEN** the setting is saved to JSON and survives restart

#### Requirement: Document Snapshot Persistence
The system SHALL either preserve document snapshot read/write behavior in JSON or explicitly remove the feature only if no active caller needs it.

##### Scenario: Snapshot Saved
- **WHEN** a document snapshot is saved
- **THEN** it is written to the JSON config snapshot section and can be read back by path

### MODIFIED
#### Requirement: Tauri Storage Commands
Existing frontend-facing Tauri commands for settings, recent entries, snapshots, and window state SHALL be backed by `ConfigManager` instead of SQLite.

##### Scenario: Existing Frontend Call
- **WHEN** frontend code calls `list_app_settings`, `update_app_setting`, `list_recent_entries`, or similar existing storage commands
- **THEN** the command returns equivalent data shape unless a deliberate typed API replacement is documented in `tasks.md`

### REMOVED
#### Requirement: SQLite Persistence
**Reason**: The product now requires JSON text configuration instead of database persistence.
**Migration**: No data migration is required. Old SQLite files may remain on disk but must no longer be created, opened, queried, or required by source code.
