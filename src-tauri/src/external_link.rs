use std::process::Command;

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

    open_with_system_default(href)
}

fn has_dangerous_protocol(href: &str) -> bool {
    let lower = href.to_ascii_lowercase();
    lower.starts_with("javascript:")
        || lower.starts_with("vbscript:")
        || lower.starts_with("data:")
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
