pub(crate) mod image_assets;

use crate::models::{
    DocumentPayload, FileStatus, FileTreeEntry, FolderFileInfo, FolderIndexBatch,
    FolderIndexFinished,
};
use std::{
    fs,
    path::{Path, PathBuf},
    thread,
    time::UNIX_EPOCH,
};
use tauri::{AppHandle, Emitter};

const FOLDER_INDEX_BATCH_EVENT: &str = "nomo://folder-index-batch";
const FOLDER_INDEX_FINISHED_EVENT: &str = "nomo://folder-index-finished";
const FOLDER_INDEX_BATCH_SIZE: usize = 64;

#[tauri::command]
pub(crate) fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|error| format!("创建文件夹失败：{error}"))
}

#[tauri::command]
pub(crate) fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|error| format!("重命名失败：{error}"))
}

#[tauri::command]
pub(crate) fn delete_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("文件不存在：{path}"));
    }
    if file_path.is_dir() {
        fs::remove_dir_all(&path).map_err(|error| format!("删除文件夹失败：{error}"))
    } else {
        fs::remove_file(&path).map_err(|error| format!("删除文件失败：{error}"))
    }
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
    list_folder_children(path.clone(), Some(path))
}

#[tauri::command]
pub(crate) fn list_folder_children(
    path: String,
    root_path: Option<String>,
) -> Result<Vec<FileTreeEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("不是一个有效的目录：{path}"));
    }

    let root = root_path
        .as_deref()
        .filter(|value| !value.is_empty())
        .map(Path::new)
        .unwrap_or(dir);
    let ignore_rules = IgnoreRules::load(root, Some(dir));
    read_dir_children(dir, root, &ignore_rules)
}

#[tauri::command]
pub(crate) fn start_folder_indexing(app: AppHandle, path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("不是一个有效的目录：{path}"));
    }

    thread::spawn(move || {
        index_folder_in_background(app, root);
    });

    Ok(())
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

fn read_dir_children(
    dir: &Path,
    root: &Path,
    ignore_rules: &IgnoreRules,
) -> Result<Vec<FileTreeEntry>, String> {
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
        let is_dir = path_buf.is_dir();

        if ignore_rules.is_ignored(root, &path_buf, &name, is_dir) {
            continue;
        }

        if is_dir {
            entries.push(FileTreeEntry {
                name,
                path: path_buf.to_string_lossy().to_string(),
                is_dir: true,
                has_children: has_visible_children(&path_buf, root, ignore_rules),
                children_loaded: false,
                children: Vec::new(),
            });
        } else if path_buf.is_file() {
            if let Some(extension) = path_buf.extension().and_then(|ext| ext.to_str()) {
                let ext = extension.to_lowercase();
                if ext == "md" || ext == "markdown" || ext == "txt" {
                    entries.push(FileTreeEntry {
                        name,
                        path: path_buf.to_string_lossy().to_string(),
                        is_dir: false,
                        has_children: false,
                        children_loaded: true,
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

fn index_folder_in_background(app: AppHandle, root: PathBuf) {
    let root_path = root.to_string_lossy().to_string();
    let ignore_rules = IgnoreRules::load(&root, None);
    let mut stack = vec![root.clone()];
    let mut batch = Vec::new();
    let mut scanned_dirs = 0;
    let mut scanned_files = 0;

    while let Some(dir) = stack.pop() {
        scanned_dirs += 1;
        let Ok(read_dir) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in read_dir.flatten() {
            let path_buf = entry.path();
            let name = path_buf
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_string();
            let is_dir = path_buf.is_dir();

            if ignore_rules.is_ignored(&root, &path_buf, &name, is_dir) {
                continue;
            }

            if is_dir {
                let has_children = has_visible_children(&path_buf, &root, &ignore_rules);
                stack.push(path_buf.clone());
                batch.push(FileTreeEntry {
                    name,
                    path: path_buf.to_string_lossy().to_string(),
                    is_dir: true,
                    has_children,
                    children_loaded: false,
                    children: Vec::new(),
                });
            } else if path_buf.is_file() && is_markdown_like_file(&path_buf) {
                scanned_files += 1;
            }

            if batch.len() >= FOLDER_INDEX_BATCH_SIZE {
                emit_folder_index_batch(&app, &root_path, &mut batch, scanned_dirs, scanned_files);
            }
        }
    }

    emit_folder_index_batch(&app, &root_path, &mut batch, scanned_dirs, scanned_files);
    let _ = app.emit(
        FOLDER_INDEX_FINISHED_EVENT,
        FolderIndexFinished {
            root_path,
            scanned_dirs,
            scanned_files,
        },
    );
}

fn emit_folder_index_batch(
    app: &AppHandle,
    root_path: &str,
    batch: &mut Vec<FileTreeEntry>,
    scanned_dirs: usize,
    scanned_files: usize,
) {
    if batch.is_empty() {
        return;
    }

    let directories = std::mem::take(batch);
    let _ = app.emit(
        FOLDER_INDEX_BATCH_EVENT,
        FolderIndexBatch {
            root_path: root_path.to_string(),
            directories,
            scanned_dirs,
            scanned_files,
        },
    );
}

fn has_visible_children(dir: &Path, root: &Path, ignore_rules: &IgnoreRules) -> bool {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return false;
    };

    for entry in read_dir.flatten() {
        let path_buf = entry.path();
        let name = path_buf
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        let is_dir = path_buf.is_dir();
        if ignore_rules.is_ignored(root, &path_buf, name, is_dir) {
            continue;
        }
        if is_dir || (path_buf.is_file() && is_markdown_like_file(&path_buf)) {
            return true;
        }
    }

    false
}

fn is_markdown_like_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let ext = ext.to_lowercase();
            ext == "md" || ext == "markdown" || ext == "txt"
        })
        .unwrap_or(false)
}

#[derive(Debug, Clone)]
struct IgnorePattern {
    value: String,
    negated: bool,
    directory_only: bool,
}

#[derive(Debug, Clone)]
struct IgnoreRules {
    patterns: Vec<IgnorePattern>,
}

impl IgnoreRules {
    fn load(root: &Path, extra_dir: Option<&Path>) -> Self {
        let mut patterns = built_in_ignore_patterns();
        append_gitignore_patterns(root, &mut patterns);
        if let Some(dir) = extra_dir {
            if dir != root {
                append_gitignore_patterns(dir, &mut patterns);
            }
        }
        Self { patterns }
    }

    fn is_ignored(&self, root: &Path, path: &Path, name: &str, is_dir: bool) -> bool {
        let mut ignored = false;
        for pattern in &self.patterns {
            if pattern.directory_only && !is_dir {
                continue;
            }
            if pattern_matches(root, path, name, pattern) {
                ignored = !pattern.negated;
            }
        }
        ignored
    }
}

fn built_in_ignore_patterns() -> Vec<IgnorePattern> {
    [
        ".git/",
        ".hg/",
        ".svn/",
        "node_modules/",
        "target/",
        "dist/",
        "build/",
        "out/",
        "coverage/",
        ".next/",
        ".svelte-kit/",
        ".turbo/",
        ".cache/",
    ]
    .into_iter()
    .filter_map(parse_ignore_pattern)
    .collect()
}

fn append_gitignore_patterns(dir: &Path, patterns: &mut Vec<IgnorePattern>) {
    let content = fs::read_to_string(dir.join(".gitignore")).unwrap_or_default();
    patterns.extend(content.lines().filter_map(parse_ignore_pattern));
}

fn parse_ignore_pattern(line: &str) -> Option<IgnorePattern> {
    let mut value = line.trim();
    if value.is_empty() || value.starts_with('#') {
        return None;
    }

    let negated = value.starts_with('!');
    if negated {
        value = value.trim_start_matches('!').trim();
    }
    if value.is_empty() {
        return None;
    }

    let directory_only = value.ends_with('/');
    let value = value
        .trim_start_matches('/')
        .trim_end_matches('/')
        .replace('\\', "/");
    if value.is_empty() {
        return None;
    }

    Some(IgnorePattern {
        value,
        negated,
        directory_only,
    })
}

fn pattern_matches(root: &Path, path: &Path, name: &str, pattern: &IgnorePattern) -> bool {
    let relative = path
        .strip_prefix(root)
        .ok()
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|| name.replace('\\', "/"));

    if pattern.value.contains('/') {
        wildcard_match(&pattern.value, &relative)
            || relative.starts_with(&(pattern.value.clone() + "/"))
    } else {
        wildcard_match(&pattern.value, name)
    }
}

fn wildcard_match(pattern: &str, text: &str) -> bool {
    let pattern = pattern.as_bytes();
    let text = text.as_bytes();
    let mut p = 0;
    let mut t = 0;
    let mut star = None;
    let mut match_after_star = 0;

    while t < text.len() {
        if p < pattern.len() && (pattern[p] == b'?' || pattern[p] == text[t]) {
            p += 1;
            t += 1;
        } else if p < pattern.len() && pattern[p] == b'*' {
            star = Some(p);
            match_after_star = t;
            p += 1;
        } else if let Some(star_index) = star {
            p = star_index + 1;
            match_after_star += 1;
            t = match_after_star;
        } else {
            return false;
        }
    }

    while p < pattern.len() && pattern[p] == b'*' {
        p += 1;
    }

    p == pattern.len()
}
