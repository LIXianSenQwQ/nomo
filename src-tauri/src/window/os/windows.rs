// use tauri::{AppHandle, Manager};
// use crate::database;

pub(crate) fn setup_window(window: &tauri::WebviewWindow) {
    let _ = window.set_decorations(false);
    // Windows 无边框窗口的原生阴影通常不会在顶部形成清晰边线，窗口黑边交给前端统一绘制。
    let _ = window.set_shadow(true);
}
