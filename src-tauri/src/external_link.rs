use std::path::Path;
use std::process::Command;

const LOCAL_ATTACHMENT_EXTENSIONS: &[&str] = &[
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "png", "jpg", "jpeg", "gif", "webp",
    "bmp", "svg", "avif",
];

/**
 * 使用系统默认应用打开外部链接。
 *
 * 语义编辑区中的链接需要跳出 Tauri WebView。前端的 window.open 在桌面环境
 * 可能被 WebView 静默拦截，因此这里统一收口到后端按操作系统调用默认打开方式。
 */
#[tauri::command]
pub(crate) fn open_external_link(href: String) -> Result<(), String> {
    let href = href.trim();
    if href.is_empty() {
        return Err("链接地址为空".to_string());
    }
    if has_dangerous_protocol(href) {
        return Err("链接协议不安全，已阻止打开".to_string());
    }
    if !has_supported_external_protocol(href) {
        return Err("仅支持打开 http、https 或 mailto 外部链接".to_string());
    }

    open_with_system_default(href)
}

/**
 * 使用系统默认应用打开经过白名单约束的本地附件。
 *
 * 路径由前端按当前 Markdown 所在目录解析，但文件类型和最终磁盘目标必须在
 * 后端再次校验，避免把任意本地路径打开能力直接暴露给 WebView。
 */
#[tauri::command]
pub(crate) fn open_local_attachment(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("附件路径为空".to_string());
    }
    if is_unc_path(path) {
        return Err("不支持打开 UNC 或网络共享路径".to_string());
    }

    let canonical_path = Path::new(path)
        .canonicalize()
        .map_err(|error| format!("附件不存在或无法访问：{error}"))?;
    let canonical_text = canonical_path.to_string_lossy();
    if is_unc_path(&canonical_text) {
        return Err("不支持打开 UNC 或网络共享路径".to_string());
    }
    if !canonical_path.is_file() {
        return Err("附件路径不是文件".to_string());
    }

    let extension = canonical_path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "附件类型不受支持".to_string())?;
    if !LOCAL_ATTACHMENT_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("附件类型不受支持：.{extension}"));
    }

    tauri_plugin_opener::open_path(&canonical_path, None::<&str>)
        .map_err(|error| format!("打开本地附件失败：{error}"))
}

fn has_dangerous_protocol(href: &str) -> bool {
    let lower = href.to_ascii_lowercase();
    lower.starts_with("javascript:") || lower.starts_with("vbscript:") || lower.starts_with("data:")
}

#[cfg(target_os = "windows")]
fn open_with_system_default(href: &str) -> Result<(), String> {
    Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", href])
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("打开链接失败：{error}"))
}

#[cfg(target_os = "macos")]
fn open_with_system_default(href: &str) -> Result<(), String> {
    Command::new("open")
        .arg(href)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("打开链接失败：{error}"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_with_system_default(href: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(href)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("打开链接失败：{error}"))
}

/**
 * 在系统文件管理器中定位并选中指定文件或文件夹。
 *
 * 统一复用 Tauri 官方 opener 的平台实现，避免自行拼接系统命令：
 * Windows 使用 Shell API，macOS 使用 NSWorkspace，Linux 使用文件管理器 D-Bus/Portal。
 */
#[tauri::command]
pub(crate) fn reveal_in_explorer(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("文件路径为空".to_string());
    }

    tauri_plugin_opener::reveal_item_in_dir(Path::new(path))
        .map_err(|error| format!("打开文件管理器失败：{error}"))
}

fn is_unc_path(path: &str) -> bool {
    let normalized = path.replace('/', r"\");
    if let Some(extended) = normalized.strip_prefix(r"\\?\") {
        return extended.to_ascii_lowercase().starts_with(r"unc\")
            || !looks_like_windows_drive_path(extended);
    }
    normalized.starts_with(r"\\")
}

fn looks_like_windows_drive_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\'
}

fn has_supported_external_protocol(href: &str) -> bool {
    let lower = href.to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("mailto:")
}
