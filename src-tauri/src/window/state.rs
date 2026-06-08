use crate::window::commands::update_window_state;
use crate::{database, models::WindowStateInput};
use tauri::{AppHandle, Manager};

const MIN_WINDOW_WIDTH: u32 = 920;
const MIN_WINDOW_HEIGHT: u32 = 640;
const DEFAULT_WINDOW_WIDTH: u32 = 1180;
const DEFAULT_WINDOW_HEIGHT: u32 = 760;
const SETTINGS_MIN_WINDOW_WIDTH: u32 = 760;
const SETTINGS_MIN_WINDOW_HEIGHT: u32 = 520;
const SETTINGS_DEFAULT_WINDOW_WIDTH: u32 = 860;
const SETTINGS_DEFAULT_WINDOW_HEIGHT: u32 = 620;
const MIN_VISIBLE_SIZE: i32 = 80;

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

    let key = format!("windowState:{}", window.label());
    let _ = update_window_state(window.app_handle().clone(), key, input);
}

pub(crate) fn restore_window_state(app: &AppHandle, label: &str) {
    let Some(window) = app.get_webview_window(label) else {
        return;
    };
    let key = format!("windowState:{}", label);
    let Ok(Some(value_json)) = database::get_setting_value(app, &key) else {
        return;
    };
    let Ok(state) = serde_json::from_str::<WindowStateInput>(&value_json) else {
        return;
    };

    let metrics = window_metrics(label);
    let width = state
        .width
        .unwrap_or(metrics.default_width)
        .max(metrics.min_width);
    let height = state
        .height
        .unwrap_or(metrics.default_height)
        .max(metrics.min_height);
    let monitors = window.available_monitors().unwrap_or_default();

    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));

    // 多屏切换或分辨率变化后，旧坐标可能落到屏幕外，需要先确认窗口仍有可见区域。
    if let (Some(x), Some(y)) = (state.x, state.y) {
        if is_window_visible_on_any_monitor(x, y, width, height, &monitors) {
            let _ =
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
            return;
        }
    }

    if let Some(position) = centered_position_on_primary_monitor(&window, width, height) {
        let _ = window.set_position(tauri::Position::Physical(position));
    }
}

struct WindowMetrics {
    min_width: u32,
    min_height: u32,
    default_width: u32,
    default_height: u32,
}

fn window_metrics(label: &str) -> WindowMetrics {
    if label == "window-settings" {
        return WindowMetrics {
            min_width: SETTINGS_MIN_WINDOW_WIDTH,
            min_height: SETTINGS_MIN_WINDOW_HEIGHT,
            default_width: SETTINGS_DEFAULT_WINDOW_WIDTH,
            default_height: SETTINGS_DEFAULT_WINDOW_HEIGHT,
        };
    }

    WindowMetrics {
        min_width: MIN_WINDOW_WIDTH,
        min_height: MIN_WINDOW_HEIGHT,
        default_width: DEFAULT_WINDOW_WIDTH,
        default_height: DEFAULT_WINDOW_HEIGHT,
    }
}

fn is_window_visible_on_any_monitor(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    monitors: &[tauri::Monitor],
) -> bool {
    let window_right = x.saturating_add(width as i32);
    let window_bottom = y.saturating_add(height as i32);
    let required_width = (width as i32).min(MIN_VISIBLE_SIZE);
    let required_height = (height as i32).min(MIN_VISIBLE_SIZE);

    monitors.iter().any(|monitor| {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let monitor_right = monitor_position.x.saturating_add(monitor_size.width as i32);
        let monitor_bottom = monitor_position
            .y
            .saturating_add(monitor_size.height as i32);

        let visible_width = window_right.min(monitor_right) - x.max(monitor_position.x);
        let visible_height = window_bottom.min(monitor_bottom) - y.max(monitor_position.y);

        visible_width >= required_width && visible_height >= required_height
    })
}

fn centered_position_on_primary_monitor(
    window: &tauri::WebviewWindow,
    width: u32,
    height: u32,
) -> Option<tauri::PhysicalPosition<i32>> {
    let monitor = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.current_monitor().ok().flatten())?;
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();

    Some(tauri::PhysicalPosition {
        x: monitor_position
            .x
            .saturating_add((monitor_size.width.saturating_sub(width) / 2) as i32),
        y: monitor_position
            .y
            .saturating_add((monitor_size.height.saturating_sub(height) / 2) as i32),
    })
}
