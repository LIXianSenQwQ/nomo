// use tauri::{AppHandle, Manager};
// use crate::database;

pub(crate) fn setup_window(window: &tauri::WebviewWindow) {
    let _ = window.set_decorations(false);
}
