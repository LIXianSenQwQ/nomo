pub(crate) fn window_decorations() -> bool {
    true
}

pub(crate) fn setup_window(window: &tauri::WebviewWindow) {
    // macOS 使用系统原生窗口控制，保留红黄绿按钮和系统级标题栏行为。
    let _ = window.set_decorations(window_decorations());
}
