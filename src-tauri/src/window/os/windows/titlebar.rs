use super::WindowChromeMetrics;
use std::collections::HashMap;
use std::mem::size_of;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::ptr;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows_sys::Win32::Graphics::Dwm::{
    DwmDefWindowProc, DwmExtendFrameIntoClientArea, DwmGetWindowAttribute, DwmSetWindowAttribute,
    DWMWA_BORDER_COLOR, DWMWA_CAPTION_BUTTON_BOUNDS, DWMWA_CAPTION_COLOR, DWMWA_COLOR_DEFAULT,
    DWMWA_COLOR_NONE, DWMWA_TEXT_COLOR, DWMWA_USE_IMMERSIVE_DARK_MODE,
};
use windows_sys::Win32::Graphics::Gdi::{
    CombineRgn, CreateRectRgn, DeleteObject, GetWindowRgn, RedrawWindow, SetWindowRgn, RDW_FRAME,
    RDW_INVALIDATE, RDW_UPDATENOW, RGN_DIFF,
};
use windows_sys::Win32::UI::Controls::MARGINS;
use windows_sys::Win32::UI::HiDpi::{GetDpiForWindow, GetSystemMetricsForDpi};
use windows_sys::Win32::UI::Shell::{
    DefSubclassProc, GetWindowSubclass, RemoveWindowSubclass, SetWindowSubclass,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumChildWindows, FindWindowExW, GetClassNameW, GetParent, GetWindowLongPtrW, GetWindowRect,
    GetWindowThreadProcessId, IsChild, IsIconic, IsWindow, IsWindowVisible, IsZoomed, KillTimer,
    SetTimer, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, HTBOTTOM, HTBOTTOMLEFT, HTBOTTOMRIGHT, HTLEFT,
    HTRIGHT, HTTOP, HTTOPLEFT, HTTOPRIGHT, SM_CXFRAME, SM_CXPADDEDBORDER, SM_CXSIZE, SM_CYFRAME,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WM_ACTIVATE,
    WM_DPICHANGED, WM_DWMCOMPOSITIONCHANGED, WM_NCCALCSIZE, WM_NCDESTROY, WM_NCHITTEST,
    WM_PARENTNOTIFY, WM_SETTINGCHANGE, WM_SHOWWINDOW, WM_SIZE, WM_THEMECHANGED, WM_TIMER,
    WM_WINDOWPOSCHANGED, WS_CAPTION, WS_EX_LAYOUTRTL, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
    WS_THICKFRAME,
};

const SUBCLASS_ID: usize = 0x4E_4F_4D_4F;
const DEFAULT_CAPTION_HEIGHT: f64 = 42.0;
const MIN_CAPTION_HEIGHT: f64 = 24.0;
const MAX_CAPTION_HEIGHT: f64 = 128.0;
const DEFAULT_DPI: u32 = 96;
const WEBVIEW_CLIP_TIMER_ID: usize = 0x4E_4F_4D_1;
const WEBVIEW_CLIP_REFRESH_MS: u32 = 250;
const WRY_WEBVIEW_CLASS: [u16; 12] = [87, 82, 89, 95, 87, 69, 66, 86, 73, 69, 87, 0];
const DEFAULT_LIGHT_CAPTION_COLOR: u32 = 0x00F6_F4_F3;
const DEFAULT_LIGHT_CAPTION_TEXT_COLOR: u32 = 0x0033_3333;
const DEFAULT_DARK_CAPTION_COLOR: u32 = 0x0023_1D_18;
const DEFAULT_DARK_CAPTION_TEXT_COLOR: u32 = 0x00CC_CCCC;

static WINDOW_STATES: OnceLock<Mutex<HashMap<usize, Arc<WindowChromeState>>>> = OnceLock::new();

struct WindowChromeState {
    overlay_enabled: AtomicBool,
    dark: AtomicBool,
    caption_color: AtomicU32,
    caption_text_color: AtomicU32,
    caption_height_bits: AtomicU64,
    clipped_webview_windows: Mutex<HashMap<usize, WebviewClipEntry>>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct WebviewClipGeometry {
    width: i32,
    height: i32,
    region_left: i32,
    region_top: i32,
    region_right: i32,
    region_bottom: i32,
    hole_left: i32,
    hole_top: i32,
    hole_right: i32,
    hole_bottom: i32,
}

#[derive(Clone, PartialEq, Eq)]
struct WebviewWindowIdentity {
    process_id: u32,
    thread_id: u32,
    parent: usize,
    class_name: Vec<u16>,
}

#[derive(Clone)]
struct WebviewClipEntry {
    geometry: WebviewClipGeometry,
    identity: WebviewWindowIdentity,
    root_webview: usize,
    original_region: Option<usize>,
}

impl WindowChromeState {
    fn new(dark: bool) -> Self {
        Self {
            overlay_enabled: AtomicBool::new(true),
            dark: AtomicBool::new(dark),
            caption_color: AtomicU32::new(default_caption_color(dark)),
            caption_text_color: AtomicU32::new(default_caption_text_color(dark)),
            caption_height_bits: AtomicU64::new(DEFAULT_CAPTION_HEIGHT.to_bits()),
            clipped_webview_windows: Mutex::new(HashMap::new()),
        }
    }

    fn caption_height(&self) -> f64 {
        f64::from_bits(self.caption_height_bits.load(Ordering::Relaxed))
    }

    fn set_caption_height(&self, height: f64) {
        self.caption_height_bits
            .store(height.to_bits(), Ordering::Relaxed);
    }
}

impl Drop for WindowChromeState {
    fn drop(&mut self) {
        let cache = self
            .clipped_webview_windows
            .get_mut()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        for entry in cache.values() {
            discard_original_region(entry);
        }
    }
}

pub(super) fn install(hwnd: HWND, dark: bool) -> Result<(), String> {
    if hwnd.is_null() {
        return Err("窗口句柄为空".to_string());
    }

    let (state, is_new) = {
        let mut states = lock_states();
        if let Some(state) = states.get(&(hwnd as usize)) {
            (Arc::clone(state), false)
        } else {
            if !has_caption_style(hwnd) {
                return Err("窗口未保留 WS_CAPTION，无法启用原生标题栏按钮".to_string());
            }
            let state = Arc::new(WindowChromeState::new(dark));
            let callback_state = Arc::into_raw(Arc::clone(&state)) as usize;
            let installed = unsafe {
                SetWindowSubclass(
                    hwnd,
                    Some(window_subclass_proc),
                    SUBCLASS_ID,
                    callback_state,
                )
            };
            if installed == 0 {
                // SetWindowSubclass 没有接管引用，必须在错误路径释放它。
                unsafe {
                    drop(Arc::from_raw(callback_state as *const WindowChromeState));
                }
                return Err(last_os_error("安装窗口消息 subclass 失败"));
            }
            states.insert(hwnd as usize, Arc::clone(&state));
            (state, true)
        }
    };

    let was_enabled = state.overlay_enabled.swap(true, Ordering::AcqRel);
    apply_theme_attributes(hwnd, &state);
    if is_new || !was_enabled {
        apply_custom_frame(hwnd, &state)
    } else {
        extend_custom_frame(hwnd, &state)
    }
}

pub(super) fn set_theme(
    hwnd: HWND,
    dark: bool,
    caption_color: Option<u32>,
    caption_text_color: Option<u32>,
) -> Result<(), String> {
    let Some(state) = state_for(hwnd) else {
        apply_immersive_dark_mode(hwnd, dark);
        return Ok(());
    };

    state.dark.store(dark, Ordering::Relaxed);
    state.caption_color.store(
        caption_color.unwrap_or_else(|| default_caption_color(dark)),
        Ordering::Relaxed,
    );
    state.caption_text_color.store(
        caption_text_color.unwrap_or_else(|| default_caption_text_color(dark)),
        Ordering::Relaxed,
    );
    apply_theme_attributes(hwnd, &state);
    if state.overlay_enabled.load(Ordering::Acquire) {
        rebuild_custom_frame_after_theme_change(hwnd, &state)
    } else {
        redraw_native_frame(hwnd)
    }
}

pub(super) fn set_caption_height(hwnd: HWND, height: f64) -> Result<(), String> {
    if !height.is_finite() || !(MIN_CAPTION_HEIGHT..=MAX_CAPTION_HEIGHT).contains(&height) {
        return Err(format!(
            "Windows 标题栏高度必须在 {MIN_CAPTION_HEIGHT:.0} 到 {MAX_CAPTION_HEIGHT:.0} 之间"
        ));
    }

    let Some(state) = state_for(hwnd) else {
        // 标准标题栏 fallback 不接受前端高度，但也不应让窗口初始化链路失败。
        return Ok(());
    };
    if !state.overlay_enabled.load(Ordering::Acquire) {
        return Ok(());
    }

    state.set_caption_height(height);
    if let Err(error) = apply_custom_frame(hwnd, &state) {
        disable_overlay(hwnd, &state);
        return Err(error);
    }
    Ok(())
}

pub(super) fn metrics(hwnd: HWND) -> WindowChromeMetrics {
    let Some(state) = state_for(hwnd) else {
        return fallback_metrics();
    };
    if !state.overlay_enabled.load(Ordering::Acquire) {
        return fallback_metrics();
    }
    if !has_caption_style(hwnd) {
        return overlay_metrics(&state, 0.0, 0.0);
    }
    if unsafe { IsIconic(hwnd) } != 0 || unsafe { IsWindowVisible(hwnd) } == 0 {
        return estimated_overlay_metrics(hwnd, &state);
    }

    let mut button_bounds = RECT::default();
    let bounds_result = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_BUTTON_BOUNDS as u32,
            (&mut button_bounds as *mut RECT).cast(),
            size_of::<RECT>() as u32,
        )
    };
    let mut window_bounds = RECT::default();
    let has_window_bounds = unsafe { GetWindowRect(hwnd, &mut window_bounds) } != 0;

    // DWM 拒绝返回可用边界时，用随 DPI 缩放的系统按钮宽度保守占位，
    // 避免前端内容覆盖原生按钮。
    if !hresult_succeeded(bounds_result) || !has_window_bounds {
        return estimated_overlay_metrics(hwnd, &state);
    }

    let window_width = window_bounds.right.saturating_sub(window_bounds.left);
    let button_width = button_bounds.right.saturating_sub(button_bounds.left);
    let button_height = button_bounds.bottom.saturating_sub(button_bounds.top);
    if window_width <= 0
        || button_width <= 0
        || button_height <= 0
        || button_bounds.left < 0
        || button_bounds.right > window_width
    {
        return estimated_overlay_metrics(hwnd, &state);
    }

    let left_gap = button_bounds.left;
    let right_gap = window_width.saturating_sub(button_bounds.right);
    let inset_px = if left_gap <= right_gap {
        button_bounds.right
    } else {
        window_width.saturating_sub(button_bounds.left)
    };
    if inset_px <= 0 {
        return estimated_overlay_metrics(hwnd, &state);
    }

    let scale = dpi_scale(hwnd);
    let inset = f64::from(inset_px) / scale;
    let (left_inset, right_inset) = if left_gap <= right_gap {
        (inset, 0.0)
    } else {
        (0.0, inset)
    };

    overlay_metrics(&state, left_inset, right_inset)
}

pub(super) fn rollback_to_standard_frame(hwnd: HWND) {
    if hwnd.is_null() {
        return;
    }

    if let Some(state) = state_for(hwnd) {
        state.overlay_enabled.store(false, Ordering::Release);
        stop_webview_clip_tracking(hwnd, &state);
    }

    let mut callback_state = 0usize;
    let has_subclass = unsafe {
        GetWindowSubclass(
            hwnd,
            Some(window_subclass_proc),
            SUBCLASS_ID,
            &mut callback_state,
        )
    } != 0;
    let subclass_removed = has_subclass
        && unsafe { RemoveWindowSubclass(hwnd, Some(window_subclass_proc), SUBCLASS_ID) } != 0;

    // Remove 失败时 callback 仍可能使用 dwRefData。必须同时保留 registry Arc 和
    // callback Arc，直到 WM_NCDESTROY 正常回收，避免悬空指针。
    if !has_subclass || subclass_removed {
        lock_states().remove(&(hwnd as usize));
    }
    if subclass_removed && callback_state != 0 {
        unsafe {
            drop(Arc::from_raw(callback_state as *const WindowChromeState));
        }
    }
    reset_standard_frame(hwnd);
}

unsafe extern "system" fn window_subclass_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _subclass_id: usize,
    callback_state: usize,
) -> LRESULT {
    let result = catch_unwind(AssertUnwindSafe(|| unsafe {
        window_subclass_proc_inner(hwnd, message, wparam, lparam, callback_state)
    }));

    match result {
        Ok(result) => result,
        Err(_) => unsafe { DefSubclassProc(hwnd, message, wparam, lparam) },
    }
}

unsafe fn window_subclass_proc_inner(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    callback_state: usize,
) -> LRESULT {
    if callback_state == 0 {
        return DefSubclassProc(hwnd, message, wparam, lparam);
    }
    let state = &*(callback_state as *const WindowChromeState);
    let overlay_active = overlay_is_active(hwnd, state);

    // Microsoft 要求自定义 frame 先让 DWM 处理消息。除 WM_NCHITTEST 外，
    // WM_NCMOUSELEAVE 也必须经过这里，否则原生按钮的 hover 状态会残留。
    let mut dwm_result = 0;
    let dwm_handled =
        overlay_active && DwmDefWindowProc(hwnd, message, wparam, lparam, &mut dwm_result) != 0;

    match message {
        WM_NCDESTROY => {
            // WM_NCDESTROY 必须继续交给 tao 清理它自己的窗口状态；DWM 即使报告
            // handled 也不能截断 subclass 链。返回后该 HWND 不再接收窗口消息。
            KillTimer(hwnd, WEBVIEW_CLIP_TIMER_ID);
            let result = DefSubclassProc(hwnd, message, wparam, lparam);
            let _ = RemoveWindowSubclass(hwnd, Some(window_subclass_proc), SUBCLASS_ID);
            lock_states().remove(&(hwnd as usize));
            drop(Arc::from_raw(callback_state as *const WindowChromeState));
            result
        }
        WM_NCCALCSIZE if overlay_active && wparam != 0 => {
            let params =
                lparam as *mut windows_sys::Win32::UI::WindowsAndMessaging::NCCALCSIZE_PARAMS;
            if params.is_null() {
                return DefSubclassProc(hwnd, message, wparam, lparam);
            }

            let original_window_rect = (*params).rgrc[0];
            let client_rect = &mut (*params).rgrc[0];
            *client_rect = original_window_rect;
            if IsZoomed(hwnd) != 0 {
                let inset_x = frame_thickness_x(hwnd);
                let inset_y = frame_thickness_y(hwnd);
                client_rect.left = client_rect.left.saturating_add(inset_x);
                client_rect.top = client_rect.top.saturating_add(inset_y);
                client_rect.right = client_rect.right.saturating_sub(inset_x);
                client_rect.bottom = client_rect.bottom.saturating_sub(inset_y);
            }
            0
        }
        WM_NCHITTEST if overlay_active => {
            if dwm_handled {
                return dwm_result;
            }
            if let Some(hit) = hit_test_resize_frame(hwnd, lparam) {
                return hit;
            }
            DefSubclassProc(hwnd, message, wparam, lparam)
        }
        WM_TIMER if wparam == WEBVIEW_CLIP_TIMER_ID => {
            if overlay_active {
                if refresh_webview_clip(hwnd, state).is_err() {
                    disable_overlay(hwnd, state);
                }
            } else {
                clear_webview_clip_regions(hwnd, state);
            }
            0
        }
        WM_DPICHANGED
        | WM_SIZE
        | WM_ACTIVATE
        | WM_DWMCOMPOSITIONCHANGED
        | WM_THEMECHANGED
        | WM_SETTINGCHANGE
        | WM_PARENTNOTIFY
        | WM_SHOWWINDOW
        | WM_WINDOWPOSCHANGED => {
            let result = if dwm_handled {
                dwm_result
            } else {
                DefSubclassProc(hwnd, message, wparam, lparam)
            };
            apply_theme_attributes(hwnd, state);
            if extend_custom_frame(hwnd, state).is_err() {
                disable_overlay(hwnd, state);
            } else if overlay_is_active(hwnd, state) && refresh_webview_clip(hwnd, state).is_err() {
                disable_overlay(hwnd, state);
            } else if !overlay_is_active(hwnd, state) {
                clear_webview_clip_regions(hwnd, state);
            }
            result
        }
        _ if dwm_handled => dwm_result,
        _ => DefSubclassProc(hwnd, message, wparam, lparam),
    }
}

fn apply_custom_frame(hwnd: HWND, state: &WindowChromeState) -> Result<(), String> {
    extend_custom_frame(hwnd, state)?;
    refresh_non_client_frame(hwnd)?;
    start_webview_clip_tracking(hwnd)?;
    refresh_webview_clip(hwnd, state)
}

fn extend_custom_frame(hwnd: HWND, state: &WindowChromeState) -> Result<(), String> {
    let top_margin = if overlay_is_active(hwnd, state) {
        dip_to_physical(hwnd, state.caption_height())
    } else {
        0
    };
    let margins = MARGINS {
        cxLeftWidth: 0,
        cxRightWidth: 0,
        cyTopHeight: top_margin,
        cyBottomHeight: 0,
    };
    let result = unsafe { DwmExtendFrameIntoClientArea(hwnd, &margins) };
    if !hresult_succeeded(result) {
        return Err(format!(
            "DwmExtendFrameIntoClientArea 失败：HRESULT=0x{:08X}",
            result as u32
        ));
    }
    Ok(())
}

fn rebuild_custom_frame_after_theme_change(
    hwnd: HWND,
    state: &WindowChromeState,
) -> Result<(), String> {
    // Windows 10 会用窗口背景擦除扩展标题栏；完整走一次标准 frame -> overlay，
    // 让系统在新背景色上重新合成三枚原生按钮，而不是留下旧主题底色或丢失 glyph。
    state.overlay_enabled.store(false, Ordering::Release);
    stop_webview_clip_tracking(hwnd, state);
    reset_standard_frame(hwnd);

    state.overlay_enabled.store(true, Ordering::Release);
    apply_theme_attributes(hwnd, state);
    if let Err(error) = apply_custom_frame(hwnd, state) {
        disable_overlay(hwnd, state);
        return Err(error);
    }
    Ok(())
}

fn refresh_non_client_frame(hwnd: HWND) -> Result<(), String> {
    let refreshed = unsafe {
        SetWindowPos(
            hwnd,
            ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        )
    };
    if refreshed == 0 {
        Err(last_os_error("刷新 Windows non-client frame 失败"))
    } else {
        Ok(())
    }
}

fn apply_theme_attributes(hwnd: HWND, state: &WindowChromeState) {
    let overlay_enabled = state.overlay_enabled.load(Ordering::Acquire);
    let (border_color, caption_color, caption_text_color) = if overlay_enabled {
        (
            DWMWA_COLOR_NONE,
            state.caption_color.load(Ordering::Relaxed),
            state.caption_text_color.load(Ordering::Relaxed),
        )
    } else {
        (
            DWMWA_COLOR_DEFAULT,
            DWMWA_COLOR_DEFAULT,
            DWMWA_COLOR_DEFAULT,
        )
    };

    unsafe {
        // 这些属性在旧版 Windows 上可能返回 E_INVALIDARG，均为可选增强，不能让窗口失效。
        apply_immersive_dark_mode(hwnd, state.dark.load(Ordering::Relaxed));
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR as u32,
            (&border_color as *const u32).cast(),
            size_of::<u32>() as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_COLOR as u32,
            (&caption_color as *const u32).cast(),
            size_of::<u32>() as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TEXT_COLOR as u32,
            (&caption_text_color as *const u32).cast(),
            size_of::<u32>() as u32,
        );
    }
}

fn default_caption_color(dark: bool) -> u32 {
    if dark {
        DEFAULT_DARK_CAPTION_COLOR
    } else {
        DEFAULT_LIGHT_CAPTION_COLOR
    }
}

fn default_caption_text_color(dark: bool) -> u32 {
    if dark {
        DEFAULT_DARK_CAPTION_TEXT_COLOR
    } else {
        DEFAULT_LIGHT_CAPTION_TEXT_COLOR
    }
}

fn apply_immersive_dark_mode(hwnd: HWND, dark: bool) {
    let dark = i32::from(dark);
    unsafe {
        // Windows 10 早期版本不支持该属性；标准 fallback 仍应尝试与 Nomo 主题同步。
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE as u32,
            (&dark as *const i32).cast(),
            size_of::<i32>() as u32,
        );
    }
}

fn disable_overlay(hwnd: HWND, state: &WindowChromeState) {
    state.overlay_enabled.store(false, Ordering::Release);
    stop_webview_clip_tracking(hwnd, state);
    reset_standard_frame(hwnd);
}

fn start_webview_clip_tracking(hwnd: HWND) -> Result<(), String> {
    let timer = unsafe { SetTimer(hwnd, WEBVIEW_CLIP_TIMER_ID, WEBVIEW_CLIP_REFRESH_MS, None) };
    if timer == 0 {
        Err(last_os_error("启动 WebView 原生按钮避让刷新失败"))
    } else {
        Ok(())
    }
}

fn stop_webview_clip_tracking(hwnd: HWND, state: &WindowChromeState) {
    unsafe {
        KillTimer(hwnd, WEBVIEW_CLIP_TIMER_ID);
    }
    clear_webview_clip_regions(hwnd, state);
}

fn refresh_webview_clip(hwnd: HWND, state: &WindowChromeState) -> Result<(), String> {
    if !overlay_is_active(hwnd, state) {
        clear_webview_clip_regions(hwnd, state);
        return Ok(());
    }

    let webview = unsafe {
        FindWindowExW(
            hwnd,
            ptr::null_mut(),
            WRY_WEBVIEW_CLASS.as_ptr(),
            ptr::null(),
        )
    };
    if webview.is_null() {
        // WebView2 may still be booting. The timer retries before the hidden window is shown.
        return Ok(());
    }

    let Some(button_bounds) = caption_button_screen_bounds(hwnd, state) else {
        return Err("无法读取 Windows 原生标题栏按钮范围".to_string());
    };
    let mut window_bounds = RECT::default();
    if unsafe { GetWindowRect(hwnd, &mut window_bounds) } == 0 {
        return Err(last_os_error("读取 Windows 顶层窗口范围失败"));
    }
    let has_resize_frame = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) } as u32 & WS_THICKFRAME
        != 0
        && unsafe { IsZoomed(hwnd) } == 0;
    let resize_inset_x = if has_resize_frame {
        frame_thickness_x(hwnd)
    } else {
        0
    };
    let resize_inset_y = if has_resize_frame {
        frame_thickness_y(hwnd)
    } else {
        0
    };

    let mut webview_windows = vec![webview];
    unsafe {
        EnumChildWindows(
            webview,
            Some(collect_child_window),
            (&mut webview_windows as *mut Vec<HWND>) as LPARAM,
        );
    }

    let mut current_handles = std::collections::HashSet::with_capacity(webview_windows.len());
    let cached = state
        .clipped_webview_windows
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();
    let mut next_cache = cached.clone();
    let mut clip_changed = false;

    for child in webview_windows {
        let handle = child as usize;
        current_handles.insert(handle);
        let mut child_bounds = RECT::default();
        if unsafe { GetWindowRect(child, &mut child_bounds) } == 0 {
            return Err(last_os_error("读取 WebView 子窗口范围失败"));
        }

        let Some(geometry) = webview_clip_geometry(
            child_bounds,
            button_bounds,
            window_bounds,
            resize_inset_x,
            resize_inset_y,
        ) else {
            if let Some(entry) = next_cache.remove(&handle) {
                restore_webview_clip_entry(child, &entry)?;
                store_webview_clip_cache(state, &next_cache);
                clip_changed = true;
            }
            continue;
        };

        let identity = read_webview_window_identity(child)?;
        if let Some(entry) = cached.get(&handle) {
            if entry.identity == identity
                && entry.root_webview == webview as usize
                && entry.geometry == geometry
            {
                continue;
            }
            if entry.identity == identity && entry.root_webview == webview as usize {
                apply_webview_clip_region(child, geometry)?;
                let updated_entry = WebviewClipEntry {
                    geometry,
                    ..entry.clone()
                };
                next_cache.insert(handle, updated_entry);
                store_webview_clip_cache(state, &next_cache);
                clip_changed = true;
                continue;
            }

            // The HWND was reused for another renderer window. Never restore the previous
            // region onto the new identity; only release the copy owned by this module.
            discard_original_region(entry);
            next_cache.remove(&handle);
            store_webview_clip_cache(state, &next_cache);
        }

        let entry = capture_webview_clip_entry(child, webview, geometry, identity)?;
        if let Err(error) = apply_webview_clip_region(child, geometry) {
            discard_original_region(&entry);
            return Err(error);
        }
        next_cache.insert(handle, entry);
        store_webview_clip_cache(state, &next_cache);
        clip_changed = true;
    }

    let stale_handles: Vec<usize> = next_cache
        .keys()
        .filter(|handle| !current_handles.contains(handle))
        .copied()
        .collect();
    for handle in stale_handles {
        if let Some(entry) = next_cache.remove(&handle) {
            restore_webview_clip_entry(handle as HWND, &entry)?;
            store_webview_clip_cache(state, &next_cache);
            clip_changed = true;
        }
    }

    store_webview_clip_cache(state, &next_cache);
    if clip_changed {
        redraw_native_frame(hwnd)?;
    }
    Ok(())
}

unsafe extern "system" fn collect_child_window(hwnd: HWND, lparam: LPARAM) -> i32 {
    if lparam != 0 {
        (*(lparam as *mut Vec<HWND>)).push(hwnd);
    }
    1
}

fn store_webview_clip_cache(state: &WindowChromeState, cache: &HashMap<usize, WebviewClipEntry>) {
    *state
        .clipped_webview_windows
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = cache.clone();
}

fn read_webview_window_identity(hwnd: HWND) -> Result<WebviewWindowIdentity, String> {
    if unsafe { IsWindow(hwnd) } == 0 {
        return Err("WebView 子窗口已销毁".to_string());
    }

    let mut process_id = 0u32;
    let thread_id = unsafe { GetWindowThreadProcessId(hwnd, &mut process_id) };
    if thread_id == 0 || process_id == 0 {
        return Err(last_os_error("读取 WebView 子窗口进程身份失败"));
    }

    let mut class_name = vec![0u16; 256];
    let class_name_length =
        unsafe { GetClassNameW(hwnd, class_name.as_mut_ptr(), class_name.len() as i32) };
    if class_name_length <= 0 {
        return Err(last_os_error("读取 WebView 子窗口类名失败"));
    }
    class_name.truncate(class_name_length as usize);

    Ok(WebviewWindowIdentity {
        process_id,
        thread_id,
        parent: unsafe { GetParent(hwnd) } as usize,
        class_name,
    })
}

fn capture_webview_clip_entry(
    hwnd: HWND,
    root_webview: HWND,
    geometry: WebviewClipGeometry,
    identity: WebviewWindowIdentity,
) -> Result<WebviewClipEntry, String> {
    let region = unsafe { CreateRectRgn(0, 0, 0, 0) };
    if region.is_null() {
        return Err(last_os_error("创建 WebView 原始区域副本失败"));
    }
    let region_type = unsafe { GetWindowRgn(hwnd, region) };
    let original_region = if region_type == 0 {
        // GetWindowRgn uses ERROR both for "no window region" and for an API error.
        // The HWND identity was just validated, so this is the normal no-region case.
        unsafe {
            DeleteObject(region);
        }
        None
    } else {
        Some(region as usize)
    };

    Ok(WebviewClipEntry {
        geometry,
        identity,
        root_webview: root_webview as usize,
        original_region,
    })
}

fn restore_webview_clip_entry(hwnd: HWND, entry: &WebviewClipEntry) -> Result<(), String> {
    if !webview_clip_entry_still_matches(hwnd, entry) {
        discard_original_region(entry);
        return Ok(());
    }

    let original_region = entry
        .original_region
        .map(|region| region as windows_sys::Win32::Graphics::Gdi::HRGN)
        .unwrap_or(ptr::null_mut());
    if unsafe { SetWindowRgn(hwnd, original_region, 1) } == 0 {
        return Err(last_os_error("恢复 WebView 原始窗口区域失败"));
    }
    // A non-null original region is now owned by the system again.
    Ok(())
}

fn webview_clip_entry_still_matches(hwnd: HWND, entry: &WebviewClipEntry) -> bool {
    let root_webview = entry.root_webview as HWND;
    if unsafe { IsWindow(hwnd) } == 0 || unsafe { IsWindow(root_webview) } == 0 {
        return false;
    }
    if hwnd != root_webview && unsafe { IsChild(root_webview, hwnd) } == 0 {
        return false;
    }
    matches!(
        read_webview_window_identity(hwnd),
        Ok(identity) if identity == entry.identity
    )
}

fn discard_original_region(entry: &WebviewClipEntry) {
    if let Some(region) = entry.original_region {
        unsafe {
            DeleteObject(region as windows_sys::Win32::Graphics::Gdi::HRGN);
        }
    }
}

fn caption_button_screen_bounds(hwnd: HWND, state: &WindowChromeState) -> Option<RECT> {
    let mut window_bounds = RECT::default();
    if unsafe { GetWindowRect(hwnd, &mut window_bounds) } == 0 {
        return None;
    }

    let mut button_bounds = RECT::default();
    let result = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_BUTTON_BOUNDS as u32,
            (&mut button_bounds as *mut RECT).cast(),
            size_of::<RECT>() as u32,
        )
    };
    let window_width = window_bounds.right.saturating_sub(window_bounds.left);
    if hresult_succeeded(result)
        && button_bounds.right > button_bounds.left
        && button_bounds.bottom > button_bounds.top
        && button_bounds.left >= 0
        && button_bounds.right <= window_width
    {
        return Some(RECT {
            left: window_bounds.left.saturating_add(button_bounds.left),
            top: window_bounds.top.saturating_add(button_bounds.top),
            right: window_bounds.left.saturating_add(button_bounds.right),
            bottom: window_bounds.top.saturating_add(button_bounds.bottom),
        });
    }

    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) } as u32;
    let button_count =
        1 + usize::from(style & WS_MINIMIZEBOX != 0) + usize::from(style & WS_MAXIMIZEBOX != 0);
    let inset = unsafe { GetSystemMetricsForDpi(SM_CXSIZE, dpi(hwnd)) }
        .saturating_mul(button_count as i32)
        .saturating_add(frame_thickness_x(hwnd));
    let height = dip_to_physical(hwnd, state.caption_height());
    let extended_style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) } as u32;
    if extended_style & WS_EX_LAYOUTRTL != 0 {
        Some(RECT {
            left: window_bounds.left,
            top: window_bounds.top,
            right: window_bounds.left.saturating_add(inset),
            bottom: window_bounds.top.saturating_add(height),
        })
    } else {
        Some(RECT {
            left: window_bounds.right.saturating_sub(inset),
            top: window_bounds.top,
            right: window_bounds.right,
            bottom: window_bounds.top.saturating_add(height),
        })
    }
}

fn webview_clip_geometry(
    child_bounds: RECT,
    button_bounds: RECT,
    window_bounds: RECT,
    resize_inset_x: i32,
    resize_inset_y: i32,
) -> Option<WebviewClipGeometry> {
    let width = child_bounds.right.saturating_sub(child_bounds.left);
    let height = child_bounds.bottom.saturating_sub(child_bounds.top);
    if width <= 0 || height <= 0 {
        return None;
    }

    let region_left = window_bounds
        .left
        .saturating_add(resize_inset_x)
        .saturating_sub(child_bounds.left)
        .clamp(0, width);
    let region_top = window_bounds
        .top
        .saturating_add(resize_inset_y)
        .saturating_sub(child_bounds.top)
        .clamp(0, height);
    let region_right = window_bounds
        .right
        .saturating_sub(resize_inset_x)
        .saturating_sub(child_bounds.left)
        .clamp(0, width);
    let region_bottom = window_bounds
        .bottom
        .saturating_sub(resize_inset_y)
        .saturating_sub(child_bounds.top)
        .clamp(0, height);
    if region_right <= region_left || region_bottom <= region_top {
        return None;
    }

    let intersection_left = child_bounds.left.max(button_bounds.left);
    let intersection_top = child_bounds.top.max(button_bounds.top);
    let intersection_right = child_bounds.right.min(button_bounds.right);
    let intersection_bottom = child_bounds.bottom.min(button_bounds.bottom);
    let has_button_intersection =
        intersection_right > intersection_left && intersection_bottom > intersection_top;

    Some(WebviewClipGeometry {
        width,
        height,
        region_left,
        region_top,
        region_right,
        region_bottom,
        hole_left: if has_button_intersection {
            intersection_left.saturating_sub(child_bounds.left)
        } else {
            0
        },
        hole_top: if has_button_intersection {
            intersection_top.saturating_sub(child_bounds.top)
        } else {
            0
        },
        hole_right: if has_button_intersection {
            intersection_right.saturating_sub(child_bounds.left)
        } else {
            0
        },
        hole_bottom: if has_button_intersection {
            intersection_bottom.saturating_sub(child_bounds.top)
        } else {
            0
        },
    })
}

fn apply_webview_clip_region(hwnd: HWND, geometry: WebviewClipGeometry) -> Result<(), String> {
    let clipped_region = unsafe {
        CreateRectRgn(
            geometry.region_left,
            geometry.region_top,
            geometry.region_right,
            geometry.region_bottom,
        )
    };
    if clipped_region.is_null() {
        return Err(last_os_error("创建 WebView 可视区域失败"));
    }

    let has_button_hole =
        geometry.hole_right > geometry.hole_left && geometry.hole_bottom > geometry.hole_top;
    if has_button_hole {
        let hole_region = unsafe {
            CreateRectRgn(
                geometry.hole_left,
                geometry.hole_top,
                geometry.hole_right,
                geometry.hole_bottom,
            )
        };
        let combined_region = unsafe { CreateRectRgn(0, 0, 0, 0) };
        if hole_region.is_null() || combined_region.is_null() {
            unsafe {
                DeleteObject(clipped_region);
                if !hole_region.is_null() {
                    DeleteObject(hole_region);
                }
                if !combined_region.is_null() {
                    DeleteObject(combined_region);
                }
            }
            return Err(last_os_error("创建 WebView 原生按钮避让区域失败"));
        }

        let combined =
            unsafe { CombineRgn(combined_region, clipped_region, hole_region, RGN_DIFF) };
        unsafe {
            DeleteObject(clipped_region);
            DeleteObject(hole_region);
        }
        if combined == 0 {
            unsafe {
                DeleteObject(combined_region);
            }
            return Err(last_os_error("合并 WebView 原生按钮避让区域失败"));
        }
        return set_webview_region(hwnd, combined_region);
    }

    set_webview_region(hwnd, clipped_region)
}

fn set_webview_region(
    hwnd: HWND,
    region: windows_sys::Win32::Graphics::Gdi::HRGN,
) -> Result<(), String> {
    if unsafe { SetWindowRgn(hwnd, region, 1) } == 0 {
        unsafe {
            DeleteObject(region);
        }
        return Err(last_os_error("应用 WebView 原生按钮避让区域失败"));
    }
    // SetWindowRgn 成功后区域句柄归系统所有，不能再 DeleteObject。
    Ok(())
}

fn clear_webview_clip_regions(hwnd: HWND, state: &WindowChromeState) {
    let cached = std::mem::take(
        &mut *state
            .clipped_webview_windows
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()),
    );
    for (handle, entry) in cached {
        if let Err(error) = restore_webview_clip_entry(handle as HWND, &entry) {
            if webview_clip_entry_still_matches(handle as HWND, &entry) {
                unsafe {
                    let _ = SetWindowRgn(handle as HWND, ptr::null_mut(), 1);
                }
            }
            discard_original_region(&entry);
            crate::app_logger::warn(
                "Window",
                &format!("恢复 WebView 原始裁剪区域失败：hwnd=0x{handle:X} error={error}"),
            );
        }
    }
    let _ = redraw_native_frame(hwnd);
}

fn redraw_native_frame(hwnd: HWND) -> Result<(), String> {
    let redrawn = unsafe {
        RedrawWindow(
            hwnd,
            ptr::null(),
            ptr::null_mut(),
            RDW_FRAME | RDW_INVALIDATE | RDW_UPDATENOW,
        )
    };
    if redrawn == 0 {
        Err(last_os_error("重绘 Windows 原生标题栏按钮失败"))
    } else {
        Ok(())
    }
}

fn reset_standard_frame(hwnd: HWND) {
    let margins = MARGINS::default();
    let border_color = DWMWA_COLOR_DEFAULT;
    let caption_color = DWMWA_COLOR_DEFAULT;
    let caption_text_color = DWMWA_COLOR_DEFAULT;
    unsafe {
        let _ = DwmExtendFrameIntoClientArea(hwnd, &margins);
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR as u32,
            (&border_color as *const u32).cast(),
            size_of::<u32>() as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_COLOR as u32,
            (&caption_color as *const u32).cast(),
            size_of::<u32>() as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TEXT_COLOR as u32,
            (&caption_text_color as *const u32).cast(),
            size_of::<u32>() as u32,
        );
        let _ = SetWindowPos(
            hwnd,
            ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        );
    }
}

fn hit_test_resize_frame(hwnd: HWND, lparam: LPARAM) -> Option<LRESULT> {
    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) } as u32;
    if style & WS_THICKFRAME == 0 || unsafe { IsZoomed(hwnd) } != 0 {
        return None;
    }

    let mut window_rect = RECT::default();
    if unsafe { GetWindowRect(hwnd, &mut window_rect) } == 0 {
        return None;
    }

    let packed = lparam as u32;
    let cursor_x = (packed as u16 as i16) as i32;
    let cursor_y = ((packed >> 16) as u16 as i16) as i32;
    let border_x = frame_thickness_x(hwnd);
    let border_y = frame_thickness_y(hwnd);

    if cursor_x < window_rect.left
        || cursor_x >= window_rect.right
        || cursor_y < window_rect.top
        || cursor_y >= window_rect.bottom
    {
        return None;
    }

    let on_left = cursor_x < window_rect.left.saturating_add(border_x);
    let on_right = cursor_x >= window_rect.right.saturating_sub(border_x);
    let on_top = cursor_y < window_rect.top.saturating_add(border_y);
    let on_bottom = cursor_y >= window_rect.bottom.saturating_sub(border_y);

    match (on_left, on_right, on_top, on_bottom) {
        (true, _, true, _) => Some(HTTOPLEFT as LRESULT),
        (_, true, true, _) => Some(HTTOPRIGHT as LRESULT),
        (true, _, _, true) => Some(HTBOTTOMLEFT as LRESULT),
        (_, true, _, true) => Some(HTBOTTOMRIGHT as LRESULT),
        (true, _, _, _) => Some(HTLEFT as LRESULT),
        (_, true, _, _) => Some(HTRIGHT as LRESULT),
        (_, _, true, _) => Some(HTTOP as LRESULT),
        (_, _, _, true) => Some(HTBOTTOM as LRESULT),
        _ => None,
    }
}

fn overlay_is_active(hwnd: HWND, state: &WindowChromeState) -> bool {
    state.overlay_enabled.load(Ordering::Acquire) && has_caption_style(hwnd)
}

fn has_caption_style(hwnd: HWND) -> bool {
    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) } as u32;
    style & WS_CAPTION == WS_CAPTION
}

fn state_for(hwnd: HWND) -> Option<Arc<WindowChromeState>> {
    if hwnd.is_null() {
        return None;
    }
    lock_states().get(&(hwnd as usize)).cloned()
}

fn lock_states() -> std::sync::MutexGuard<'static, HashMap<usize, Arc<WindowChromeState>>> {
    WINDOW_STATES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn dpi(hwnd: HWND) -> u32 {
    let dpi = unsafe { GetDpiForWindow(hwnd) };
    if dpi == 0 {
        DEFAULT_DPI
    } else {
        dpi
    }
}

fn dpi_scale(hwnd: HWND) -> f64 {
    f64::from(dpi(hwnd)) / f64::from(DEFAULT_DPI)
}

fn dip_to_physical(hwnd: HWND, value: f64) -> i32 {
    (value * dpi_scale(hwnd))
        .round()
        .clamp(1.0, f64::from(i32::MAX)) as i32
}

fn frame_thickness_x(hwnd: HWND) -> i32 {
    let dpi = dpi(hwnd);
    unsafe {
        GetSystemMetricsForDpi(SM_CXFRAME, dpi)
            .saturating_add(GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi))
    }
}

fn frame_thickness_y(hwnd: HWND) -> i32 {
    let dpi = dpi(hwnd);
    unsafe {
        GetSystemMetricsForDpi(SM_CYFRAME, dpi)
            .saturating_add(GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi))
    }
}

fn fallback_metrics() -> WindowChromeMetrics {
    WindowChromeMetrics {
        overlay_enabled: false,
        left_inset: 0.0,
        right_inset: 0.0,
        caption_height: 0.0,
    }
}

fn estimated_overlay_metrics(hwnd: HWND, state: &WindowChromeState) -> WindowChromeMetrics {
    let dpi = dpi(hwnd);
    let inset_px = unsafe { GetSystemMetricsForDpi(SM_CXSIZE, dpi) }
        .saturating_mul(3)
        .saturating_add(frame_thickness_x(hwnd));
    let inset = f64::from(inset_px.max(0)) / dpi_scale(hwnd);
    let extended_style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) } as u32;

    if extended_style & WS_EX_LAYOUTRTL != 0 {
        overlay_metrics(state, inset, 0.0)
    } else {
        overlay_metrics(state, 0.0, inset)
    }
}

fn overlay_metrics(
    state: &WindowChromeState,
    left_inset: f64,
    right_inset: f64,
) -> WindowChromeMetrics {
    WindowChromeMetrics {
        overlay_enabled: true,
        left_inset,
        right_inset,
        caption_height: state.caption_height(),
    }
}

fn hresult_succeeded(result: i32) -> bool {
    result >= 0
}

fn last_os_error(context: &str) -> String {
    format!("{context}：{}", std::io::Error::last_os_error())
}
