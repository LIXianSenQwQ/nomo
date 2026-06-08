use tauri::{
    image::Image,
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

const TRAY_ID: &str = "nomo-main-tray";
const TRAY_OPEN_ID: &str = "tray-open-main-window";
const TRAY_EXIT_ID: &str = "tray-exit-app";
const TRAY_ACTIVE_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/tray/nomo-tray-dark-active-24-preview.png");
const TRAY_INACTIVE_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/tray/nomo-tray-dark-inactive-24-preview.png");

pub(crate) fn install_app_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if app.tray_by_id(TRAY_ID).is_some() {
        return Ok(());
    }

    let menu = MenuBuilder::new(app)
        .text(TRAY_OPEN_ID, "打开 Nomo")
        .separator()
        .text(TRAY_EXIT_ID, "退出")
        .build()
        .map_err(|error| format!("构建托盘菜单失败：{error}"))?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Nomo")
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_OPEN_ID => show_main_window(app),
            TRAY_EXIT_ID => {
                let _ = crate::window::commands::emit_exit_request(app);
            }
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

    if let Ok(icon) = tray_state_icon(true) {
        builder = builder.icon(icon);
    } else if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .build(app)
        .map_err(|error| format!("创建托盘图标失败：{error}"))?;
    Ok(())
}

pub(crate) fn set_tray_active<R: Runtime>(app: &AppHandle<R>, active: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let Ok(icon) = tray_state_icon(active) else {
        return;
    };
    let _ = tray.set_icon(Some(icon));
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
    set_tray_active(app, true);
}

fn database_bool_setting<R: Runtime>(app: &AppHandle<R>, key: &str) -> Option<bool> {
    let value_json = crate::database::get_setting_value(app, key).ok()??;
    serde_json::from_str::<bool>(&value_json).ok()
}

fn tray_state_icon(active: bool) -> Result<Image<'static>, String> {
    let bytes = if active {
        TRAY_ACTIVE_ICON_BYTES
    } else {
        TRAY_INACTIVE_ICON_BYTES
    };

    Image::from_bytes(bytes)
        .map(Image::to_owned)
        .map_err(|error| format!("读取 Nomo 托盘图标失败：{error}"))
}
