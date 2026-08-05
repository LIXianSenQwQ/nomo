mod titlebar;

use super::WindowChromeMetrics;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;
use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetWindowThreadProcessId, IsZoomed, SetForegroundWindow, SetWindowPos, ShowWindow,
    HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE, SW_RESTORE, SW_SHOW,
};

const WINDOW_THREAD_TIMEOUT: Duration = Duration::from_secs(10);
const DISPATCH_QUEUED: u8 = 0;
const DISPATCH_RUNNING: u8 = 1;
const DISPATCH_CANCELLED: u8 = 2;
const DISPATCH_FINISHED: u8 = 3;

pub(crate) fn window_decorations() -> bool {
    true
}

pub(crate) fn setup_window<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    // 保留标准 Win32 窗口样式，让系统继续负责阴影、缩放、Snap 和三枚标题栏按钮；
    // 自绘层只接管标题栏内容区。任何原生初始化失败都回退到完整系统装饰。
    if let Err(error) = window.set_decorations(true) {
        let _ = run_on_window_thread(window, |hwnd| {
            titlebar::rollback_to_standard_frame(hwnd);
            Ok(())
        });
        return Err(format!("启用 Windows 原生窗口装饰失败：{error}"));
    }
    if let Err(error) = window.set_shadow(true) {
        let _ = run_on_window_thread(window, |hwnd| {
            titlebar::rollback_to_standard_frame(hwnd);
            Ok(())
        });
        let _ = window.set_decorations(true);
        return Err(format!("启用 Windows 原生窗口阴影失败：{error}"));
    }

    let dark = system_theme() == "dark";
    if let Err(error) = run_on_window_thread(window, move |hwnd| {
        if let Err(error) = titlebar::install(hwnd, dark) {
            titlebar::rollback_to_standard_frame(hwnd);
            Err(error)
        } else {
            Ok(())
        }
    }) {
        let _ = window.set_decorations(true);
        let _ = window.set_shadow(true);
        return Err(format!(
            "启用 Windows 标题栏覆盖失败，已回退到系统标题栏：{error}"
        ));
    }

    Ok(())
}

pub(crate) fn set_window_chrome_theme<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    dark: bool,
    caption_color: Option<u32>,
    caption_text_color: Option<u32>,
) -> Result<(), String> {
    run_on_window_thread(window, move |hwnd| {
        titlebar::set_theme(hwnd, dark, caption_color, caption_text_color)
    })
}

pub(crate) fn set_window_caption_height<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    height: f64,
) -> Result<(), String> {
    run_on_window_thread(window, move |hwnd| {
        titlebar::set_caption_height(hwnd, height)
    })
}

pub(crate) fn get_window_chrome_metrics<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<WindowChromeMetrics, String> {
    run_on_window_thread(window, |hwnd| Ok(titlebar::metrics(hwnd)))
}

fn run_on_window_thread<R, T, F>(
    window: &tauri::WebviewWindow<R>,
    operation: F,
) -> Result<T, String>
where
    R: tauri::Runtime,
    T: Send + 'static,
    F: FnOnce(HWND) -> Result<T, String> + Send + 'static,
{
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("获取 Windows 窗口句柄失败：{error}"))?
        .0;
    let owner_thread = unsafe { GetWindowThreadProcessId(hwnd, std::ptr::null_mut()) };
    if owner_thread == 0 {
        return Err("读取 Windows 窗口所属线程失败".to_string());
    }
    if owner_thread == unsafe { GetCurrentThreadId() } {
        return operation(hwnd);
    }

    let hwnd_value = hwnd as usize;
    let (sender, receiver) = mpsc::sync_channel(1);
    let dispatch_state = Arc::new(AtomicU8::new(DISPATCH_QUEUED));
    let callback_dispatch_state = Arc::clone(&dispatch_state);
    window
        .run_on_main_thread(move || {
            if callback_dispatch_state
                .compare_exchange(
                    DISPATCH_QUEUED,
                    DISPATCH_RUNNING,
                    Ordering::AcqRel,
                    Ordering::Acquire,
                )
                .is_err()
            {
                return;
            }
            let hwnd = hwnd_value as HWND;
            let current_thread = unsafe { GetCurrentThreadId() };
            let result = if current_thread == owner_thread {
                operation(hwnd)
            } else {
                Err(format!(
                    "Tauri 主线程与窗口所属线程不一致：owner={owner_thread} current={current_thread}"
                ))
            };
            callback_dispatch_state.store(DISPATCH_FINISHED, Ordering::Release);
            let _ = sender.send(result);
        })
        .map_err(|error| format!("调度 Windows 窗口线程操作失败：{error}"))?;

    match receiver.recv_timeout(WINDOW_THREAD_TIMEOUT) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            if dispatch_state
                .compare_exchange(
                    DISPATCH_QUEUED,
                    DISPATCH_CANCELLED,
                    Ordering::AcqRel,
                    Ordering::Acquire,
                )
                .is_ok()
            {
                Err("等待 Windows 窗口线程操作超时，已取消尚未执行的操作".to_string())
            } else {
                // 操作已在 UI 线程开始，必须接收它的结果，避免调用方回退后又发生迟到写入。
                receiver
                    .recv()
                    .map_err(|error| format!("接收 Windows 窗口线程操作结果失败：{error}"))?
            }
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            Err("Windows 窗口线程操作通道意外断开".to_string())
        }
    }
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
