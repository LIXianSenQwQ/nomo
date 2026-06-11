# Superseded: Global SQLite connection for auxiliary data

Status: Superseded by `sdd/specs/replace-sqlite-with-json-config/`.

SQLite is no longer part of the active persistence architecture. The current implementation stores settings, window state, workspace tabs, recent entries, and document snapshots in the Tauri application data directory as `config.json`, managed by the Rust `ConfigManager`.

## Historical Context

Nomo uses SQLite only as the **辅助数据层** for recent entries, application preferences, document snapshots, and other local cache-like data. The Markdown file remains the primary document storage. To avoid repeated `Connection::open` cost on Windows, the Tauri backend manages one process-wide SQLite connection through `AppDatabase`.

The connection is stored in Tauri managed state, opened lazily, and preheated on a background thread during setup. All database operations run through the same `Mutex<Connection>` and are therefore serialized. This keeps the implementation small, avoids a connection-pool dependency, and removes per-IPC file-open overhead that made settings reads visibly slow.

If future snapshot, indexing, or cache workloads make serialized access a measurable bottleneck, this decision can be revisited with a connection pool or explicit read/write separation. Until then, the simpler single-connection model is the default.
