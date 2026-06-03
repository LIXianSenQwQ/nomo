use tauri::AppHandle;
use crate::{database, models::WindowStateInput};
use crate::window::menu::build_window_menu;

#[tauri::command]
pub(crate) fn update_window_state(app: AppHandle, input: WindowStateInput) -> Result<(), String> {
    database::update_app_setting(
        app,
        crate::models::SettingInput {
            key: "windowState".to_string(),
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
    let menu = build_window_menu(&app).map_err(|error| format!("构建菜单失败：{error}"))?;
    window
        .set_menu(menu)
        .map_err(|error| format!("设置菜单失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) fn create_new_window(app: AppHandle) -> Result<(), String> {
    let id = format!("window-{}", database::now_ts());
    let window = tauri::WebviewWindowBuilder::new(&app, &id, tauri::WebviewUrl::App("index.html".into()))
        .title("NewMd")
        .inner_size(1180.0, 760.0)
        .min_inner_size(920.0, 640.0)
        .build()
        .map_err(|error| format!("创建新窗口失败：{error}"))?;

    crate::window::os::setup_window(&window);

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