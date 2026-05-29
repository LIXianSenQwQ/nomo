use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Runtime, WindowEvent,
};

#[derive(Debug, Serialize)]
struct DocumentPayload {
    path: String,
    file_name: String,
    markdown: String,
    modified_at: i64,
    size_bytes: i64,
    readonly: bool,
}

#[derive(Debug, Serialize)]
struct RecentDocument {
    path: String,
    title: Option<String>,
    modified_at: i64,
    word_count: i64,
    opened_at: i64,
}

#[derive(Debug, Deserialize)]
struct RecentFileInput {
    path: String,
    title: Option<String>,
    word_count: i64,
}

#[derive(Debug, Deserialize)]
struct SnapshotInput {
    path: String,
    markdown: String,
    reason: String,
}

#[derive(Debug, Serialize)]
struct SnapshotRecord {
    id: String,
    document_path: String,
    content_hash: String,
    markdown: String,
    created_at: i64,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct SettingInput {
    key: String,
    value_json: String,
}

#[derive(Debug, Serialize)]
struct SettingRecord {
    key: String,
    value_json: String,
    updated_at: i64,
}

#[derive(Debug, Serialize)]
struct FileStatus {
    path: String,
    exists: bool,
    is_file: bool,
    modified_at: i64,
    size_bytes: i64,
    readonly: bool,
}

#[derive(Debug, Deserialize, Serialize)]
struct WindowStateInput {
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
}

#[tauri::command]
fn read_markdown_file(path: String) -> Result<DocumentPayload, String> {
    let status = file_status(&path);
    if !status.exists {
        return Err(format!("文件不存在：{path}"));
    }
    if !status.is_file {
        return Err(format!("路径不是文件：{path}"));
    }

    let markdown = fs::read_to_string(&path).map_err(|error| format!("读取 Markdown 文件失败：{error}"))?;
    document_payload(path, markdown)
}

#[tauri::command]
fn write_markdown_file(path: String, markdown: String) -> Result<DocumentPayload, String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            return Err(format!("保存目录不存在：{}", parent.display()));
        }
    }

    fs::write(&path, markdown.as_bytes()).map_err(|error| format!("保存 Markdown 文件失败：{error}"))?;
    document_payload(path, markdown)
}

#[tauri::command]
fn stat_markdown_file(path: String) -> FileStatus {
    file_status(&path)
}

#[tauri::command]
fn remember_recent_file(app: AppHandle, input: RecentFileInput) -> Result<(), String> {
    let connection = open_database(&app)?;
    let now = now_ts();
    let modified_at = file_modified_at(&input.path);

    connection
        .execute(
            "INSERT INTO documents(path, title, modified_at, word_count, opened_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path) DO UPDATE SET
               title = excluded.title,
               modified_at = excluded.modified_at,
               word_count = excluded.word_count,
               opened_at = excluded.opened_at",
            params![input.path, input.title, modified_at, input.word_count, now],
        )
        .map_err(|error| format!("更新最近文件失败：{error}"))?;

    Ok(())
}

#[tauri::command]
fn list_recent_files(app: AppHandle) -> Result<Vec<RecentDocument>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT path, title, modified_at, word_count, opened_at
             FROM documents
             ORDER BY opened_at DESC
             LIMIT 20",
        )
        .map_err(|error| format!("读取最近文件失败：{error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(RecentDocument {
                path: row.get(0)?,
                title: row.get(1)?,
                modified_at: row.get(2)?,
                word_count: row.get(3)?,
                opened_at: row.get(4)?,
            })
        })
        .map_err(|error| format!("读取最近文件失败：{error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取最近文件失败：{error}"))
}

#[tauri::command]
fn create_document_snapshot(app: AppHandle, input: SnapshotInput) -> Result<(), String> {
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
fn list_document_snapshots(app: AppHandle, path: String) -> Result<Vec<SnapshotRecord>, String> {
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
fn update_app_setting(app: AppHandle, input: SettingInput) -> Result<(), String> {
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
fn list_app_settings(app: AppHandle) -> Result<Vec<SettingRecord>, String> {
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

#[tauri::command]
fn update_window_state(app: AppHandle, input: WindowStateInput) -> Result<(), String> {
    update_app_setting(
        app,
        SettingInput {
            key: "windowState".to_string(),
            value_json: serde_json::to_string(&input).map_err(|error| format!("序列化窗口状态失败：{error}"))?,
        },
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                persist_current_window_state(window);
            }
            _ => {}
        })
        .setup(|app| {
            restore_window_state(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_markdown_file,
            write_markdown_file,
            stat_markdown_file,
            remember_recent_file,
            list_recent_files,
            create_document_snapshot,
            list_document_snapshots,
            update_app_setting,
            list_app_settings,
            update_window_state,
            list_folder_markdown_files,
            create_new_window,
            minimize_window,
            maximize_window,
            close_window,
            get_folder_tree
        ])
        .run(tauri::generate_context!())
        .expect("error while running NewMd");
}

fn document_payload(path: String, markdown: String) -> Result<DocumentPayload, String> {
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled.md")
        .to_string();

    Ok(DocumentPayload {
        modified_at: file_modified_at(&path),
        size_bytes: file_size(&path),
        readonly: file_readonly(&path),
        path,
        file_name,
        markdown,
    })
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let db_path = database_path(app)?;
    let connection = Connection::open(db_path).map_err(|error| format!("打开 SQLite 失败：{error}"))?;
    init_database(&connection)?;
    Ok(connection)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("定位应用数据目录失败：{error}"))?;
    fs::create_dir_all(&app_dir).map_err(|error| format!("创建应用数据目录失败：{error}"))?;
    Ok(app_dir.join("newmd.sqlite"))
}

fn init_database(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS documents (
              path TEXT PRIMARY KEY,
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
        .map_err(|error| format!("初始化 SQLite 表失败：{error}"))
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn file_modified_at(path: &str) -> i64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

fn hash_text(text: &str) -> String {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn file_status(path: &str) -> FileStatus {
    let metadata = fs::metadata(path);

    FileStatus {
        path: path.to_string(),
        exists: Path::new(path).exists(),
        is_file: metadata.as_ref().map(|value| value.is_file()).unwrap_or(false),
        modified_at: file_modified_at(path),
        size_bytes: metadata.as_ref().map(|value| value.len() as i64).unwrap_or_default(),
        readonly: metadata
            .as_ref()
            .map(|value| value.permissions().readonly())
            .unwrap_or(false),
    }
}

fn file_size(path: &str) -> i64 {
    fs::metadata(path)
        .map(|metadata| metadata.len() as i64)
        .unwrap_or_default()
}

fn file_readonly(path: &str) -> bool {
    fs::metadata(path)
        .map(|metadata| metadata.permissions().readonly())
        .unwrap_or(false)
}

fn open_database_helper<R: Runtime>(app: &AppHandle<R>) -> Result<Connection, String> {
    let db_path = database_path_helper(app)?;
    let connection = Connection::open(db_path).map_err(|error| format!("打开 SQLite 失败：{error}"))?;
    init_database(&connection)?;
    Ok(connection)
}

fn database_path_helper<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("定位应用数据目录失败：{error}"))?;
    fs::create_dir_all(&app_dir).map_err(|error| format!("创建应用数据目录失败：{error}"))?;
    Ok(app_dir.join("newmd.sqlite"))
}

fn query_recent_files<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<RecentDocument>, String> {
    let connection = open_database_helper(app)?;
    let mut statement = connection
        .prepare(
            "SELECT path, title, modified_at, word_count, opened_at
             FROM documents
             ORDER BY opened_at DESC
             LIMIT 8",
        )
        .map_err(|error| format!("读取最近文件失败：{error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(RecentDocument {
                path: row.get(0)?,
                title: row.get(1)?,
                modified_at: row.get(2)?,
                word_count: row.get(3)?,
                opened_at: row.get(4)?,
            })
        })
        .map_err(|error| format!("读取最近文件失败：{error}"))?;

    let mut list = Vec::new();
    for row in rows {
        if let Ok(doc) = row {
            list.push(doc);
        }
    }
    Ok(list)
}

fn build_window_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Menu<R>, String> {
    let recent_docs = query_recent_files(app).unwrap_or_default();

    let mut file_menu_builder = SubmenuBuilder::new(app, "文件(&F)")
        .item(&MenuItemBuilder::with_id("new-file", "新建(&N)").accelerator("Ctrl+N").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("new-window", "新建窗口(&W)").accelerator("Ctrl+Shift+N").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("open-file", "打开(&O)...").accelerator("Ctrl+O").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("open-directory", "打开文件夹...").accelerator("Ctrl+Shift+O").build(app).map_err(|e| e.to_string())?);

    if !recent_docs.is_empty() {
        let mut recent_submenu_builder = SubmenuBuilder::new(app, "打开最近");
        for doc in recent_docs.iter().take(8) {
            let label = doc.title.clone().unwrap_or_else(|| {
                Path::new(&doc.path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("未命名.md")
                    .to_string()
            });
            let item_id = format!("recent-file:{}", doc.path);
            recent_submenu_builder = recent_submenu_builder.item(
                &MenuItemBuilder::with_id(item_id, label)
                    .build(app)
                    .map_err(|e| e.to_string())?
            );
        }
        let recent_submenu = recent_submenu_builder.build().map_err(|e| e.to_string())?;
        file_menu_builder = file_menu_builder.item(&recent_submenu);
    } else {
        let placeholder = MenuItemBuilder::with_id("no-recent", "暂无最近文件")
            .enabled(false)
            .build(app)
            .map_err(|e| e.to_string())?;
        file_menu_builder = file_menu_builder.item(&placeholder);
    }

    let file_menu = file_menu_builder
        .separator()
        .item(&MenuItemBuilder::with_id("save-file", "保存(&S)").accelerator("Ctrl+S").build(app).map_err(|e| e.to_string())?)
        .item(
            &MenuItemBuilder::with_id("save-file-as", "另存为(&A)...")
                .accelerator("Ctrl+Shift+S")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("quit", "退出(&X)").accelerator("Alt+F4").build(app).map_err(|e| e.to_string())?)
        .build()
        .map_err(|e| e.to_string())?;

    let edit_menu = SubmenuBuilder::new(app, "编辑(&E)")
        .item(&MenuItemBuilder::with_id("undo", "撤销(&U)").accelerator("Ctrl+Z").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("redo", "重做(&R)").accelerator("Ctrl+Y").build(app).map_err(|e| e.to_string())?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .map_err(|e| e.to_string())?;

    let view_menu = SubmenuBuilder::new(app, "查看(&V)")
        .item(
            &MenuItemBuilder::with_id("toggle-source", "切换源码模式")
                .accelerator("Ctrl+E")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-theme", "切换主题")
                .accelerator("Ctrl+Shift+L")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-focus", "切换专注模式")
                .accelerator("Ctrl+Shift+F")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(menu)
}

#[tauri::command]
fn refresh_window_menu(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    let menu = build_window_menu(&app).map_err(|error| format!("构建菜单失败：{error}"))?;
    window.set_menu(menu).map_err(|error| format!("设置菜单失败：{error}"))?;
    Ok(())
}

#[tauri::command]
fn create_new_window(app: AppHandle) -> Result<(), String> {
    let id = format!("window-{}", now_ts());
    let _window = tauri::WebviewWindowBuilder::new(&app, &id, tauri::WebviewUrl::App("index.html".into()))
        .title("NewMd")
        .inner_size(1180.0, 760.0)
        .min_inner_size(920.0, 640.0)
        .build()
        .map_err(|error| format!("创建新窗口失败：{error}"))?;

    Ok(())
}

#[derive(Debug, Serialize)]
struct FolderFileInfo {
    name: String,
    path: String,
}

#[tauri::command]
fn list_folder_markdown_files(path: String) -> Result<Vec<FolderFileInfo>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("不是一个有效的目录：{path}"));
    }
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).map_err(|error| format!("读取目录失败：{error}"))? {
        let entry = entry.map_err(|error| format!("读取目录项失败：{error}"))?;
        let path_buf = entry.path();
        if path_buf.is_file() {
            if let Some(extension) = path_buf.extension().and_then(|ext| ext.to_str()) {
                let ext = extension.to_lowercase();
                if ext == "md" || ext == "markdown" || ext == "txt" {
                    if let Some(name) = path_buf.file_name().and_then(|n| n.to_str()) {
                        files.push(FolderFileInfo {
                            name: name.to_string(),
                            path: path_buf.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }
    }
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(files)
}

#[derive(Debug, Serialize)]
struct FileTreeEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<FileTreeEntry>,
}

#[tauri::command]
fn get_folder_tree(path: String) -> Result<Vec<FileTreeEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("不是一个有效的目录：{path}"));
    }
    read_dir_tree(dir)
}

fn read_dir_tree(dir: &Path) -> Result<Vec<FileTreeEntry>, String> {
    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|error| format!("读取目录失败：{error}"))?;

    for entry in read_dir {
        let entry = entry.map_err(|error| format!("读取目录项失败：{error}"))?;
        let path_buf = entry.path();
        let name = path_buf
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }

        if path_buf.is_dir() {
            if let Ok(sub_entries) = read_dir_tree(&path_buf) {
                if !sub_entries.is_empty() {
                    entries.push(FileTreeEntry {
                        name,
                        path: path_buf.to_string_lossy().to_string(),
                        is_dir: true,
                        children: sub_entries,
                    });
                }
            }
        } else if path_buf.is_file() {
            if let Some(extension) = path_buf.extension().and_then(|ext| ext.to_str()) {
                let ext = extension.to_lowercase();
                if ext == "md" || ext == "markdown" || ext == "txt" {
                    entries.push(FileTreeEntry {
                        name,
                        path: path_buf.to_string_lossy().to_string(),
                        is_dir: false,
                        children: Vec::new(),
                    });
                }
            }
        }
    }

    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}

#[tauri::command]
fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| format!("最小化窗口失败：{error}"))
}

#[tauri::command]
fn maximize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let maximized = window.is_maximized().map_err(|error| format!("获取窗口最大化状态失败：{error}"))?;
    if maximized {
        window.unmaximize().map_err(|error| format!("还原窗口失败：{error}"))
    } else {
        window.maximize().map_err(|error| format!("最大化窗口失败：{error}"))
    }
}

#[tauri::command]
fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| format!("关闭窗口失败：{error}"))
}

fn persist_current_window_state(window: &tauri::Window) {
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };

    let input = WindowStateInput {
        x: Some(position.x),
        y: Some(position.y),
        width: Some(size.width),
        height: Some(size.height),
    };

    let _ = update_window_state(window.app_handle().clone(), input);
}

fn restore_window_state(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(Some(value_json)) = get_setting_value(app, "windowState") else {
        return;
    };
    let Ok(state) = serde_json::from_str::<WindowStateInput>(&value_json) else {
        return;
    };

    if let (Some(width), Some(height)) = (state.width, state.height) {
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));
    }

    if let (Some(x), Some(y)) = (state.x, state.y) {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    }
}

fn get_setting_value(app: &AppHandle, key: &str) -> Result<Option<String>, String> {
    let connection = open_database(app)?;
    let mut statement = connection
        .prepare("SELECT value_json FROM app_settings WHERE key = ?1")
        .map_err(|error| format!("读取设置失败：{error}"))?;
    let mut rows = statement
        .query([key])
        .map_err(|error| format!("读取设置失败：{error}"))?;

    if let Some(row) = rows.next().map_err(|error| format!("读取设置失败：{error}"))? {
        Ok(Some(row.get(0).map_err(|error| format!("读取设置失败：{error}"))?))
    } else {
        Ok(None)
    }
}
