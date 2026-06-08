pub(crate) fn window_decorations() -> bool {
    true
}

pub(crate) fn setup_window(window: &tauri::WebviewWindow) {
    // macOS 使用原生红黄绿按钮。只有文档窗口需要透明叠加标题栏，
    // 用来在红黄绿右侧承载资源管理器开关等应用内控件；设置窗口保留原生标题栏布局。
    let _ = window.set_decorations(window_decorations());
    if uses_overlay_titlebar(window.label()) {
        let _ = window.set_title_bar_style(tauri::TitleBarStyle::Overlay);
    }
    let _ = window.set_shadow(true);
}

fn uses_overlay_titlebar(label: &str) -> bool {
    label == "main" || (label.starts_with("window-") && label != "window-settings")
}
