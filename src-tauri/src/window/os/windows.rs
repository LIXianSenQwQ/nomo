pub(crate) fn window_decorations() -> bool {
    false
}

pub(crate) fn setup_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let _ = window.set_decorations(window_decorations());
    // Windows 无边框窗口的原生阴影通常不会在顶部形成清晰边线，窗口黑边交给前端统一绘制。
    let _ = window.set_shadow(true);
}
