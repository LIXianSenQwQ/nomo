use crate::{
    database,
    models::WindowStateInput,
};
use std::path::Path;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Manager, Runtime,
};

#[tauri::command]
pub(crate) fn update_window_state(app: AppHandle, input: WindowStateInput) -> Result<(), String> {
    database::update_app_setting(
        app,
        crate::models::SettingInput {
            key: "windowState".to_string(),
            value_json: serde_json::to_string(&input).map_err(|error| format!("序列化窗口状态失败：{error}"))?,
        },
    )
}

#[tauri::command]
pub(crate) fn refresh_window_menu(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    let menu = build_window_menu(&app).map_err(|error| format!("构建菜单失败：{error}"))?;
    window.set_menu(menu).map_err(|error| format!("设置菜单失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) fn create_new_window(app: AppHandle) -> Result<(), String> {
    let id = format!("window-{}", database::now_ts());
    let _window = tauri::WebviewWindowBuilder::new(&app, &id, tauri::WebviewUrl::App("index.html".into()))
        .title("NewMd")
        .inner_size(1180.0, 760.0)
        .min_inner_size(920.0, 640.0)
        .build()
        .map_err(|error| format!("创建新窗口失败：{error}"))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| format!("最小化窗口失败：{error}"))
}

#[tauri::command]
pub(crate) fn maximize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let maximized = window.is_maximized().map_err(|error| format!("获取窗口最大化状态失败：{error}"))?;
    if maximized {
        window.unmaximize().map_err(|error| format!("还原窗口失败：{error}"))
    } else {
        window.maximize().map_err(|error| format!("最大化窗口失败：{error}"))
    }
}

#[tauri::command]
pub(crate) fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| format!("关闭窗口失败：{error}"))
}

pub(crate) fn persist_current_window_state(window: &tauri::Window) {
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };

    let input = WindowStateInput {
        x: Some(position.x),
        y: Some(position.y),
        width: Some(size.width),
        height: Some(size.height),
    };

    let _ = update_window_state(window.app_handle().clone(), input);
}

pub(crate) fn restore_window_state(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(Some(value_json)) = database::get_setting_value(app, "windowState") else {
        return;
    };
    let Ok(state) = serde_json::from_str::<WindowStateInput>(&value_json) else {
        return;
    };

    if let (Some(width), Some(height)) = (state.width, state.height) {
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));
    }

    if let (Some(x), Some(y)) = (state.x, state.y) {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    }
}

fn build_window_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Menu<R>, String> {
    let recent_docs = database::query_recent_files(app).unwrap_or_default();

    let mut file_menu_builder = SubmenuBuilder::new(app, "文件(&F)")
        .item(&MenuItemBuilder::with_id("new-file", "新建(&N)").accelerator("Ctrl+N").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("new-window", "新建窗口(&W)").accelerator("Ctrl+Shift+N").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("open-file", "打开(&O)...").accelerator("Ctrl+O").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("open-directory", "打开文件夹...").accelerator("Ctrl+Shift+O").build(app).map_err(|e| e.to_string())?);

    if !recent_docs.is_empty() {
        let mut recent_submenu_builder = SubmenuBuilder::new(app, "打开最近");
        for doc in recent_docs.iter().take(8) {
            let label = doc.title.clone().unwrap_or_else(|| {
                Path::new(&doc.path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("未命名.md")
                    .to_string()
            });
            let item_id = format!("recent-file:{}", doc.path);
            recent_submenu_builder = recent_submenu_builder.item(
                &MenuItemBuilder::with_id(item_id, label)
                    .build(app)
                    .map_err(|e| e.to_string())?,
            );
        }
        let recent_submenu = recent_submenu_builder.build().map_err(|e| e.to_string())?;
        file_menu_builder = file_menu_builder.item(&recent_submenu);
    } else {
        let placeholder = MenuItemBuilder::with_id("no-recent", "暂无最近文件")
            .enabled(false)
            .build(app)
            .map_err(|e| e.to_string())?;
        file_menu_builder = file_menu_builder.item(&placeholder);
    }

    let file_menu = file_menu_builder
        .separator()
        .item(&MenuItemBuilder::with_id("save-file", "保存(&S)").accelerator("Ctrl+S").build(app).map_err(|e| e.to_string())?)
        .item(
            &MenuItemBuilder::with_id("save-file-as", "另存为(&A)...")
                .accelerator("Ctrl+Shift+S")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("quit", "退出(&X)").accelerator("Alt+F4").build(app).map_err(|e| e.to_string())?)
        .build()
        .map_err(|e| e.to_string())?;

    let edit_menu = SubmenuBuilder::new(app, "编辑(&E)")
        .item(&MenuItemBuilder::with_id("undo", "撤销(&U)").accelerator("Ctrl+Z").build(app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("redo", "重做(&R)").accelerator("Ctrl+Y").build(app).map_err(|e| e.to_string())?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .map_err(|e| e.to_string())?;

    let format_menu = SubmenuBuilder::new(app, "格式(&O)")
        .item(
            &MenuItemBuilder::with_id("toggle-blockquote", "引用块")
                .accelerator("Ctrl+Shift+Q")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("insert-table", "表格")
                .accelerator("Ctrl+Shift+T")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("insert-math-block", "公式块")
                .accelerator("Ctrl+Shift+M")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("insert-code-block", "代码块")
                .accelerator("Ctrl+Shift+K")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;

    let view_menu = SubmenuBuilder::new(app, "查看(&V)")
        .item(
            &MenuItemBuilder::with_id("toggle-source", "切换源码模式")
                .accelerator("Ctrl+E")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-theme", "切换主题")
                .accelerator("Ctrl+Shift+L")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-focus", "切换专注模式")
                .accelerator("Ctrl+Shift+F")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&format_menu)
        .item(&view_menu)
        .build()
        .map_err(|e| e.to_string())
}
