use crate::window::menu::install_window_menu;
use crate::{database, models::WindowStateInput};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

const SETTINGS_WINDOW_LABEL: &str = "window-settings";

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
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        window
            .show()
            .map_err(|error| format!("显示偏好设置窗口失败：{error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("聚焦偏好设置窗口失败：{error}"))?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        &app,
        SETTINGS_WINDOW_LABEL,
        WebviewUrl::App(PathBuf::from("index.html?view=settings")),
    )
    .title("偏好设置 - Nomo")
    .inner_size(860.0, 620.0)
    .min_inner_size(760.0, 520.0)
    .center()
    .decorations(crate::window::os::window_decorations())
    .resizable(true)
    .visible(false)
    .build()
    .map_err(|error| format!("创建偏好设置窗口失败：{error}"))?;

    // 先在隐藏状态下完成系统窗口适配和历史位置恢复，避免用户看到居中位置再跳到保存位置。
    crate::window::os::setup_window(&window);
    crate::window::state::restore_window_state(&app, window.label());
    window
        .show()
        .map_err(|error| format!("显示偏好设置窗口失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦偏好设置窗口失败：{error}"))?;

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
    window
        .close()
        .map_err(|error| format!("关闭窗口失败：{error}"))
}

#[tauri::command]
pub(crate) fn hide_window_to_tray(window: tauri::WebviewWindow) -> Result<(), String> {
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

#[tauri::command]
pub(crate) fn get_markdown_file_association_status(
) -> Result<crate::models::MarkdownAssociationStatus, String> {
    crate::window::file_association::get_markdown_file_association_status()
}

#[tauri::command]
pub(crate) fn register_markdown_file_association(
) -> Result<crate::models::DesktopActionPayload, String> {
    crate::window::file_association::register_markdown_file_association()
}

#[tauri::command]
pub(crate) fn get_windows_context_menu_status(
) -> Result<crate::models::WindowsContextMenuStatus, String> {
    crate::window::file_association::get_windows_context_menu_status()
}

#[tauri::command]
pub(crate) fn register_windows_context_menu() -> Result<crate::models::DesktopActionPayload, String>
{
    crate::window::file_association::register_windows_context_menu()
}
