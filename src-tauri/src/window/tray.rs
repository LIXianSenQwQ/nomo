use std::sync::{Mutex, OnceLock};
use tauri::{
    image::Image,
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

const TRAY_ID: &str = "nomo-main-tray";
const TRAY_OPEN_ID: &str = "tray-open-main-window";
const TRAY_EXIT_ID: &str = "tray-exit-app";
const TRAY_DARK_ACTIVE_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/tray/nomo-tray-dark-active-24-preview.png");
const TRAY_DARK_INACTIVE_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/tray/nomo-tray-dark-inactive-24-preview.png");
const TRAY_LIGHT_ACTIVE_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/tray/nomo-tray-light-active-24-preview.png");
const TRAY_LIGHT_INACTIVE_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/tray/nomo-tray-light-inactive-24-preview.png");
const WINDOW_LIGHT_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/source/nomo-app-light-256.png");
const WINDOW_DARK_ICON_BYTES: &[u8] =
    include_bytes!("../../icons/nomo/source/nomo-app-dark-256.png");

#[derive(Clone, Copy)]
enum TrayTheme {
    Light,
    Dark,
}

#[derive(Clone, Copy)]
struct TrayVisualState {
    active: bool,
    theme: TrayTheme,
}

impl Default for TrayVisualState {
    fn default() -> Self {
        Self {
            active: true,
            theme: TrayTheme::Light,
        }
    }
}

static TRAY_STATE: OnceLock<Mutex<TrayVisualState>> = OnceLock::new();

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

    if let Ok(icon) = tray_state_icon(current_tray_state()) {
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
    let Ok(state) = update_tray_state(|state| state.active = active) else {
        return;
    };
    let _ = apply_tray_icon(app, state);
}

pub(crate) fn set_desktop_icon_theme<R: Runtime>(
    app: &AppHandle<R>,
    theme: &str,
) -> Result<(), String> {
    let next_theme = match theme {
        "light" => TrayTheme::Light,
        "dark" => TrayTheme::Dark,
        _ => return Err(format!("未知托盘主题：{theme}")),
    };

    let state = update_tray_state(|state| state.theme = next_theme)?;
    apply_window_icons(app, next_theme)?;
    apply_tray_icon(app, state)
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

fn tray_state() -> &'static Mutex<TrayVisualState> {
    TRAY_STATE.get_or_init(|| Mutex::new(TrayVisualState::default()))
}

fn current_tray_state() -> TrayVisualState {
    tray_state()
        .lock()
        .map(|state| *state)
        .unwrap_or_else(|_| TrayVisualState::default())
}

fn update_tray_state(update: impl FnOnce(&mut TrayVisualState)) -> Result<TrayVisualState, String> {
    let mut state = tray_state()
        .lock()
        .map_err(|error| format!("读取 Nomo 托盘状态失败：{error}"))?;
    update(&mut state);
    Ok(*state)
}

fn apply_tray_icon<R: Runtime>(app: &AppHandle<R>, state: TrayVisualState) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };
    let icon = tray_state_icon(state)?;
    tray.set_icon(Some(icon))
        .map_err(|error| format!("设置 Nomo 托盘图标失败：{error}"))
}

fn apply_window_icons<R: Runtime>(app: &AppHandle<R>, theme: TrayTheme) -> Result<(), String> {
    let icon = window_theme_icon(theme)?;
    for (_label, window) in app.webview_windows() {
        window
            .set_icon(icon.clone())
            .map_err(|error| format!("设置 Nomo 窗口图标失败：{error}"))?;
    }
    Ok(())
}

fn tray_state_icon(state: TrayVisualState) -> Result<Image<'static>, String> {
    let bytes = match (state.theme, state.active) {
        (TrayTheme::Light, true) => TRAY_LIGHT_ACTIVE_ICON_BYTES,
        (TrayTheme::Light, false) => TRAY_LIGHT_INACTIVE_ICON_BYTES,
        (TrayTheme::Dark, true) => TRAY_DARK_ACTIVE_ICON_BYTES,
        (TrayTheme::Dark, false) => TRAY_DARK_INACTIVE_ICON_BYTES,
    };

    Image::from_bytes(bytes)
        .map(Image::to_owned)
        .map_err(|error| format!("读取 Nomo 托盘图标失败：{error}"))
}

fn window_theme_icon(theme: TrayTheme) -> Result<Image<'static>, String> {
    let bytes = match theme {
        TrayTheme::Light => WINDOW_LIGHT_ICON_BYTES,
        TrayTheme::Dark => WINDOW_DARK_ICON_BYTES,
    };

    Image::from_bytes(bytes)
        .map(Image::to_owned)
        .map_err(|error| format!("读取 Nomo 窗口图标失败：{error}"))
}
