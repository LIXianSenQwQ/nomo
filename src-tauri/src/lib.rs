mod app_logger;
mod config;
mod external_link;
mod export;
mod file_system;
mod i18n;
mod models;
mod software_update;
mod window;

#[cfg(target_os = "windows")]
mod export_windows;

use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    crate::app_logger::init();
    let startup_timer = std::time::Instant::now();

    // 强制 WebView2 使用 GPU 加速
    #[cfg(target_os = "windows")]
    unsafe {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-accelerated-2d-canvas",
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            crate::app_logger::info("App", "收到单实例启动参数");
            let targets = crate::window::external_open::collect_external_open_targets_from_args(
                args,
                Some(std::path::PathBuf::from(cwd)),
            );
            let should_restore_window =
                targets.markdown_paths.is_empty() && targets.folder_paths.is_empty();
            let _ = crate::window::external_open::route_external_open_targets(app, targets);
            if should_restore_window {
                crate::window::tray::show_main_window(app);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                crate::app_logger::debug("Window", &format!("持久化窗口状态：{}", window.label()));
                crate::window::state::persist_current_window_state(window);
            }
            WindowEvent::Focused(true) => {
                let label = window.label();
                if crate::window::external_open::is_document_window_label(label) {
                    crate::window::tray::record_last_active_window(window.app_handle(), label);
                }
            }
            WindowEvent::Destroyed => {
                let label = window.label();
                if crate::window::external_open::is_document_window_label(label) {
                    crate::window::tray::forget_window(window.app_handle(), label);
                }
            }
            WindowEvent::CloseRequested { api, .. } => {
                let label = window.label();
                crate::app_logger::info("Window", &format!("收到窗口关闭请求：{label}"));
                if !crate::window::external_open::is_document_window_label(label) {
                    return;
                }
                if crate::window::commands::consume_next_close(label) {
                    return;
                }

                api.prevent_close();
                if crate::window::tray::close_to_tray_enabled(window.app_handle()) {
                    crate::app_logger::info("Window", &format!("窗口隐藏到托盘：{label}"));
                    let _ = window.set_skip_taskbar(true);
                    let _ = window.hide();
                    crate::window::tray::sync_tray_active_with_window_visibility(
                        window.app_handle(),
                    );
                    let _ = crate::window::tray::refresh_tray_menu(window.app_handle());
                } else {
                    crate::app_logger::info("Window", &format!("请求前端确认关闭：{label}"));
                    let _ = window.emit("nomo://request-close-window", ());
                }
            }
            _ => {}
        })
        .setup(move |app| {
            use tauri::Manager;
            let setup_timer = std::time::Instant::now();
            crate::app_logger::info("App", "开始 Tauri setup");
            let config = crate::config::ConfigManager::load_or_default(app.handle())
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            app.manage(config);

            if let Some(window) = app.get_webview_window("main") {
                crate::app_logger::info("Window", "初始化主窗口系统适配和菜单");
                crate::window::os::setup_window(&window);
                crate::window::menu::install_window_menu(app.handle(), &window)
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            }
            crate::app_logger::info("Tray", "安装应用托盘");
            crate::window::tray::install_app_tray(app.handle())
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            crate::window::state::restore_window_state(app.handle(), "main");
            if let Some(window) = app.get_webview_window("main") {
                crate::app_logger::info("Window", "显示并聚焦主窗口");
                window
                    .set_skip_taskbar(false)
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
                window
                    .show()
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
                window
                    .set_focus()
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            }
            let startup_targets =
                crate::window::external_open::collect_external_open_targets_from_startup_args();
            crate::app_logger::info(
                "App",
                &format!(
                    "启动待打开目标：files={} folders={}",
                    startup_targets.markdown_paths.len(),
                    startup_targets.folder_paths.len()
                ),
            );
            crate::window::external_open::persist_pending_external_open(
                app.handle(),
                "main",
                &startup_targets.markdown_paths,
            )
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            if let Some(folder_path) = startup_targets.folder_paths.first() {
                crate::window::external_open::persist_pending_external_folder_open(
                    app.handle(),
                    "main",
                    folder_path,
                )
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            }
            crate::app_logger::perf("App", "Tauri setup", setup_timer.elapsed());
            crate::app_logger::perf("App", "软件打开", startup_timer.elapsed());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::export::export_html,
            crate::export::export_pdf_from_html,
            crate::export::read_file_as_base64,
            crate::file_system::read_markdown_file,
            crate::file_system::write_markdown_file,
            crate::file_system::install_sample_document,
            crate::file_system::stat_markdown_file,
            crate::config::commands::remember_recent_entry,
            crate::config::commands::list_recent_entries,
            crate::config::commands::clear_recent_entries,
            crate::config::commands::create_document_snapshot,
            crate::config::commands::list_document_snapshots,
            crate::config::commands::update_app_setting,
            crate::config::commands::update_app_settings,
            crate::config::commands::list_app_settings,
            crate::window::commands::update_window_state,
            crate::window::commands::refresh_window_menu,
            crate::window::commands::report_window_title,
            crate::window::commands::refresh_interface_language_chrome,
            crate::window::commands::set_desktop_icon_theme,
            crate::window::commands::get_desktop_system_theme,
            crate::file_system::list_folder_markdown_files,
            crate::file_system::create_folder,
            crate::file_system::rename_file,
            crate::file_system::delete_file,
            crate::file_system::image_assets::import_image_asset,
            crate::file_system::image_assets::resolve_image_asset,
            crate::file_system::image_assets::delete_image_asset,
            crate::file_system::image_assets::upload_image_via_picgo_core,
            crate::file_system::image_assets::upload_image_via_picgo_server,
            crate::file_system::image_assets::test_picgo_connection,
            crate::window::commands::create_new_window,
            crate::window::commands::open_settings_window,
            crate::window::commands::minimize_window,
            crate::window::commands::maximize_window,
            crate::window::commands::close_window,
            crate::window::commands::hide_window_to_tray,
            crate::window::commands::request_exit_app,
            crate::window::commands::exit_app,
            crate::window::commands::get_markdown_file_association_status,
            crate::window::commands::register_markdown_file_association,
            crate::window::commands::unregister_markdown_file_association,
            crate::window::commands::get_windows_context_menu_status,
            crate::window::commands::register_windows_context_menu,
            crate::window::commands::unregister_windows_context_menu,
            crate::app_logger::log_message,
            crate::app_logger::set_logger_enabled,
            crate::app_logger::get_logger_enabled,
            crate::software_update::is_windows_installer_installation,
            crate::software_update::check_software_update,
            crate::software_update::download_software_update,
            crate::software_update::install_software_update,
            crate::file_system::get_folder_tree,
            crate::file_system::list_folder_children,
            crate::file_system::start_folder_indexing,
            crate::file_system::check_paths_exist,
            crate::external_link::open_external_link,
            crate::external_link::reveal_in_explorer
        ])
        .build(tauri::generate_context!())
        .expect("error while building Nomo")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let paths = crate::window::external_open::collect_markdown_paths_from_urls(urls);
                let _ = crate::window::external_open::route_external_open(_app, paths);
            }
        });
}
