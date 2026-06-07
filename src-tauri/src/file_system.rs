pub(crate) mod image_assets;

use crate::models::{DocumentPayload, FileStatus, FileTreeEntry, FolderFileInfo};
use std::{fs, path::Path, time::UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub(crate) fn get_default_workspace_dir(app: AppHandle) -> Result<String, String> {
    let document_dir = app
        .path()
        .document_dir()
        .map_err(|error| format!("无法获取文档目录：{error}"))?;
    let workspace_dir = document_dir.join("NewMd");
    if !workspace_dir.exists() {
        fs::create_dir_all(&workspace_dir)
            .map_err(|error| format!("无法创建工作区目录：{error}"))?;
    }
    Ok(workspace_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub(crate) fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|error| format!("创建文件夹失败：{error}"))
}

#[tauri::command]
pub(crate) fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|error| format!("重命名失败：{error}"))
}

#[tauri::command]
pub(crate) fn read_markdown_file(path: String) -> Result<DocumentPayload, String> {
    let status = file_status(&path);
    if !status.exists {
        return Err(format!("文件不存在：{path}"));
    }
    if !status.is_file {
        return Err(format!("路径不是文件：{path}"));
    }

    let markdown =
        fs::read_to_string(&path).map_err(|error| format!("读取 Markdown 文件失败：{error}"))?;
    document_payload(path, markdown)
}

#[tauri::command]
pub(crate) fn write_markdown_file(
    path: String,
    markdown: String,
) -> Result<DocumentPayload, String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            return Err(format!("保存目录不存在：{}", parent.display()));
        }
    }

    fs::write(&path, markdown.as_bytes())
        .map_err(|error| format!("保存 Markdown 文件失败：{error}"))?;
    document_payload(path, markdown)
}

#[tauri::command]
pub(crate) fn stat_markdown_file(path: String) -> FileStatus {
    file_status(&path)
}

#[tauri::command]
pub(crate) fn list_folder_markdown_files(path: String) -> Result<Vec<FolderFileInfo>, String> {
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

#[tauri::command]
pub(crate) fn get_folder_tree(path: String) -> Result<Vec<FileTreeEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("不是一个有效的目录：{path}"));
    }
    read_dir_tree(dir)
}

pub(crate) fn file_modified_at(path: &str) -> i64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
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

#[tauri::command]
pub(crate) fn check_paths_exist(paths: Vec<String>) -> Result<Vec<bool>, String> {
    Ok(paths
        .into_iter()
        .map(|path| Path::new(&path).exists())
        .collect())
}

fn file_status(path: &str) -> FileStatus {
    let metadata = fs::metadata(path);

    FileStatus {
        path: path.to_string(),
        exists: Path::new(path).exists(),
        is_file: metadata
            .as_ref()
            .map(|value| value.is_file())
            .unwrap_or(false),
        modified_at: file_modified_at(path),
        size_bytes: metadata
            .as_ref()
            .map(|value| value.len() as i64)
            .unwrap_or_default(),
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

        // 过滤掉构建产物和依赖目录，但保留 . 开头的隐藏文件/文件夹
        if name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }

        if path_buf.is_dir() {
            if let Ok(sub_entries) = read_dir_tree(&path_buf) {
                entries.push(FileTreeEntry {
                    name,
                    path: path_buf.to_string_lossy().to_string(),
                    is_dir: true,
                    children: sub_entries,
                });
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
