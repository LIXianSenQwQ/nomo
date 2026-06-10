use crate::models::{
    RecentEntry, RecentEntryInput, RecentEntryType, SettingInput, SettingRecord, SnapshotInput,
    SnapshotRecord,
};
mod connection;

pub(crate) use connection::AppDatabase;

use rusqlite::{params, Connection};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Runtime};

const CURRENT_DATABASE_FILE: &str = "nomo.sqlite";

#[tauri::command]
pub(crate) fn remember_recent_entry(app: AppHandle, input: RecentEntryInput) -> Result<(), String> {
    let now = now_ts();
    let modified_at = if input.entry_type == RecentEntryType::File {
        crate::file_system::file_modified_at(&input.path)
    } else {
        0
    };
    let entry_type_str = input.entry_type.as_str();

    with_database(&app, |connection| {
        connection
            .execute(
                "INSERT INTO recent_entries(path, entry_type, title, modified_at, word_count, opened_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(path) DO UPDATE SET
                   entry_type = excluded.entry_type,
                   title = excluded.title,
                   modified_at = excluded.modified_at,
                   word_count = excluded.word_count,
                   opened_at = excluded.opened_at",
                params![
                    input.path,
                    entry_type_str,
                    input.title,
                    modified_at,
                    input.word_count,
                    now
                ],
            )
            .map_err(|error| format!("更新最近打开记录失败：{error}"))?;

        Ok(())
    })
}

#[tauri::command]
pub(crate) fn list_recent_entries(app: AppHandle) -> Result<Vec<RecentEntry>, String> {
    query_recent_entries_with_limit(&app, 20)
}

#[tauri::command]
pub(crate) fn clear_recent_entries(app: AppHandle) -> Result<(), String> {
    with_database(&app, |connection| {
        connection
            .execute("DELETE FROM recent_entries", [])
            .map_err(|error| format!("清除最近打开记录失败：{error}"))?;
        Ok(())
    })
}

#[tauri::command]
pub(crate) fn create_document_snapshot(app: AppHandle, input: SnapshotInput) -> Result<(), String> {
    let now = now_ts();
    let content_hash = hash_text(&input.markdown);
    let id = format!("{now}-{content_hash}");

    with_database(&app, |connection| {
        connection
            .execute(
                "INSERT INTO document_snapshots(id, document_path, content_hash, markdown, created_at, reason)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, input.path, content_hash, input.markdown, now, input.reason],
            )
            .map_err(|error| format!("创建历史快照失败：{error}"))?;

        Ok(())
    })
}

#[tauri::command]
pub(crate) fn list_document_snapshots(
    app: AppHandle,
    path: String,
) -> Result<Vec<SnapshotRecord>, String> {
    with_database(&app, |connection| {
        let mut statement = connection
            .prepare(
                "SELECT id, document_path, content_hash, markdown, created_at, reason
                 FROM document_snapshots
                 WHERE document_path = ?1
                 ORDER BY created_at DESC
                 LIMIT 20",
            )
            .map_err(|error| format!("读取历史快照失败：{error}"))?;

        let rows = statement
            .query_map([path], |row| {
                Ok(SnapshotRecord {
                    id: row.get(0)?,
                    document_path: row.get(1)?,
                    content_hash: row.get(2)?,
                    markdown: row.get(3)?,
                    created_at: row.get(4)?,
                    reason: row.get(5)?,
                })
            })
            .map_err(|error| format!("读取历史快照失败：{error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取历史快照失败：{error}"))
    })
}

#[tauri::command]
pub(crate) fn update_app_setting(app: AppHandle, input: SettingInput) -> Result<(), String> {
    let now = now_ts();

    with_database(&app, |connection| {
        connection
            .execute(
                "INSERT INTO app_settings(key, value_json, updated_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET
                   value_json = excluded.value_json,
                   updated_at = excluded.updated_at",
                params![input.key, input.value_json, now],
            )
            .map_err(|error| format!("保存设置失败：{error}"))?;

        Ok(())
    })
}

#[tauri::command]
pub(crate) fn update_app_settings(app: AppHandle, inputs: Vec<SettingInput>) -> Result<(), String> {
    if inputs.is_empty() {
        return Ok(());
    }

    with_database_mut(&app, |connection| {
        update_app_settings_in_connection(connection, inputs)
    })
}

fn update_app_settings_in_connection(
    connection: &mut Connection,
    inputs: Vec<SettingInput>,
) -> Result<(), String> {
    let now = now_ts();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("开始批量保存设置失败：{error}"))?;

    for input in inputs {
        transaction
            .execute(
                "INSERT INTO app_settings(key, value_json, updated_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET
                   value_json = excluded.value_json,
                   updated_at = excluded.updated_at",
                params![input.key, input.value_json, now],
            )
            .map_err(|error| format!("批量保存设置失败：{error}"))?;
    }

    transaction
        .commit()
        .map_err(|error| format!("提交批量保存设置失败：{error}"))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn list_app_settings(app: AppHandle) -> Result<Vec<SettingRecord>, String> {
    with_database(&app, |connection| {
        let mut statement = connection
            .prepare("SELECT key, value_json, updated_at FROM app_settings ORDER BY key")
            .map_err(|error| format!("读取设置失败：{error}"))?;

        let rows = statement
            .query_map([], |row| {
                Ok(SettingRecord {
                    key: row.get(0)?,
                    value_json: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            })
            .map_err(|error| format!("读取设置失败：{error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取设置失败：{error}"))
    })
}

pub(crate) fn query_recent_entries<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Vec<RecentEntry>, String> {
    query_recent_entries_with_limit(app, 8)
}

pub(crate) fn get_setting_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
) -> Result<Option<String>, String> {
    with_database(app, |connection| {
        let mut statement = connection
            .prepare("SELECT value_json FROM app_settings WHERE key = ?1")
            .map_err(|error| format!("读取设置失败：{error}"))?;
        let mut rows = statement
            .query([key])
            .map_err(|error| format!("读取设置失败：{error}"))?;

        if let Some(row) = rows
            .next()
            .map_err(|error| format!("读取设置失败：{error}"))?
        {
            Ok(Some(
                row.get(0)
                    .map_err(|error| format!("读取设置失败：{error}"))?,
            ))
        } else {
            Ok(None)
        }
    })
}

pub(crate) fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn with_database<R: Runtime, T>(
    app: &AppHandle<R>,
    operation: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let database = app
        .try_state::<AppDatabase>()
        .ok_or_else(|| "SQLite 长连接状态尚未初始化".to_string())?;
    database.with_connection(operation)
}

fn with_database_mut<R: Runtime, T>(
    app: &AppHandle<R>,
    operation: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
    let database = app
        .try_state::<AppDatabase>()
        .ok_or_else(|| "SQLite 长连接状态尚未初始化".to_string())?;
    database.with_connection_mut(operation)
}

fn database_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("定位应用数据目录失败：{error}"))?;
    fs::create_dir_all(&app_dir).map_err(|error| format!("创建应用数据目录失败：{error}"))?;
    Ok(app_dir.join(CURRENT_DATABASE_FILE))
}

fn init_database(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS recent_entries (
              path TEXT PRIMARY KEY,
              entry_type TEXT NOT NULL DEFAULT 'file',
              title TEXT,
              modified_at INTEGER DEFAULT 0,
              word_count INTEGER DEFAULT 0,
              opened_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS document_snapshots (
              id TEXT PRIMARY KEY,
              document_path TEXT NOT NULL,
              content_hash TEXT NOT NULL,
              markdown TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              reason TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value_json TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );
            ",
        )
        .map_err(|error| format!("初始化 SQLite 表失败：{error}"))?;

    // 迁移：旧 documents 表 -> recent_entries
    migrate_from_documents_table(connection)?;
    remove_deprecated_workspace_dir_setting(connection)?;

    Ok(())
}

fn remove_deprecated_workspace_dir_setting(connection: &Connection) -> Result<(), String> {
    connection
        .execute("DELETE FROM app_settings WHERE key = 'workspaceDir'", [])
        .map_err(|error| format!("清理旧工作区路径设置失败：{error}"))?;

    Ok(())
}

fn migrate_from_documents_table(connection: &Connection) -> Result<(), String> {
    let table_exists: bool = connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'documents'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !table_exists {
        return Ok(());
    }

    connection
        .execute(
            "INSERT OR IGNORE INTO recent_entries(path, entry_type, title, modified_at, word_count, opened_at)
             SELECT path, 'file', title, modified_at, word_count, opened_at FROM documents",
            [],
        )
        .map_err(|error| format!("迁移旧最近文件表失败：{error}"))?;

    connection
        .execute("DROP TABLE documents", [])
        .map_err(|error| format!("删除旧最近文件表失败：{error}"))?;

    Ok(())
}

fn query_recent_entries_with_limit<R: Runtime>(
    app: &AppHandle<R>,
    limit: i64,
) -> Result<Vec<RecentEntry>, String> {
    with_database(app, |connection| {
        let mut statement = connection
            .prepare(
                "SELECT path, entry_type, title, modified_at, word_count, opened_at
                 FROM recent_entries
                 ORDER BY opened_at DESC
                 LIMIT ?1",
            )
            .map_err(|error| format!("读取最近打开记录失败：{error}"))?;

        let rows = statement
            .query_map([limit], |row| {
                Ok(RecentEntry {
                    path: row.get(0)?,
                    entry_type: row.get(1)?,
                    title: row.get(2)?,
                    modified_at: row.get(3)?,
                    word_count: row.get(4)?,
                    opened_at: row.get(5)?,
                })
            })
            .map_err(|error| format!("读取最近打开记录失败：{error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取最近打开记录失败：{error}"))
    })
}

fn hash_text(text: &str) -> String {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::{init_database, update_app_settings_in_connection, AppDatabase};
    use crate::models::SettingInput;
    use rusqlite::Connection;
    use std::{fs, path::PathBuf};

    #[test]
    fn initializes_current_database_tables() {
        let root = unique_test_dir("current-init");
        fs::create_dir_all(&root).expect("test dir");
        let db_path = root.join("nomo.sqlite");
        let connection = Connection::open(&db_path).expect("current sqlite");

        init_database(&connection).expect("init database");

        let table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('recent_entries', 'document_snapshots', 'app_settings')",
                [],
                |row| row.get(0),
            )
            .expect("table count");

        assert_eq!(table_count, 3);
        cleanup(root);
    }

    #[test]
    fn app_database_initializes_current_database_tables_on_first_access() {
        let root = unique_test_dir("manager-init");
        fs::create_dir_all(&root).expect("test dir");
        let db_path = root.join("nomo.sqlite");
        let database = AppDatabase::new(db_path);

        database
            .with_connection(|connection| {
                let table_count: i64 = connection
                    .query_row(
                        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('recent_entries', 'document_snapshots', 'app_settings')",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|error| error.to_string())?;
                assert_eq!(table_count, 3);
                Ok(())
            })
            .expect("first managed access");

        cleanup(root);
    }

    #[test]
    fn app_database_reuses_the_same_connection() {
        let root = unique_test_dir("manager-reuse");
        fs::create_dir_all(&root).expect("test dir");
        let db_path = root.join("nomo.sqlite");
        let database = AppDatabase::new(db_path);

        database
            .with_connection(|connection| {
                connection
                    .execute("CREATE TEMP TABLE connection_marker(value TEXT)", [])
                    .map_err(|error| error.to_string())?;
                connection
                    .execute("INSERT INTO connection_marker(value) VALUES ('same')", [])
                    .map_err(|error| error.to_string())?;
                Ok(())
            })
            .expect("create temp marker");

        database
            .with_connection(|connection| {
                let marker: String = connection
                    .query_row("SELECT value FROM connection_marker", [], |row| row.get(0))
                    .map_err(|error| error.to_string())?;
                assert_eq!(marker, "same");
                Ok(())
            })
            .expect("read temp marker");

        cleanup(root);
    }

    #[test]
    fn app_database_retries_after_warm_up_failure() {
        let root = unique_test_dir("manager-retry");
        fs::create_dir_all(&root).expect("test dir");
        let db_path = root.join("nomo.sqlite");
        fs::create_dir_all(&db_path).expect("directory occupying database path");
        let database = AppDatabase::new(db_path.clone());

        assert!(database.warm_up().is_err());
        fs::remove_dir_all(&db_path).expect("release database path");

        database
            .with_connection(|connection| {
                let key_column_count: i64 = connection
                    .query_row(
                        "SELECT COUNT(*) FROM pragma_table_info('app_settings') WHERE name = 'key'",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|error| error.to_string())?;
                assert_eq!(key_column_count, 1);
                Ok(())
            })
            .expect("retry managed connection");

        cleanup(root);
    }

    #[test]
    fn batch_updates_settings_in_one_transaction() {
        let root = unique_test_dir("settings-batch");
        fs::create_dir_all(&root).expect("test dir");
        let db_path = root.join("nomo.sqlite");
        let mut connection = Connection::open(&db_path).expect("current sqlite");
        init_database(&connection).expect("init database");

        update_app_settings_in_connection(
            &mut connection,
            vec![
                SettingInput {
                    key: "theme".to_string(),
                    value_json: "\"dark\"".to_string(),
                },
                SettingInput {
                    key: "fontSize".to_string(),
                    value_json: "18".to_string(),
                },
            ],
        )
        .expect("batch settings");

        let theme: String = connection
            .query_row(
                "SELECT value_json FROM app_settings WHERE key = 'theme'",
                [],
                |row| row.get(0),
            )
            .expect("theme setting");
        let font_size: String = connection
            .query_row(
                "SELECT value_json FROM app_settings WHERE key = 'fontSize'",
                [],
                |row| row.get(0),
            )
            .expect("font size setting");

        assert_eq!(theme, "\"dark\"");
        assert_eq!(font_size, "18");
        cleanup(root);
    }

    fn unique_test_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("nomo-db-{name}-{}", crate::database::now_ts()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn cleanup(path: PathBuf) {
        let _ = fs::remove_dir_all(path);
    }
}
