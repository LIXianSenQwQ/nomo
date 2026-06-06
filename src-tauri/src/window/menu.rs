use std::path::Path;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Runtime, WebviewWindow,
};
use crate::database;

pub(crate) fn install_window_menu<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Result<(), String> {
    let menu = build_window_menu(app).map_err(|error| format!("构建菜单失败：{error}"))?;
    window
        .set_menu(menu)
        .map_err(|error| format!("设置菜单失败：{error}"))?;
    window.on_menu_event(|window, event| {
        let command = event.id().as_ref().to_string();
        if command == "quit" {
            window.app_handle().exit(0);
            return;
        }

        let _ = window.emit("newmd://menu-command", command);
    });
    Ok(())
}

pub(crate) fn build_window_menu<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Menu<R>, String> {
    let recent_docs = database::query_recent_files(app).unwrap_or_default();

    let mut file_menu_builder = SubmenuBuilder::new(app, "文件(&F)")
        .item(
            &MenuItemBuilder::with_id("new-file", "新建(&N)")
                .accelerator("Ctrl + N")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("new-window", "新建窗口(&W)")
                .accelerator("Ctrl + Shift + N")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("open-file", "打开(&O)...")
                .accelerator("Ctrl + O")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("open-directory", "打开文件夹...")
                .accelerator("Ctrl + Shift + O")
                .build(app)
                .map_err(|e| e.to_string())?,
        );

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
            let item_id = format!("open-recent:{}", doc.path);
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
        .item(
            &MenuItemBuilder::with_id("save-file", "保存(&S)")
                .accelerator("Ctrl + S")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("save-file-as", "另存为(&A)...")
                .accelerator("Ctrl + Shift + S")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("quit", "退出(&X)")
                .accelerator("Alt + F4")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;

    let edit_menu = SubmenuBuilder::new(app, "编辑(&E)")
        .item(
            &MenuItemBuilder::with_id("undo", "撤销(&U)")
                .accelerator("Ctrl + Z")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("redo", "重做(&R)")
                .accelerator("Ctrl + Y")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .map_err(|e| e.to_string())?;

    let diagram_menu = SubmenuBuilder::new(app, "图表")
        .item(
            &MenuItemBuilder::with_id("menu-chart:flowchart", "流程图")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-chart:sequenceDiagram", "时序图")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-chart:classDiagram", "类图")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-chart:stateDiagram", "状态图")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-chart:pie", "饼图")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-chart:gantt", "甘特图")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-chart:erDiagram", "ER 图")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;

    let format_menu = SubmenuBuilder::new(app, "格式(&O)")
        .item(
            &MenuItemBuilder::with_id("toggle-bold", "加粗")
                .accelerator("Ctrl + B")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-italic", "斜体")
                .accelerator("Ctrl + I")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-underline", "下划线")
                .accelerator("Ctrl + U")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-inline-code", "行代码")
                .accelerator("Ctrl + `")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-strikethrough", "删除线")
                .accelerator("Alt + Shift + 5")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-highlight", "高亮")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-clear-format", "清除样式")
                .accelerator("Ctrl + \\")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("toggle-blockquote", "引用块")
                .accelerator("Ctrl + Shift + Q")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("insert-table", "表格")
                .accelerator("Ctrl + Shift + T")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("insert-math-block", "公式块")
                .accelerator("Ctrl + Shift + M")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("insert-code-block", "代码块")
                .accelerator("Ctrl + Shift + K")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(&diagram_menu)
        .item(
            &MenuItemBuilder::with_id("menu-footnote", "脚注")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-horizontal-rule", "水平分割线")
                .accelerator("Ctrl + Shift + H")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-content-directory", "正文目录")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("menu-yaml-front-matter", "文档元数据")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;

    let view_menu = SubmenuBuilder::new(app, "查看(&V)")
        .item(
            &MenuItemBuilder::with_id("toggle-source", "切换源码模式")
                .accelerator("Ctrl + E")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-theme", "切换主题")
                .accelerator("Ctrl + Shift + L")
                .build(app)
                .map_err(|e| e.to_string())?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-focus", "切换专注模式")
                .accelerator("Ctrl + Shift + F")
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
