use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    IsZoomed, SetForegroundWindow, SetWindowPos, ShowWindow, HWND_NOTOPMOST, HWND_TOPMOST,
    SWP_NOMOVE, SWP_NOSIZE, SW_RESTORE, SW_SHOW,
};

pub(crate) fn window_decorations() -> bool {
    false
}

pub(crate) fn setup_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let _ = window.set_decorations(window_decorations());
    // Windows 无边框窗口的原生阴影通常不会在顶部形成清晰边线，窗口黑边交给前端统一绘制。
    let _ = window.set_shadow(true);
}

pub(crate) fn system_theme() -> &'static str {
    if read_apps_use_light_theme() == Some(0) {
        "dark"
    } else {
        "light"
    }
}

fn read_apps_use_light_theme() -> Option<u32> {
    const PERSONALIZE_SUBKEY: &str =
        "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
    const APPS_USE_LIGHT_THEME_VALUE: &str = "AppsUseLightTheme";

    let subkey = wide_null(PERSONALIZE_SUBKEY);
    let value_name = wide_null(APPS_USE_LIGHT_THEME_VALUE);
    let mut value_type = 0u32;
    let mut value = 1u32;
    let mut value_size = std::mem::size_of::<u32>() as u32;

    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            value_name.as_ptr(),
            RRF_RT_REG_DWORD,
            &mut value_type,
            (&mut value as *mut u32).cast(),
            &mut value_size,
        )
    };

    if status == 0 {
        Some(value)
    } else {
        None
    }
}

fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

/// 使用 Win32 API 强制窗口到前台。
///
/// Windows 有前台窗口激活限制：非前台进程不能随意将自己的窗口设为前台。
/// 当通过单实例插件接收外部打开请求时，Nomo 进程可能不是当前前台进程，
/// 仅靠 Tauri 的 `set_focus()` 无法可靠激活窗口。
/// 本函数通过临时置顶（TOPMOST）技巧配合 `SetForegroundWindow` 来绕过限制。
pub(crate) fn bring_window_to_front<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let hwnd = hwnd.0;
    unsafe {
        // 如果窗口已最大化，使用 SW_SHOW 保持最大化状态；
        // 否则使用 SW_RESTORE 从最小化/隐藏状态还原窗口。
        let show_cmd = if IsZoomed(hwnd) != 0 {
            SW_SHOW
        } else {
            SW_RESTORE
        };
        ShowWindow(hwnd, show_cmd);
        SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
        SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
        SetForegroundWindow(hwnd);
    }
}
