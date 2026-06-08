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
pub(crate) fn setup_window(_window: &tauri::WebviewWindow) {}
