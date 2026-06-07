use crate::models::{
    RecentEntry, RecentEntryInput, RecentEntryType, SettingInput, SettingRecord, SnapshotInput,
    SnapshotRecord,
};
use rusqlite::{params, Connection};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Runtime};

const CURRENT_DATABASE_FILE: &str = "nomo.sqlite";
const LEGACY_DATABASE_FILE: &str = "newmd.sqlite";
const LEGACY_IDENTIFIER_DIR: &str = "com.newmd.desktop";
const LEGACY_PRODUCT_DIR: &str = "NewMd";

#[tauri::command]
pub(crate) fn remember_recent_entry(app: AppHandle, input: RecentEntryInput) -> Result<(), String> {
    let connection = open_database(&app)?;
    let now = now_ts();
    let modified_at = if input.entry_type == RecentEntryType::File {
        crate::file_system::file_modified_at(&input.path)
    } else {
        0
    };
    let entry_type_str = input.entry_type.as_str();

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
}

#[tauri::command]
pub(crate) fn list_recent_entries(app: AppHandle) -> Result<Vec<RecentEntry>, String> {
    query_recent_entries_with_limit(&app, 20)
}

#[tauri::command]
pub(crate) fn clear_recent_entries(app: AppHandle) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute("DELETE FROM recent_entries", [])
        .map_err(|error| format!("清除最近打开记录失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) fn create_document_snapshot(app: AppHandle, input: SnapshotInput) -> Result<(), String> {
    let connection = open_database(&app)?;
    let now = now_ts();
    let content_hash = hash_text(&input.markdown);
    let id = format!("{now}-{content_hash}");

    connection
        .execute(
            "INSERT INTO document_snapshots(id, document_path, content_hash, markdown, created_at, reason)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, input.path, content_hash, input.markdown, now, input.reason],
        )
        .map_err(|error| format!("创建历史快照失败：{error}"))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn list_document_snapshots(
    app: AppHandle,
    path: String,
) -> Result<Vec<SnapshotRecord>, String> {
    let connection = open_database(&app)?;
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
}

#[tauri::command]
pub(crate) fn update_app_setting(app: AppHandle, input: SettingInput) -> Result<(), String> {
    let connection = open_database(&app)?;
    let now = now_ts();

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
}

#[tauri::command]
pub(crate) fn list_app_settings(app: AppHandle) -> Result<Vec<SettingRecord>, String> {
    let connection = open_database(&app)?;
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
}

pub(crate) fn open_database<R: Runtime>(app: &AppHandle<R>) -> Result<Connection, String> {
    let db_path = database_path(app)?;
    let connection =
        Connection::open(db_path).map_err(|error| format!("打开 SQLite 失败：{error}"))?;
    init_database(&connection)?;
    Ok(connection)
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
    let connection = open_database(app)?;
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
}

pub(crate) fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn database_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("定位应用数据目录失败：{error}"))?;
    fs::create_dir_all(&app_dir).map_err(|error| format!("创建应用数据目录失败：{error}"))?;
    let db_path = app_dir.join(CURRENT_DATABASE_FILE);
    migrate_legacy_database_if_needed(&app_dir, &db_path)?;
    Ok(db_path)
}

fn migrate_legacy_database_if_needed(app_dir: &Path, db_path: &Path) -> Result<(), String> {
    if db_path.exists() {
        return Ok(());
    }

    for legacy_path in legacy_database_candidates(app_dir) {
        if legacy_path.exists() {
            // 只复制旧库，不删除旧数据；已有 Nomo 数据库时也不会覆盖，避免误伤用户数据。
            fs::copy(&legacy_path, db_path).map_err(|error| {
                format!(
                    "迁移旧版数据库失败（{} -> {}）：{error}",
                    legacy_path.display(),
                    db_path.display()
                )
            })?;
            return Ok(());
        }
    }

    Ok(())
}

fn legacy_database_candidates(app_dir: &Path) -> Vec<PathBuf> {
    let Some(parent_dir) = app_dir.parent() else {
        return Vec::new();
    };

    vec![
        parent_dir
            .join(LEGACY_IDENTIFIER_DIR)
            .join(LEGACY_DATABASE_FILE),
        parent_dir
            .join(LEGACY_PRODUCT_DIR)
            .join(LEGACY_DATABASE_FILE),
    ]
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
    let connection = open_database(app)?;
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
}

fn hash_text(text: &str) -> String {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::{
        init_database, legacy_database_candidates, migrate_legacy_database_if_needed,
        CURRENT_DATABASE_FILE, LEGACY_DATABASE_FILE, LEGACY_IDENTIFIER_DIR, LEGACY_PRODUCT_DIR,
    };
    use rusqlite::Connection;
    use std::{fs, path::PathBuf};

    #[test]
    fn migrates_legacy_identifier_database_when_current_database_is_missing() {
        let root = unique_test_dir("legacy-identifier");
        let app_dir = root.join("com.nomo.desktop");
        let legacy_dir = root.join(LEGACY_IDENTIFIER_DIR);
        fs::create_dir_all(&app_dir).expect("app dir");
        fs::create_dir_all(&legacy_dir).expect("legacy dir");
        fs::write(legacy_dir.join(LEGACY_DATABASE_FILE), b"legacy-db").expect("legacy db");

        let db_path = app_dir.join(CURRENT_DATABASE_FILE);
        migrate_legacy_database_if_needed(&app_dir, &db_path).expect("migration");

        assert_eq!(fs::read(&db_path).expect("current db"), b"legacy-db");
        cleanup(root);
    }

    #[test]
    fn does_not_overwrite_existing_current_database() {
        let root = unique_test_dir("no-overwrite");
        let app_dir = root.join("com.nomo.desktop");
        let legacy_dir = root.join(LEGACY_IDENTIFIER_DIR);
        fs::create_dir_all(&app_dir).expect("app dir");
        fs::create_dir_all(&legacy_dir).expect("legacy dir");
        fs::write(app_dir.join(CURRENT_DATABASE_FILE), b"current-db").expect("current db");
        fs::write(legacy_dir.join(LEGACY_DATABASE_FILE), b"legacy-db").expect("legacy db");

        let db_path = app_dir.join(CURRENT_DATABASE_FILE);
        migrate_legacy_database_if_needed(&app_dir, &db_path).expect("migration");

        assert_eq!(fs::read(&db_path).expect("current db"), b"current-db");
        cleanup(root);
    }

    #[test]
    fn leaves_current_database_missing_when_no_legacy_database_exists() {
        let root = unique_test_dir("no-legacy");
        let app_dir = root.join("com.nomo.desktop");
        fs::create_dir_all(&app_dir).expect("app dir");

        let db_path = app_dir.join(CURRENT_DATABASE_FILE);
        migrate_legacy_database_if_needed(&app_dir, &db_path).expect("migration");

        assert!(!db_path.exists());
        cleanup(root);
    }

    #[test]
    fn initializes_tables_after_legacy_database_migration() {
        let root = unique_test_dir("init-after-migration");
        let app_dir = root.join("com.nomo.desktop");
        let legacy_dir = root.join(LEGACY_IDENTIFIER_DIR);
        fs::create_dir_all(&app_dir).expect("app dir");
        fs::create_dir_all(&legacy_dir).expect("legacy dir");
        let legacy_path = legacy_dir.join(LEGACY_DATABASE_FILE);
        Connection::open(&legacy_path).expect("legacy sqlite");

        let db_path = app_dir.join(CURRENT_DATABASE_FILE);
        migrate_legacy_database_if_needed(&app_dir, &db_path).expect("migration");
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
    fn includes_legacy_product_name_candidate_after_identifier_candidate() {
        let root = unique_test_dir("candidates");
        let app_dir = root.join("com.nomo.desktop");
        fs::create_dir_all(&app_dir).expect("app dir");

        let candidates = legacy_database_candidates(&app_dir);

        assert_eq!(
            candidates,
            vec![
                root.join(LEGACY_IDENTIFIER_DIR).join(LEGACY_DATABASE_FILE),
                root.join(LEGACY_PRODUCT_DIR).join(LEGACY_DATABASE_FILE),
            ]
        );
        cleanup(root);
    }

    fn unique_test_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "nomo-db-migration-{name}-{}",
            crate::database::now_ts()
        ));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn cleanup(path: PathBuf) {
        let _ = fs::remove_dir_all(path);
    }
}
