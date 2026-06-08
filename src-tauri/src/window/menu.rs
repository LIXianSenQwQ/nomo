use crate::database;
use std::path::Path;

#[cfg(target_os = "macos")]
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Runtime, WebviewWindow,
};

#[cfg(target_os = "macos")]
static APP_MENU_EVENT_INSTALLED: AtomicBool = AtomicBool::new(false);

pub(crate) fn install_window_menu<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Result<(), String> {
    let menu = build_window_menu(app).map_err(|error| format!("构建菜单失败：{error}"))?;

    #[cfg(target_os = "macos")]
    {
        let _ = window;
        app.set_menu(menu)
            .map_err(|error| format!("设置 macOS 原生菜单失败：{error}"))?;
        install_app_menu_event(app);
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        window
            .set_menu(menu)
            .map_err(|error| format!("设置菜单失败：{error}"))?;
        window.on_menu_event(|window, event| {
            let command = event.id().as_ref().to_string();
            if command == "quit" {
                let _ = crate::window::commands::emit_exit_request(window.app_handle());
                return;
            }
            if command == "open-settings" {
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::window::commands::open_settings_window_for_app(app).await;
                });
                return;
            }

            let _ = window.emit("nomo://menu-command", command);
        });
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn install_app_menu_event<R: Runtime>(app: &AppHandle<R>) {
    if APP_MENU_EVENT_INSTALLED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    app.on_menu_event(|app, event| {
        let command = event.id().as_ref().to_string();
        if command == "quit" {
            let _ = crate::window::commands::emit_exit_request(app);
            return;
        }
        if command == "open-settings" {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::window::commands::open_settings_window_for_app(app).await;
            });
            return;
        }

        if let Some(window) = focused_document_window(app) {
            let _ = window.emit("nomo://menu-command", command);
        }
    });
}

#[cfg(target_os = "macos")]
fn focused_document_window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    for (label, window) in app.webview_windows() {
        if is_document_window_label(&label) && window.is_focused().unwrap_or(false) {
            return Some(window);
        }
    }

    app.get_webview_window("main")
}

#[cfg(target_os = "macos")]
fn is_document_window_label(label: &str) -> bool {
    label == "main" || (label.starts_with("window-") && label != "window-settings")
}

pub(crate) fn build_window_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::menu::Menu<R>, String> {
    let file_menu = build_file_menu(app)?;
    let edit_menu = build_edit_menu(app)?;
    let paragraph_menu = build_paragraph_menu(app)?;
    let format_menu = build_format_menu(app)?;
    let view_menu = build_view_menu(app)?;
    let settings_menu = build_settings_menu(app)?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&paragraph_menu)
        .item(&format_menu)
        .item(&view_menu)
        .item(&settings_menu)
        .build()
        .map_err(|e| e.to_string())
}

fn build_file_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Submenu<R>, String> {
    let recent_entries = database::query_recent_entries(app).unwrap_or_default();

    let mut file_menu_builder = SubmenuBuilder::new(app, "文件(&F)")
        .item(&menu_item(
            app,
            "new-file",
            "新建(&N)",
            Some("CmdOrCtrl+N"),
        )?)
        .item(&menu_item(
            app,
            "new-window",
            "新建窗口(&W)",
            Some("CmdOrCtrl+Shift+N"),
        )?)
        .item(&menu_item(
            app,
            "open-file",
            "打开(&O)...",
            Some("CmdOrCtrl+O"),
        )?)
        .item(&menu_item(
            app,
            "open-directory",
            "打开文件夹...",
            Some("CmdOrCtrl+Shift+O"),
        )?);

    if !recent_entries.is_empty() {
        let mut recent_submenu_builder = SubmenuBuilder::new(app, "打开最近");
        for entry in recent_entries.iter().take(8) {
            let label = entry.title.clone().unwrap_or_else(|| {
                Path::new(&entry.path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("未命名.md")
                    .to_string()
            });
            let item_id = format!("open-recent:{}:{}", entry.entry_type, entry.path);
            recent_submenu_builder =
                recent_submenu_builder.item(&menu_item(app, item_id, label, None)?);
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

    file_menu_builder
        .separator()
        .item(&menu_item(
            app,
            "save-file",
            "保存(&S)",
            Some("CmdOrCtrl+S"),
        )?)
        .item(&menu_item(
            app,
            "save-file-as",
            "另存为(&A)...",
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "close-current-file",
            "关闭当前文件",
            Some("CmdOrCtrl+W"),
        )?)
        .item(&menu_item(
            app,
            "close-current-window",
            "关闭窗口",
            close_window_accelerator(),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "quit",
            "退出(&X)",
            Some(quit_accelerator()),
        )?)
        .build()
        .map_err(|e| e.to_string())
}

fn build_edit_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Submenu<R>, String> {
    SubmenuBuilder::new(app, "编辑(&E)")
        .item(&menu_item(app, "undo", "撤销(&U)", Some("CmdOrCtrl+Z"))?)
        .item(&menu_item(app, "redo", "重做(&R)", redo_accelerator())?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .map_err(|e| e.to_string())
}

fn build_paragraph_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Submenu<R>, String> {
    let heading_menu = SubmenuBuilder::new(app, "标题")
        .item(&menu_item(
            app,
            "set-heading-1",
            "一级标题",
            Some("CmdOrCtrl+1"),
        )?)
        .item(&menu_item(
            app,
            "set-heading-2",
            "二级标题",
            Some("CmdOrCtrl+2"),
        )?)
        .item(&menu_item(
            app,
            "set-heading-3",
            "三级标题",
            Some("CmdOrCtrl+3"),
        )?)
        .item(&menu_item(
            app,
            "set-heading-4",
            "四级标题",
            Some("CmdOrCtrl+4"),
        )?)
        .item(&menu_item(
            app,
            "set-heading-5",
            "五级标题",
            Some("CmdOrCtrl+5"),
        )?)
        .item(&menu_item(
            app,
            "set-heading-6",
            "六级标题",
            Some("CmdOrCtrl+6"),
        )?)
        .build()
        .map_err(|e| e.to_string())?;

    let diagram_menu = build_diagram_menu(app)?;

    SubmenuBuilder::new(app, "段落")
        .item(&heading_menu)
        .item(&menu_item(
            app,
            "set-paragraph",
            "段落",
            Some("CmdOrCtrl+0"),
        )?)
        .item(&menu_item(
            app,
            "menu-heading-up",
            "提升标题",
            Some("CmdOrCtrl+="),
        )?)
        .item(&menu_item(
            app,
            "menu-heading-down",
            "降低标题",
            Some("CmdOrCtrl+-"),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "insert-table",
            "表格",
            Some("CmdOrCtrl+Shift+T"),
        )?)
        .item(&menu_item(
            app,
            "insert-code-block",
            "代码块",
            Some("CmdOrCtrl+Shift+K"),
        )?)
        .item(&menu_item(
            app,
            "insert-math-block",
            "公式块",
            Some("CmdOrCtrl+Shift+M"),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "toggle-blockquote",
            "引用",
            Some("CmdOrCtrl+Shift+Q"),
        )?)
        .item(&menu_item(
            app,
            "insert-callout",
            "提示块",
            Some("CmdOrCtrl+Shift+A"),
        )?)
        .item(&menu_item(app, "menu-comment-block", "注释块", None)?)
        .item(&menu_item(
            app,
            "toggle-ordered-list",
            "有序列表",
            Some("CmdOrCtrl+Shift+["),
        )?)
        .item(&menu_item(
            app,
            "toggle-bullet-list",
            "无序列表",
            Some("CmdOrCtrl+Shift+]"),
        )?)
        .item(&menu_item(
            app,
            "toggle-task-list",
            "任务列表",
            Some("CmdOrCtrl+Shift+X"),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "menu-insert-paragraph-before",
            "上插段落",
            Some("CmdOrCtrl+Shift+Enter"),
        )?)
        .item(&menu_item(
            app,
            "menu-insert-paragraph-after",
            "下插段落",
            Some("CmdOrCtrl+Enter"),
        )?)
        .separator()
        .item(&diagram_menu)
        .item(&menu_item(app, "menu-footnote", "脚注", None)?)
        .item(&menu_item(
            app,
            "menu-horizontal-rule",
            "水平分割线",
            Some("CmdOrCtrl+Shift+H"),
        )?)
        .item(&menu_item(app, "menu-content-directory", "正文目录", None)?)
        .item(&menu_item(
            app,
            "menu-yaml-front-matter",
            "文档元数据",
            None,
        )?)
        .build()
        .map_err(|e| e.to_string())
}

fn build_format_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Submenu<R>, String> {
    SubmenuBuilder::new(app, "格式(&O)")
        .item(&menu_item(app, "toggle-bold", "加粗", Some("CmdOrCtrl+B"))?)
        .item(&menu_item(
            app,
            "toggle-italic",
            "斜体",
            Some("CmdOrCtrl+I"),
        )?)
        .item(&menu_item(
            app,
            "toggle-underline",
            "下划线",
            Some("CmdOrCtrl+U"),
        )?)
        .item(&menu_item(
            app,
            "toggle-inline-code",
            "行代码",
            Some("CmdOrCtrl+`"),
        )?)
        .item(&menu_item(app, "menu-inline-math", "行公式", None)?)
        .separator()
        .item(&menu_item(
            app,
            "toggle-strikethrough",
            "删除线",
            Some("Alt+Shift+5"),
        )?)
        .item(&menu_item(app, "menu-highlight", "高亮", None)?)
        .item(&menu_item(app, "menu-comment", "注释", None)?)
        .separator()
        .item(&menu_item(app, "menu-link", "超链接", Some("CmdOrCtrl+K"))?)
        .item(&menu_item(app, "menu-image", "图像", None)?)
        .separator()
        .item(&menu_item(
            app,
            "menu-clear-format",
            "清除样式",
            Some("CmdOrCtrl+\\"),
        )?)
        .build()
        .map_err(|e| e.to_string())
}

fn build_view_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Submenu<R>, String> {
    SubmenuBuilder::new(app, "查看(&V)")
        .item(&menu_item(
            app,
            "toggle-source",
            "切换源码模式",
            Some("CmdOrCtrl+E"),
        )?)
        .item(&menu_item(
            app,
            "toggle-outline",
            "显示/隐藏文档大纲",
            None,
        )?)
        .item(&menu_item(
            app,
            "toggle-theme",
            "切换主题",
            Some("CmdOrCtrl+Shift+L"),
        )?)
        .item(&menu_item(
            app,
            "toggle-focus",
            "显示/隐藏资源管理器",
            Some("CmdOrCtrl+Shift+F"),
        )?)
        .build()
        .map_err(|e| e.to_string())
}

fn build_settings_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Submenu<R>, String> {
    SubmenuBuilder::new(app, "设置")
        .item(&menu_item(app, "open-settings", "偏好设置...", None)?)
        .build()
        .map_err(|e| e.to_string())
}

fn build_diagram_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Submenu<R>, String> {
    SubmenuBuilder::new(app, "图表")
        .item(&menu_item(app, "menu-chart", "空白图表", None)?)
        .item(&menu_item(app, "menu-chart:flowchart", "流程图", None)?)
        .item(&menu_item(
            app,
            "menu-chart:sequenceDiagram",
            "时序图",
            None,
        )?)
        .item(&menu_item(app, "menu-chart:classDiagram", "类图", None)?)
        .item(&menu_item(app, "menu-chart:stateDiagram", "状态图", None)?)
        .item(&menu_item(app, "menu-chart:pie", "饼图", None)?)
        .item(&menu_item(app, "menu-chart:gantt", "甘特图", None)?)
        .item(&menu_item(app, "menu-chart:erDiagram", "ER 图", None)?)
        .build()
        .map_err(|e| e.to_string())
}

fn menu_item<R: Runtime>(
    app: &AppHandle<R>,
    id: impl Into<String>,
    text: impl Into<String>,
    accelerator: Option<&str>,
) -> Result<MenuItem<R>, String> {
    let mut builder = MenuItemBuilder::with_id(id.into(), text.into());
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn quit_accelerator() -> &'static str {
    "Cmd+Q"
}

#[cfg(not(target_os = "macos"))]
fn quit_accelerator() -> &'static str {
    "Alt+F4"
}

#[cfg(target_os = "macos")]
fn close_window_accelerator() -> Option<&'static str> {
    None
}

#[cfg(not(target_os = "macos"))]
fn close_window_accelerator() -> Option<&'static str> {
    Some("Alt+F4")
}

#[cfg(target_os = "macos")]
fn redo_accelerator() -> Option<&'static str> {
    Some("CmdOrCtrl+Shift+Z")
}

#[cfg(not(target_os = "macos"))]
fn redo_accelerator() -> Option<&'static str> {
    Some("CmdOrCtrl+Y")
}
