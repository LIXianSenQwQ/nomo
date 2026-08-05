#[derive(Clone, Copy, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowChromeMetrics {
    pub(crate) overlay_enabled: bool,
    pub(crate) left_inset: f64,
    pub(crate) right_inset: f64,
    pub(crate) caption_height: f64,
}

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub(crate) use macos::*;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub(crate) use windows::*;

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(crate) fn window_decorations() -> bool {
    true
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(crate) fn setup_window<R: tauri::Runtime>(
    _window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn set_window_chrome_theme<R: tauri::Runtime>(
    _window: &tauri::WebviewWindow<R>,
    _dark: bool,
    _caption_color: Option<u32>,
    _caption_text_color: Option<u32>,
) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn set_window_caption_height<R: tauri::Runtime>(
    _window: &tauri::WebviewWindow<R>,
    _height: f64,
) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn get_window_chrome_metrics<R: tauri::Runtime>(
    _window: &tauri::WebviewWindow<R>,
) -> Result<WindowChromeMetrics, String> {
    Ok(WindowChromeMetrics {
        overlay_enabled: false,
        left_inset: 0.0,
        right_inset: 0.0,
        caption_height: 0.0,
    })
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(crate) fn system_theme() -> &'static str {
    "light"
}
