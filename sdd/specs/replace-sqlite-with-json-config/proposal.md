# Proposal: Replace SQLite With JSON Config

## 1. Context & Problem Statement
- **Current State**: The Tauri backend stores application settings, workspace tabs, window state, recent entries, and document snapshots in `nomo.sqlite` through the Rust `database` module and `rusqlite`.
- **Pain Points**: SQLite is heavier than the current lightweight Markdown editor needs, makes configuration less transparent, and couples simple user preferences to database initialization and schema management.
- **Scope Shift**: Existing SQLite data does not need migration or compatibility handling. The application can remove SQLite persistence directly and recreate state from JSON defaults.

## 2. Value Proposition
- Simplifies persistence by replacing database tables with a single human-readable `config.json` in the Tauri application data directory.
- Reduces backend dependency surface by removing `rusqlite`, SQLite schema creation, and migration code.
- Keeps persistence behavior intact for settings, workspace state, window state, recent entries, and related desktop integration.
- Improves resilience by adding default recovery, broken config backup, and atomic JSON writes.

## 3. Alternatives Considered
- **Keep SQLite and wrap it better**: Rejected because the product goal explicitly requires removing SQLite rather than hiding it behind a repository abstraction.
- **Use multiple JSON files**: Rejected for the initial implementation because one `config.json` with module sections is easier to reason about and backup.
- **Use TOML/YAML**: Rejected because the requirement mandates JSON only.
- **Use frontend localStorage**: Rejected for desktop persistence because native menu, tray, window, i18n, and multi-window flows need backend-readable state.

## 4. Success Metrics
- [ ] No source dependency on SQLite, `rusqlite`, SQL migrations, or SQLite connection management remains.
- [ ] First launch creates a valid default `config.json` under the Tauri application data directory.
- [ ] Settings, workspace tabs, window state, recent entries, and document snapshots continue to persist across restarts.
- [ ] Corrupted `config.json` is backed up and replaced with defaults without causing a white screen or startup failure.
- [ ] Concurrent backend calls cannot leave a partially written JSON file.
