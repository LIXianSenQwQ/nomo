use crate::window::menu::install_window_menu;
use crate::{database, models::WindowStateInput};
use tauri::{AppHandle, Manager};

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
