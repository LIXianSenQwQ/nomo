use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub(crate) struct DocumentPayload {
    pub(crate) path: String,
    pub(crate) file_name: String,
    pub(crate) markdown: String,
    pub(crate) modified_at: i64,
    pub(crate) size_bytes: i64,
    pub(crate) readonly: bool,
}

#[derive(Debug, Serialize)]
pub(crate) struct RecentDocument {
    pub(crate) path: String,
    pub(crate) title: Option<String>,
    pub(crate) modified_at: i64,
    pub(crate) word_count: i64,
    pub(crate) opened_at: i64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RecentFileInput {
    pub(crate) path: String,
    pub(crate) title: Option<String>,
    pub(crate) word_count: i64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SnapshotInput {
    pub(crate) path: String,
    pub(crate) markdown: String,
    pub(crate) reason: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct SnapshotRecord {
    pub(crate) id: String,
    pub(crate) document_path: String,
    pub(crate) content_hash: String,
    pub(crate) markdown: String,
    pub(crate) created_at: i64,
    pub(crate) reason: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SettingInput {
    pub(crate) key: String,
    pub(crate) value_json: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct SettingRecord {
    pub(crate) key: String,
    pub(crate) value_json: String,
    pub(crate) updated_at: i64,
}

#[derive(Debug, Serialize)]
pub(crate) struct FileStatus {
    pub(crate) path: String,
    pub(crate) exists: bool,
    pub(crate) is_file: bool,
    pub(crate) modified_at: i64,
    pub(crate) size_bytes: i64,
    pub(crate) readonly: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub(crate) struct WindowStateInput {
    pub(crate) x: Option<i32>,
    pub(crate) y: Option<i32>,
    pub(crate) width: Option<u32>,
    pub(crate) height: Option<u32>,
}

#[derive(Debug, Serialize)]
pub(crate) struct FolderFileInfo {
    pub(crate) name: String,
    pub(crate) path: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct FileTreeEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) is_dir: bool,
    pub(crate) children: Vec<FileTreeEntry>,
}
