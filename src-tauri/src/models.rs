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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum RecentEntryType {
    #[serde(rename = "file")]
    File,
    #[serde(rename = "folder")]
    Folder,
}

impl RecentEntryType {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            RecentEntryType::File => "file",
            RecentEntryType::Folder => "folder",
        }
    }
}

#[derive(Debug, Serialize)]
pub(crate) struct RecentEntry {
    pub(crate) path: String,
    pub(crate) entry_type: String,
    pub(crate) title: Option<String>,
    pub(crate) modified_at: i64,
    pub(crate) word_count: i64,
    pub(crate) opened_at: i64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RecentEntryInput {
    pub(crate) path: String,
    pub(crate) entry_type: RecentEntryType,
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

#[derive(Debug, Deserialize)]
pub(crate) struct ImageAssetInput {
    pub(crate) document_path: String,
    pub(crate) document_file_name: String,
    pub(crate) strategy: String,
    pub(crate) file_name: String,
    pub(crate) bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub(crate) struct ImageAssetPayload {
    pub(crate) markdown_src: String,
    pub(crate) absolute_path: String,
    pub(crate) reused: bool,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ImageResolveInput {
    pub(crate) document_path: Option<String>,
    pub(crate) src: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ImageResolvePayload {
    pub(crate) src: String,
    pub(crate) display_src: String,
    pub(crate) exists: bool,
    pub(crate) absolute_path: Option<String>,
    pub(crate) error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ImageDeleteInput {
    pub(crate) document_path: Option<String>,
    pub(crate) src: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ImageDeletePayload {
    pub(crate) src: String,
    pub(crate) removed: bool,
    pub(crate) skipped: bool,
    pub(crate) error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct PicgoCoreUploadInput {
    pub(crate) file_name: String,
    pub(crate) bytes: Vec<u8>,
    pub(crate) command: String,
    pub(crate) config_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct PicgoServerUploadInput {
    pub(crate) file_name: String,
    pub(crate) bytes: Vec<u8>,
    pub(crate) server_url: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ImageUploadPayload {
    pub(crate) url: String,
}
