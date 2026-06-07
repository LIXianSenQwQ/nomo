use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

const TRAY_ID: &str = "newmd-main-tray";
const TRAY_OPEN_ID: &str = "tray-open-main-window";
const TRAY_EXIT_ID: &str = "tray-exit-app";

pub(crate) fn install_app_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if app.tray_by_id(TRAY_ID).is_some() {
        return Ok(());
    }

    let menu = MenuBuilder::new(app)
        .text(TRAY_OPEN_ID, "打开 NewMd")
        .separator()
        .text(TRAY_EXIT_ID, "退出")
        .build()
        .map_err(|error| format!("构建托盘菜单失败：{error}"))?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("NewMd")
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_OPEN_ID => show_main_window(app),
            TRAY_EXIT_ID => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => show_main_window(tray.app_handle()),
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => show_main_window(tray.app_handle()),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .build(app)
        .map_err(|error| format!("创建托盘图标失败：{error}"))?;
    Ok(())
}

pub(crate) fn close_to_tray_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    database_bool_setting(app, "closeToTrayEnabled").unwrap_or(false)
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    for (_label, window) in app.webview_windows() {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn database_bool_setting<R: Runtime>(app: &AppHandle<R>, key: &str) -> Option<bool> {
    let value_json = crate::database::get_setting_value(app, key).ok()??;
    serde_json::from_str::<bool>(&value_json).ok()
}
