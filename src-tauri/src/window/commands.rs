use crate::window::menu::install_window_menu;
use crate::{database, models::WindowStateInput};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

const SETTINGS_WINDOW_LABEL: &str = "window-settings";
static FORCE_CLOSE_LABELS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[tauri::command]
pub(crate) fn update_window_state(
    app: AppHandle,
    key: String,
    input: WindowStateInput,
) -> Result<(), String> {
    crate::app_logger::debug("Window", &format!("更新窗口状态：key={key}"));
    database::update_app_setting(
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
    crate::window::os::setup_window(&window);
    install_window_menu(&app, &window)?;
    crate::window::state::restore_window_state(&app, window.label());
    Ok(())
}

#[tauri::command]
pub(crate) fn refresh_interface_language_chrome(app: AppHandle) -> Result<(), String> {
    crate::app_logger::info("Window", "刷新界面语言相关窗口 chrome");
    for (_label, window) in app.webview_windows() {
        if crate::window::external_open::is_document_window_label(window.label()) {
            crate::window::os::setup_window(&window);
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
pub(crate) fn set_desktop_icon_theme(app: AppHandle, theme: String) -> Result<(), String> {
    crate::app_logger::info("Tray", &format!("设置桌面图标主题：{theme}"));
    crate::window::tray::set_desktop_icon_theme(&app, &theme)
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
    let id = format!("window-{}", database::now_ts());
    crate::app_logger::info(
        "Window",
        &format!(
            "准备创建新窗口：id={id} pendingFolder={}",
            pending_folder.as_deref().unwrap_or("")
        ),
    );

    // 新窗口加载前先写入待打开目录，避免前端初始化读取设置时发生竞态。
    if let Some(folder) = pending_folder {
        database::update_app_setting(
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
    let builder = {
        let mut builder = builder;
        if let Some(owner) = settings_owner_window(&app) {
            builder = builder
                .owner(&owner)
                .map_err(|error| format!("绑定偏好设置父窗口失败：{error}"))?;
        }
        builder
    };

    let window = builder
        .build()
        .map_err(|error| format!("创建偏好设置窗口失败：{error}"))?;

    // 先在隐藏状态下完成系统窗口适配和历史位置恢复，避免用户看到居中位置再跳到保存位置。
    crate::window::os::setup_window(&window);
    crate::window::state::restore_window_state(&app, window.label());
    bring_settings_window_to_front(&window)?;
    crate::app_logger::info("Settings", "设置窗口创建并显示完成");
    crate::app_logger::perf("Settings", "打开设置窗口", timer.elapsed());

    Ok(())
}

#[tauri::command]
pub(crate) fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    crate::app_logger::info("Window", &format!("最小化窗口：{}", window.label()));
    window
        .minimize()
        .map_err(|error| format!("最小化窗口失败：{error}"))
}

#[tauri::command]
pub(crate) fn maximize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    crate::app_logger::info("Window", &format!("切换最大化窗口：{}", window.label()));
    let maximized = window
        .is_maximized()
        .map_err(|error| format!("获取窗口最大化状态失败：{error}"))?;
    if maximized {
        window
            .unmaximize()
            .map_err(|error| format!("还原窗口失败：{error}"))
    } else {
        window
            .maximize()
            .map_err(|error| format!("最大化窗口失败：{error}"))
    }
}

#[tauri::command]
pub(crate) fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let label = window.label().to_string();
    crate::app_logger::info("Window", &format!("关闭窗口：{label}"));
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
pub(crate) fn hide_window_to_tray(window: tauri::WebviewWindow) -> Result<(), String> {
    crate::app_logger::info("Window", &format!("隐藏窗口到托盘：{}", window.label()));
    window
        .set_skip_taskbar(true)
        .map_err(|error| format!("从任务栏隐藏窗口失败：{error}"))?;
    window
        .hide()
        .map_err(|error| format!("隐藏窗口到托盘失败：{error}"))?;
    crate::window::tray::set_tray_active(window.app_handle(), false);
    Ok(())
}

#[tauri::command]
pub(crate) fn exit_app(app: AppHandle) {
    crate::app_logger::info("App", "退出应用");
    app.exit(0);
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
    // 步骤1：先恢复并聚焦偏好设置。Windows 新建窗口会绑定 owner，保证它在主窗口上方。
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
