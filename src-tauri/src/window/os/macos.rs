use std::time::Duration;

use objc2_app_kit::NSWindow;

pub(crate) fn window_decorations() -> bool {
    true
}

pub(crate) fn system_theme() -> &'static str {
    let output = std::process::Command::new("defaults")
        .args(["read", "-g", "AppleInterfaceStyle"])
        .output();

    match output {
        Ok(output) if String::from_utf8_lossy(&output.stdout).trim() == "Dark" => "dark",
        _ => "light",
    }
}

pub(crate) fn setup_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    // macOS 使用原生红黄绿按钮。只有文档窗口需要透明叠加标题栏，
    // 用来在红黄绿右侧承载资源管理器开关等应用内控件；设置窗口保留原生标题栏布局。
    let _ = window.set_decorations(window_decorations());
    if uses_overlay_titlebar(window.label()) {
        let _ = window.set_title_bar_style(tauri::TitleBarStyle::Overlay);
        request_overlay_titlebar_redraw(window);
    }
    let _ = window.set_shadow(true);
}

fn uses_overlay_titlebar(label: &str) -> bool {
    label == "main" || (label.starts_with("window-") && label != "window-settings")
}

pub(crate) fn bring_window_to_front<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let _ = window.set_focus();
    request_overlay_titlebar_redraw(window);
}

fn request_overlay_titlebar_redraw<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    if !uses_overlay_titlebar(window.label()) {
        return;
    }

    for delay_ms in [16_u64, 120_u64] {
        let window = window.clone();
        tauri::async_runtime::spawn(async move {
            std::thread::sleep(Duration::from_millis(delay_ms));
            let window_for_redraw = window.clone();
            let _ = window.run_on_main_thread(move || unsafe {
                let Ok(ns_window) = window_for_redraw.ns_window() else {
                    return;
                };
                let ns_window: &NSWindow = &*ns_window.cast();
                if let Some(content_view) = ns_window.contentView() {
                    content_view.setNeedsLayout(true);
                    content_view.layoutSubtreeIfNeeded();
                    content_view.setNeedsDisplay(true);
                    content_view.displayIfNeeded();
                }
                ns_window.displayIfNeeded();
            });
        });
    }
}
