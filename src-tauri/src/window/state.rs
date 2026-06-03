use tauri::{AppHandle, Manager};
use crate::{database, models::WindowStateInput};
use crate::window::commands::update_window_state;

pub(crate) fn persist_current_window_state(window: &tauri::Window) {
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };

    let input = WindowStateInput {
        x: Some(position.x),
        y: Some(position.y),
        width: Some(size.width),
        height: Some(size.height),
    };

    let _ = update_window_state(window.app_handle().clone(), input);
}

pub(crate) fn restore_window_state(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(Some(value_json)) = database::get_setting_value(app, "windowState") else {
        return;
    };
    let Ok(state) = serde_json::from_str::<WindowStateInput>(&value_json) else {
        return;
    };

    if let (Some(width), Some(height)) = (state.width, state.height) {
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));
    }

    if let (Some(x), Some(y)) = (state.x, state.y) {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    }
}