use crate::models::WindowStateInput;
use crate::window::menu::install_window_menu;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

pub(crate) const SETTINGS_WINDOW_LABEL: &str = "window-settings";
static FORCE_CLOSE_LABELS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static SETTINGS_CLOSE_HANDLER_READY: AtomicBool = AtomicBool::new(false);
static SETTINGS_CLOSE_REQUEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static PENDING_SETTINGS_CLOSE_REQUEST: AtomicU64 = AtomicU64::new(0);
static ACKNOWLEDGED_SETTINGS_CLOSE_REQUEST: AtomicU64 = AtomicU64::new(0);
static SETTINGS_OWNER_LABEL: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static DEFERRED_SETTINGS_ACTION: OnceLock<Mutex<Option<DeferredSettingsAction>>> = OnceLock::new();

pub(crate) enum DeferredSettingsAction {
    CloseOwner(String),
    ExitApp,
}

#[tauri::command]
pub(crate) fn update_window_state(
    app: AppHandle,
    key: String,
    input: WindowStateInput,
) -> Result<(), String> {
    crate::app_logger::debug("Window", &format!("更新窗口状态：key={key}"));
    crate::config::commands::update_app_setting(
        app,
        crate::models::SettingInput {
            key,
            value_json: serde_json::to_string(&input)
                .map_err(|error| format!("序列化窗口状态失败：{error}"))?,
        },
    )
}

#[tauri::command]
pub(crate) fn refresh_window_menu(
    app: AppHandle,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    crate::app_logger::info("Window", &format!("刷新窗口菜单：{}", window.label()));
    if let Err(error) = crate::window::os::setup_window(&window) {
        crate::app_logger::warn(
            "Window",
            &format!(
                "初始化窗口原生 chrome 失败，继续使用系统标题栏：label={} error={error}",
                window.label()
            ),
        );
    }
    let menu_result = install_window_menu(&app, &window);
    crate::window::state::restore_window_state(&app, window.label());
    if matches!(window.is_visible(), Ok(false))
        && window.label() != "main"
        && crate::window::external_open::is_document_window_label(window.label())
    {
        window
            .set_skip_taskbar(false)
            .map_err(|error| format!("在任务栏显示文档窗口失败：{error}"))?;
        window
            .show()
            .map_err(|error| format!("显示文档窗口失败：{error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("聚焦文档窗口失败：{error}"))?;
    }
    if let Err(error) = window.emit("nomo://window-chrome-changed", ()) {
        crate::app_logger::warn(
            "Window",
            &format!(
                "通知窗口 chrome 初始化完成失败：label={} error={error}",
                window.label()
            ),
        );
    }
    menu_result
}

#[tauri::command]
pub(crate) fn get_window_chrome_metrics(
    window: tauri::WebviewWindow,
) -> Result<crate::window::os::WindowChromeMetrics, String> {
    crate::window::os::get_window_chrome_metrics(&window)
}

#[tauri::command]
pub(crate) fn report_window_title(
    app: AppHandle,
    window: tauri::WebviewWindow,
    title: String,
) -> Result<(), String> {
    if !crate::window::external_open::is_document_window_label(window.label()) {
        return Ok(());
    }

    crate::window::tray::record_window_title(&app, window.label(), &title)
}

#[tauri::command]
pub(crate) fn refresh_interface_language_chrome(app: AppHandle) -> Result<(), String> {
    crate::app_logger::info("Window", "刷新界面语言相关窗口 chrome");
    for (_label, window) in app.webview_windows() {
        if crate::window::external_open::is_document_window_label(window.label()) {
            if let Err(error) = crate::window::os::setup_window(&window) {
                crate::app_logger::warn(
                    "Window",
                    &format!(
                        "刷新窗口原生 chrome 失败，继续使用系统标题栏：label={} error={error}",
                        window.label()
                    ),
                );
            }
            install_window_menu(&app, &window)?;
        } else if window.label() == SETTINGS_WINDOW_LABEL {
            window
                .set_title(crate::i18n::app_text(&app, "settings_window_title"))
                .map_err(|error| format!("刷新偏好设置窗口标题失败：{error}"))?;
        }
    }
    crate::window::tray::refresh_tray_menu(&app)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn set_desktop_icon_theme(
    app: AppHandle,
    theme: String,
    caption_background: Option<String>,
    caption_foreground: Option<String>,
) -> Result<(), String> {
    crate::app_logger::info("Tray", &format!("设置桌面图标主题：{theme}"));
    let dark = match theme.as_str() {
        "dark" => true,
        "light" => false,
        _ => return Err(format!("不支持的桌面主题：{theme}")),
    };

    let fallback_background = if dark { (24, 29, 35) } else { (243, 244, 246) };
    let fallback_foreground = if dark { (204, 204, 204) } else { (51, 51, 51) };
    let caption_background_rgb = caption_background
        .as_deref()
        .and_then(parse_css_hex_rgb)
        .unwrap_or(fallback_background);
    let caption_foreground_rgb = caption_foreground
        .as_deref()
        .and_then(parse_css_hex_rgb)
        .unwrap_or(fallback_foreground);
    let caption_color = rgb_to_colorref(caption_background_rgb);
    let caption_text_color = rgb_to_colorref(caption_foreground_rgb);

    for (_label, window) in app.webview_windows() {
        #[cfg(windows)]
        if let Err(error) = window.set_background_color(dark.then_some(tauri::window::Color(
            caption_background_rgb.0,
            caption_background_rgb.1,
            caption_background_rgb.2,
            255,
        ))) {
            crate::app_logger::warn(
                "Window",
                &format!(
                    "同步窗口原生背景色失败：label={} error={error}",
                    window.label()
                ),
            );
        }
        if let Err(error) = crate::window::os::set_window_chrome_theme(
            &window,
            dark,
            Some(caption_color),
            Some(caption_text_color),
        ) {
            crate::app_logger::warn(
                "Window",
                &format!(
                    "同步窗口原生 chrome 主题失败：label={} error={error}",
                    window.label()
                ),
            );
        }
    }

    crate::window::tray::set_desktop_icon_theme(&app, &theme)
}

fn parse_css_hex_rgb(value: &str) -> Option<(u8, u8, u8)> {
    let hex = value.strip_prefix('#')?;
    match hex.len() {
        3 => {
            let mut digits = hex
                .chars()
                .map(|digit| digit.to_digit(16).map(|value| value as u8));
            let red = digits.next()??;
            let green = digits.next()??;
            let blue = digits.next()??;
            Some((red * 17, green * 17, blue * 17))
        }
        6 => {
            let color = u32::from_str_radix(hex, 16).ok()?;
            Some(((color >> 16) as u8, (color >> 8) as u8, color as u8))
        }
        _ => None,
    }
}

fn rgb_to_colorref((red, green, blue): (u8, u8, u8)) -> u32 {
    u32::from(red) | (u32::from(green) << 8) | (u32::from(blue) << 16)
}

#[tauri::command]
pub(crate) fn get_desktop_system_theme() -> &'static str {
    let theme = crate::window::os::system_theme();
    crate::app_logger::debug("Window", &format!("读取系统主题：{theme}"));
    theme
}

#[tauri::command]
pub(crate) fn create_new_window(
    app: AppHandle,
    pending_folder: Option<String>,
) -> Result<String, String> {
    let timer = std::time::Instant::now();
    let id = format!("window-{}", crate::config::now_ts());
    crate::app_logger::info(
        "Window",
        &format!(
            "准备创建新窗口：id={id} pendingFolder={}",
            pending_folder.as_deref().unwrap_or("")
        ),
    );

    // 新窗口加载前先写入待打开目录，避免前端初始化读取设置时发生竞态。
    if let Some(folder) = pending_folder {
        crate::config::commands::update_app_setting(
            app.clone(),
            crate::models::SettingInput {
                key: format!("pendingFolder:{}", id),
                value_json: serde_json::to_string(&folder)
                    .map_err(|error| format!("序列化待打开文件夹失败：{error}"))?,
            },
        )?;
    }

    crate::app_logger::perf("Window", "创建新窗口准备", timer.elapsed());
    Ok(id)
}

#[tauri::command]
pub(crate) async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    open_settings_window_for_app(app).await
}

pub(crate) async fn open_settings_window_for_app<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    let timer = std::time::Instant::now();
    crate::app_logger::info("Settings", "开始打开设置窗口");

    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        crate::app_logger::info("Settings", "设置窗口已存在，将其前置");
        bring_settings_window_to_front(&window)?;
        crate::app_logger::perf("Settings", "打开设置窗口（已存在）", timer.elapsed());
        return Ok(());
    }

    reset_settings_close_handler_ready();
    clear_pending_settings_close_request();
    remember_settings_owner_label(None);

    let builder = WebviewWindowBuilder::new(
        &app,
        SETTINGS_WINDOW_LABEL,
        WebviewUrl::App(PathBuf::from("index.html?view=settings")),
    )
    .title(crate::i18n::app_text(&app, "settings_window_title"))
    .inner_size(860.0, 620.0)
    .min_inner_size(760.0, 520.0)
    .center()
    .decorations(crate::window::os::window_decorations())
    .resizable(true)
    .skip_taskbar(true)
    .visible(false);

    #[cfg(windows)]
    let settings_owner = settings_owner_window(&app);

    #[cfg(windows)]
    let builder = {
        let mut builder = builder;
        if let Some(owner) = settings_owner.as_ref() {
            builder = builder
                .owner(owner)
                .map_err(|error| format!("绑定偏好设置父窗口失败：{error}"))?;
        }
        builder
    };

    let window = builder
        .build()
        .map_err(|error| format!("创建偏好设置窗口失败：{error}"))?;

    #[cfg(windows)]
    remember_settings_owner_label(
        settings_owner
            .as_ref()
            .map(|owner| owner.label().to_string()),
    );

    // 先在隐藏状态下完成系统窗口适配和历史位置恢复，避免用户看到居中位置再跳到保存位置。
    if let Err(error) = crate::window::os::setup_window(&window) {
        crate::app_logger::warn(
            "Settings",
            &format!("初始化偏好设置窗口原生 chrome 失败，继续使用系统标题栏：{error}"),
        );
    }
    crate::window::state::restore_window_state(&app, window.label());
    if let Err(error) = window.emit("nomo://window-chrome-changed", ()) {
        crate::app_logger::warn(
            "Settings",
            &format!("通知偏好设置窗口 chrome 初始化完成失败：{error}"),
        );
    }
    bring_settings_window_to_front(&window)?;
    crate::app_logger::info("Settings", "设置窗口创建并显示完成");
    crate::app_logger::perf("Settings", "打开设置窗口", timer.elapsed());

    Ok(())
}

#[tauri::command]
pub(crate) fn enter_markdown_mini_mode(
    window: tauri::WebviewWindow,
    pinned: bool,
) -> Result<(), String> {
    if !crate::window::external_open::is_document_window_label(window.label()) {
        return Err("只有文档窗口可以进入 Markdown 小窗模式".to_string());
    }
    let timer = std::time::Instant::now();
    crate::app_logger::info(
        "Window",
        &format!("主窗口进入 Markdown 小窗模式：{}", window.label()),
    );
    crate::window::state::enter_markdown_mini_mode(&window, pinned)?;
    crate::app_logger::perf("Window", "进入 Markdown 小窗模式", timer.elapsed());
    Ok(())
}

#[tauri::command]
pub(crate) fn exit_markdown_mini_mode(window: tauri::WebviewWindow) -> Result<(), String> {
    if !crate::window::external_open::is_document_window_label(window.label()) {
        return Err("当前窗口不是文档窗口".to_string());
    }
    let timer = std::time::Instant::now();
    crate::app_logger::info(
        "Window",
        &format!("主窗口退出 Markdown 小窗模式：{}", window.label()),
    );
    crate::window::state::exit_markdown_mini_mode(&window)?;
    crate::app_logger::perf("Window", "退出 Markdown 小窗模式", timer.elapsed());
    Ok(())
}

#[tauri::command]
pub(crate) fn set_markdown_mini_mode_pinned(
    window: tauri::WebviewWindow,
    pinned: bool,
) -> Result<(), String> {
    crate::window::state::set_markdown_mini_mode_pinned(&window, pinned)
}

#[tauri::command]
pub(crate) fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let label = window.label().to_string();
    crate::app_logger::info("Window", &format!("关闭窗口：{label}"));
    if label == SETTINGS_WINDOW_LABEL {
        clear_pending_settings_close_request();
    }
    allow_next_close(&label)?;
    let result = window
        .close()
        .map_err(|error| format!("关闭窗口失败：{error}"));
    if result.is_err() {
        clear_next_close(&label);
    }
    result
}

#[tauri::command]
pub(crate) fn mark_settings_close_handler_ready(
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    if window.label() != SETTINGS_WINDOW_LABEL {
        return Err("只有偏好设置窗口可以注册关闭处理器".to_string());
    }
    SETTINGS_CLOSE_HANDLER_READY.store(true, Ordering::Release);
    Ok(())
}

#[tauri::command]
pub(crate) fn cancel_settings_close_request(
    window: tauri::WebviewWindow,
    request_id: u64,
) -> Result<(), String> {
    if window.label() != SETTINGS_WINDOW_LABEL {
        return Err("只有偏好设置窗口可以取消关闭请求".to_string());
    }
    if PENDING_SETTINGS_CLOSE_REQUEST
        .compare_exchange(request_id, 0, Ordering::AcqRel, Ordering::Acquire)
        .is_ok()
    {
        ACKNOWLEDGED_SETTINGS_CLOSE_REQUEST.store(0, Ordering::Release);
        if let Some(DeferredSettingsAction::CloseOwner(owner_label)) =
            take_deferred_settings_action()
        {
            clear_next_close(&owner_label);
        }
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn acknowledge_settings_close_request(
    window: tauri::WebviewWindow,
    request_id: u64,
) -> Result<(), String> {
    if window.label() != SETTINGS_WINDOW_LABEL {
        return Err("只有偏好设置窗口可以确认关闭请求".to_string());
    }
    if PENDING_SETTINGS_CLOSE_REQUEST.load(Ordering::Acquire) == request_id {
        ACKNOWLEDGED_SETTINGS_CLOSE_REQUEST.store(request_id, Ordering::Release);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn hide_window_to_tray(window: tauri::WebviewWindow) -> Result<(), String> {
    crate::app_logger::info("Window", &format!("隐藏窗口到托盘：{}", window.label()));
    window
        .set_skip_taskbar(true)
        .map_err(|error| format!("从任务栏隐藏窗口失败：{error}"))?;
    window
        .hide()
        .map_err(|error| format!("隐藏窗口到托盘失败：{error}"))?;
    crate::window::tray::sync_tray_active_with_window_visibility(window.app_handle());
    crate::window::tray::refresh_tray_menu(window.app_handle())?;
    Ok(())
}

#[tauri::command]
pub(crate) fn exit_app(app: AppHandle) {
    crate::app_logger::info("App", "退出应用");
    match request_app_exit_after_settings(&app) {
        Ok(true) => crate::app_logger::info("Settings", "退出应用前先保存并关闭偏好设置窗口"),
        Ok(false) => app.exit(0),
        Err(error) => crate::app_logger::warn(
            "Settings",
            &format!("退出应用前关闭偏好设置窗口失败，已取消退出：{error}"),
        ),
    }
}

#[tauri::command]
pub(crate) fn request_exit_app(app: AppHandle) -> Result<(), String> {
    crate::app_logger::info("App", "请求退出应用");
    emit_exit_request(&app)
}

pub(crate) fn emit_exit_request<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    app.emit("nomo://request-exit-app", ())
        .map_err(|error| format!("请求退出应用失败：{error}"))
}

pub(crate) fn consume_next_close(label: &str) -> bool {
    force_close_labels()
        .lock()
        .map(|mut labels| labels.remove(label))
        .unwrap_or(false)
}

pub(crate) fn settings_close_handler_ready() -> bool {
    SETTINGS_CLOSE_HANDLER_READY.load(Ordering::Acquire)
}

pub(crate) fn reset_settings_close_handler_ready() {
    SETTINGS_CLOSE_HANDLER_READY.store(false, Ordering::Release);
}

pub(crate) fn begin_settings_close_request() -> Option<u64> {
    let request_id = SETTINGS_CLOSE_REQUEST_SEQUENCE
        .fetch_add(1, Ordering::Relaxed)
        .wrapping_add(1)
        .max(1);
    let started = PENDING_SETTINGS_CLOSE_REQUEST
        .compare_exchange(0, request_id, Ordering::AcqRel, Ordering::Acquire)
        .ok()
        .map(|_| request_id);
    if started.is_some() {
        ACKNOWLEDGED_SETTINGS_CLOSE_REQUEST.store(0, Ordering::Release);
    }
    started
}

pub(crate) fn clear_pending_settings_close_request() {
    PENDING_SETTINGS_CLOSE_REQUEST.store(0, Ordering::Release);
    ACKNOWLEDGED_SETTINGS_CLOSE_REQUEST.store(0, Ordering::Release);
}

pub(crate) fn schedule_settings_close_fallback<R: Runtime>(
    window: tauri::Window<R>,
    request_id: u64,
) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(8));
        if ACKNOWLEDGED_SETTINGS_CLOSE_REQUEST.load(Ordering::Acquire) == request_id {
            return;
        }
        if PENDING_SETTINGS_CLOSE_REQUEST
            .compare_exchange(request_id, 0, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return;
        }

        reset_settings_close_handler_ready();
        crate::app_logger::warn(
            "Settings",
            "前端未在限定时间内完成设置窗口关闭，回退为直接关闭",
        );
        if let Err(error) = allow_next_close(window.label()).and_then(|_| {
            window
                .close()
                .map_err(|error| format!("回退关闭偏好设置窗口失败：{error}"))
        }) {
            clear_next_close(window.label());
            crate::app_logger::warn("Settings", &error);
        }
    });
}

pub(crate) fn request_settings_close_before_owner<R: Runtime>(
    app: &AppHandle<R>,
    owner_label: &str,
) -> Result<bool, String> {
    let is_settings_owner = settings_owner_label()
        .lock()
        .map_err(|error| format!("读取偏好设置 owner 状态失败：{error}"))?
        .as_deref()
        == Some(owner_label);
    if !is_settings_owner {
        return Ok(false);
    }

    let Some(settings_window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) else {
        forget_settings_owner();
        return Ok(false);
    };
    let should_request_close = {
        let mut deferred = deferred_settings_action()
            .lock()
            .map_err(|error| format!("记录偏好设置延迟关闭动作失败：{error}"))?;
        if deferred.is_some() {
            false
        } else {
            *deferred = Some(DeferredSettingsAction::CloseOwner(owner_label.to_string()));
            true
        }
    };

    if should_request_close {
        if let Err(error) = settings_window.close() {
            let _ = take_deferred_settings_action();
            return Err(format!("关闭 owner 前请求偏好设置保存失败：{error}"));
        }
    }
    Ok(true)
}

pub(crate) fn take_deferred_settings_action() -> Option<DeferredSettingsAction> {
    deferred_settings_action()
        .lock()
        .map(|mut action| action.take())
        .unwrap_or(None)
}

pub(crate) fn resume_owner_close_after_settings<R: Runtime>(
    app: &AppHandle<R>,
    owner_label: &str,
) -> Result<(), String> {
    let Some(owner) = app.get_webview_window(owner_label) else {
        return Ok(());
    };
    allow_next_close(owner_label)?;
    let result = owner
        .close()
        .map_err(|error| format!("继续关闭 owner 失败：{error}"));
    if result.is_err() {
        clear_next_close(owner_label);
    }
    result
}

pub(crate) fn forget_settings_owner() {
    remember_settings_owner_label(None);
}

fn request_app_exit_after_settings<R: Runtime>(app: &AppHandle<R>) -> Result<bool, String> {
    let Some(settings_window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) else {
        return Ok(false);
    };
    let should_request_close = {
        let mut deferred = deferred_settings_action()
            .lock()
            .map_err(|error| format!("记录退出前偏好设置关闭动作失败：{error}"))?;
        let should_request_close = deferred.is_none();
        *deferred = Some(DeferredSettingsAction::ExitApp);
        should_request_close
    };

    if should_request_close {
        if let Err(error) = settings_window.close() {
            let _ = take_deferred_settings_action();
            return Err(format!("退出前请求偏好设置保存失败：{error}"));
        }
    }
    Ok(true)
}

fn remember_settings_owner_label(label: Option<String>) {
    if let Ok(mut current) = settings_owner_label().lock() {
        *current = label;
    }
}

fn settings_owner_label() -> &'static Mutex<Option<String>> {
    SETTINGS_OWNER_LABEL.get_or_init(|| Mutex::new(None))
}

fn deferred_settings_action() -> &'static Mutex<Option<DeferredSettingsAction>> {
    DEFERRED_SETTINGS_ACTION.get_or_init(|| Mutex::new(None))
}

fn allow_next_close(label: &str) -> Result<(), String> {
    force_close_labels()
        .lock()
        .map(|mut labels| {
            labels.insert(label.to_string());
        })
        .map_err(|error| format!("记录窗口关闭状态失败：{error}"))
}

fn clear_next_close(label: &str) {
    let _ = force_close_labels().lock().map(|mut labels| {
        labels.remove(label);
    });
}

fn force_close_labels() -> &'static Mutex<HashSet<String>> {
    FORCE_CLOSE_LABELS.get_or_init(|| Mutex::new(HashSet::new()))
}

#[cfg(windows)]
fn settings_owner_window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    for (label, window) in app.webview_windows() {
        if crate::window::external_open::is_document_window_label(&label)
            && window.is_focused().unwrap_or(false)
        {
            return Some(window);
        }
    }
    app.get_webview_window("main")
}

fn bring_settings_window_to_front<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    // 步骤1：先恢复并聚焦偏好设置。
    window
        .set_skip_taskbar(true)
        .map_err(|error| format!("从任务栏隐藏偏好设置窗口失败：{error}"))?;
    window
        .show()
        .map_err(|error| format!("显示偏好设置窗口失败：{error}"))?;
    window
        .unminimize()
        .map_err(|error| format!("还原偏好设置窗口失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦偏好设置窗口失败：{error}"))?;

    // 步骤2：菜单收起或 WebView 初始化后可能再触发一次激活，延迟补一次聚焦。
    let window_for_focus = window.clone();
    tauri::async_runtime::spawn(async move {
        std::thread::sleep(Duration::from_millis(120));
        let _ = window_for_focus.show();
        let _ = window_for_focus.unminimize();
        let _ = window_for_focus.set_focus();
    });

    Ok(())
}

#[tauri::command]
pub(crate) fn get_markdown_file_association_status(
    app: AppHandle,
) -> Result<crate::models::MarkdownAssociationStatus, String> {
    crate::app_logger::info("Settings", "查询 Markdown 默认打开方式状态");
    let result = crate::window::file_association::get_markdown_file_association_status(&app);
    match &result {
        Ok(status) => crate::app_logger::info(
            "Settings",
            &format!(
                "Markdown 关联状态：registered={} is_default={}",
                status.registered, status.is_default
            ),
        ),
        Err(e) => crate::app_logger::error("Settings", &format!("查询 Markdown 关联状态失败：{e}")),
    }
    result
}

#[tauri::command]
pub(crate) fn register_markdown_file_association(
    app: AppHandle,
) -> Result<crate::models::DesktopActionPayload, String> {
    crate::app_logger::info("Settings", "开始注册 Markdown 默认打开方式");
    let result = crate::window::file_association::register_markdown_file_association(&app);
    match &result {
        Ok(payload) => {
            if payload.ok {
                crate::app_logger::info("Settings", "注册 Markdown 默认打开方式成功");
            } else {
                crate::app_logger::warn(
                    "Settings",
                    &format!("注册 Markdown 默认打开方式未完成：{}", payload.message),
                );
            }
        }
        Err(e) => {
            crate::app_logger::error("Settings", &format!("注册 Markdown 默认打开方式失败：{e}"))
        }
    }
    result
}

#[tauri::command]
pub(crate) fn get_windows_context_menu_status(
    app: AppHandle,
) -> Result<crate::models::WindowsContextMenuStatus, String> {
    crate::app_logger::info("Settings", "查询右键菜单状态");
    let result = crate::window::file_association::get_windows_context_menu_status(&app);
    match &result {
        Ok(status) => crate::app_logger::info(
            "Settings",
            &format!("右键菜单状态：registered={}", status.registered),
        ),
        Err(e) => crate::app_logger::error("Settings", &format!("查询右键菜单状态失败：{e}")),
    }
    result
}

#[tauri::command]
pub(crate) fn register_windows_context_menu(
    app: AppHandle,
) -> Result<crate::models::DesktopActionPayload, String> {
    crate::app_logger::info("Settings", "开始注册 Windows 右键菜单");
    let result = crate::window::file_association::register_windows_context_menu(&app);
    match &result {
        Ok(payload) => {
            if payload.ok {
                crate::app_logger::info("Settings", "注册右键菜单成功");
            } else {
                crate::app_logger::warn(
                    "Settings",
                    &format!("注册右键菜单未完成：{}", payload.message),
                );
            }
        }
        Err(e) => crate::app_logger::error("Settings", &format!("注册右键菜单失败：{e}")),
    }
    result
}

#[tauri::command]
pub(crate) fn unregister_markdown_file_association(
    app: AppHandle,
) -> Result<crate::models::DesktopActionPayload, String> {
    crate::app_logger::info("Settings", "开始取消 Markdown 默认打开方式绑定");
    let result = crate::window::file_association::unregister_markdown_file_association(&app);
    match &result {
        Ok(payload) => {
            if payload.ok {
                crate::app_logger::info("Settings", "取消 Markdown 默认打开方式绑定成功");
            } else {
                crate::app_logger::warn(
                    "Settings",
                    &format!("取消 Markdown 默认打开方式绑定未完成：{}", payload.message),
                );
            }
        }
        Err(e) => crate::app_logger::error(
            "Settings",
            &format!("取消 Markdown 默认打开方式绑定失败：{e}"),
        ),
    }
    result
}

#[tauri::command]
pub(crate) fn unregister_windows_context_menu(
    app: AppHandle,
) -> Result<crate::models::DesktopActionPayload, String> {
    crate::app_logger::info("Settings", "开始取消 Windows 右键菜单注册");
    let result = crate::window::file_association::unregister_windows_context_menu(&app);
    match &result {
        Ok(payload) => {
            if payload.ok {
                crate::app_logger::info("Settings", "取消右键菜单注册成功");
            } else {
                crate::app_logger::warn(
                    "Settings",
                    &format!("取消右键菜单注册未完成：{}", payload.message),
                );
            }
        }
        Err(e) => crate::app_logger::error("Settings", &format!("取消右键菜单注册失败：{e}")),
    }
    result
}
