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
    crate::window::os::setup_window(&window);
    install_window_menu(&app, &window)?;
    crate::window::state::restore_window_state(&app, window.label());
    Ok(())
}

#[tauri::command]
pub(crate) fn refresh_interface_language_chrome(app: AppHandle) -> Result<(), String> {
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
    crate::window::tray::set_desktop_icon_theme(&app, &theme)
}

#[tauri::command]
pub(crate) fn create_new_window(
    app: AppHandle,
    pending_folder: Option<String>,
) -> Result<String, String> {
    let id = format!("window-{}", database::now_ts());

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

    Ok(id)
}

#[tauri::command]
pub(crate) async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    open_settings_window_for_app(app).await
}

pub(crate) async fn open_settings_window_for_app<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        bring_settings_window_to_front(&window)?;
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(
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

    if let Some(owner) = settings_owner_window(&app) {
        builder = builder
            .owner(&owner)
            .map_err(|error| format!("绑定偏好设置父窗口失败：{error}"))?;
    }

    let window = builder
        .build()
        .map_err(|error| format!("创建偏好设置窗口失败：{error}"))?;

    // 先在隐藏状态下完成系统窗口适配和历史位置恢复，避免用户看到居中位置再跳到保存位置。
    crate::window::os::setup_window(&window);
    crate::window::state::restore_window_state(&app, window.label());
    bring_settings_window_to_front(&window)?;

    Ok(())
}

#[tauri::command]
pub(crate) fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window
        .minimize()
        .map_err(|error| format!("最小化窗口失败：{error}"))
}

#[tauri::command]
pub(crate) fn maximize_window(window: tauri::WebviewWindow) -> Result<(), String> {
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
    app.exit(0);
}

#[tauri::command]
pub(crate) fn request_exit_app(app: AppHandle) -> Result<(), String> {
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
    // 步骤1：先恢复并聚焦偏好设置。新建窗口已绑定 owner，Windows 会保证它在主窗口上方。
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
    crate::window::file_association::get_markdown_file_association_status(&app)
}

#[tauri::command]
pub(crate) fn register_markdown_file_association(
    app: AppHandle,
) -> Result<crate::models::DesktopActionPayload, String> {
    crate::window::file_association::register_markdown_file_association(&app)
}

#[tauri::command]
pub(crate) fn get_windows_context_menu_status(
    app: AppHandle,
) -> Result<crate::models::WindowsContextMenuStatus, String> {
    crate::window::file_association::get_windows_context_menu_status(&app)
}

#[tauri::command]
pub(crate) fn register_windows_context_menu(
    app: AppHandle,
) -> Result<crate::models::DesktopActionPayload, String> {
    crate::window::file_association::register_windows_context_menu(&app)
}
