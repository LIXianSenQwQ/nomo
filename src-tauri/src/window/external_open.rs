use crate::{database, models::SettingInput};
use serde::Serialize;
use std::{
    collections::HashSet,
    env,
    path::{Path, PathBuf},
};
#[cfg(any(target_os = "macos", test))]
use tauri::Url;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

const OPEN_DOCUMENT_EVENT: &str = "nomo://open-document";
const PENDING_EXTERNAL_OPEN_PREFIX: &str = "pendingExternalOpen:";

#[derive(Clone, Debug, Serialize)]
struct ExternalOpenPayload {
    paths: Vec<String>,
}

pub(crate) fn collect_markdown_paths_from_startup_args() -> Vec<String> {
    let args = env::args().collect::<Vec<_>>();
    let cwd = env::current_dir().ok();
    collect_markdown_paths_from_args(args, cwd)
}

pub(crate) fn collect_markdown_paths_from_args(
    args: Vec<String>,
    cwd: Option<PathBuf>,
) -> Vec<String> {
    let exe_path = env::current_exe().ok();
    let mut seen = HashSet::new();
    let mut paths = Vec::new();

    for arg in args {
        if arg.starts_with('-') {
            continue;
        }

        let candidate = PathBuf::from(&arg);
        let absolute = if candidate.is_absolute() {
            candidate
        } else if let Some(cwd) = cwd.as_ref() {
            cwd.join(candidate)
        } else {
            candidate
        };

        if is_supported_external_file(&absolute, exe_path.as_deref()) {
            let normalized = normalize_path(&absolute);
            if seen.insert(normalized.clone()) {
                paths.push(normalized);
            }
        }
    }

    paths
}

#[cfg(any(target_os = "macos", test))]
pub(crate) fn collect_markdown_paths_from_urls(urls: Vec<Url>) -> Vec<String> {
    let exe_path = env::current_exe().ok();
    let mut seen = HashSet::new();
    let mut paths = Vec::new();

    for url in urls {
        if url.scheme() != "file" {
            continue;
        }
        let Ok(path) = url.to_file_path() else {
            continue;
        };
        if is_supported_external_file(&path, exe_path.as_deref()) {
            let normalized = normalize_path(&path);
            if seen.insert(normalized.clone()) {
                paths.push(normalized);
            }
        }
    }

    paths
}

pub(crate) fn route_external_open(app: &AppHandle, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    let Some(window) = target_document_window(app) else {
        persist_pending_external_open(app, "main", &paths)?;
        return Ok(());
    };

    let label = window.label().to_string();
    let _ = persist_pending_external_open(app, &label, &paths);
    window
        .show()
        .map_err(|error| format!("显示外部打开目标窗口失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦外部打开目标窗口失败：{error}"))?;
    window
        .emit(
            OPEN_DOCUMENT_EVENT,
            ExternalOpenPayload {
                paths: paths.clone(),
            },
        )
        .map_err(|error| format!("发送外部打开文件事件失败：{error}"))?;
    crate::window::tray::set_tray_active(app, true);
    Ok(())
}

pub(crate) fn persist_pending_external_open(
    app: &AppHandle,
    label: &str,
    paths: &[String],
) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    let key = pending_external_open_key(label);
    database::update_app_setting(
        app.clone(),
        SettingInput {
            key,
            value_json: serde_json::to_string(paths)
                .map_err(|error| format!("序列化待外部打开路径失败：{error}"))?,
        },
    )
}

pub(crate) fn pending_external_open_key(label: &str) -> String {
    format!("{PENDING_EXTERNAL_OPEN_PREFIX}{label}")
}

pub(crate) fn is_document_window_label(label: &str) -> bool {
    label == "main" || (label.starts_with("window-") && label != "window-settings")
}

fn target_document_window(app: &AppHandle) -> Option<WebviewWindow> {
    for (label, window) in app.webview_windows() {
        if is_document_window_label(&label) && window.is_focused().unwrap_or(false) {
            return Some(window);
        }
    }

    app.get_webview_window("main")
}

fn is_supported_external_file(path: &Path, exe_path: Option<&Path>) -> bool {
    if let Some(exe_path) = exe_path {
        if same_path(path, exe_path) {
            return false;
        }
    }

    if !has_supported_extension(path) || !path.is_file() {
        return false;
    }

    true
}

fn has_supported_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            let extension = extension.to_ascii_lowercase();
            matches!(extension.as_str(), "md" | "markdown" | "txt")
        })
        .unwrap_or(false)
}

fn same_path(left: &Path, right: &Path) -> bool {
    let left = left.canonicalize().unwrap_or_else(|_| left.to_path_buf());
    let right = right.canonicalize().unwrap_or_else(|_| right.to_path_buf());
    left == right
}

fn normalize_path(path: &Path) -> String {
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn collects_existing_markdown_paths_from_args() {
        let dir = env::temp_dir().join(format!("nomo-external-open-{}", database::now_ts()));
        fs::create_dir_all(&dir).unwrap();
        let md = dir.join("测试 文件.md");
        let ignored = dir.join("ignored.exe");
        fs::write(&md, "# ok").unwrap();
        fs::write(&ignored, "no").unwrap();

        let paths = collect_markdown_paths_from_args(
            vec![
                "Nomo.exe".to_string(),
                md.to_string_lossy().to_string(),
                ignored.to_string_lossy().to_string(),
            ],
            None,
        );

        assert_eq!(paths, vec![normalize_path(&md)]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn resolves_relative_args_with_cwd() {
        let dir = env::temp_dir().join(format!(
            "nomo-external-open-relative-{}",
            database::now_ts()
        ));
        fs::create_dir_all(&dir).unwrap();
        let md = dir.join("demo.markdown");
        fs::write(&md, "# ok").unwrap();

        let paths = collect_markdown_paths_from_args(
            vec!["Nomo.exe".to_string(), "demo.markdown".to_string()],
            Some(dir.clone()),
        );

        assert_eq!(paths, vec![normalize_path(&md)]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn collects_file_urls() {
        let dir = env::temp_dir().join(format!("nomo-external-open-url-{}", database::now_ts()));
        fs::create_dir_all(&dir).unwrap();
        let md = dir.join("demo.md");
        fs::write(&md, "# ok").unwrap();
        let url = Url::from_file_path(&md).unwrap();

        let paths = collect_markdown_paths_from_urls(vec![url]);

        assert_eq!(paths, vec![normalize_path(&md)]);
        let _ = fs::remove_dir_all(dir);
    }
}
