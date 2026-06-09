mod database;
mod external_link;
mod file_system;
mod i18n;
mod models;
mod software_update;
mod window;

use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
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
                crate::window::state::persist_current_window_state(window);
            }
            WindowEvent::CloseRequested { api, .. } => {
                let label = window.label();
                if !crate::window::external_open::is_document_window_label(label) {
                    return;
                }
                if crate::window::commands::consume_next_close(label) {
                    return;
                }

                api.prevent_close();
                if crate::window::tray::close_to_tray_enabled(window.app_handle()) {
                    let _ = window.set_skip_taskbar(true);
                    let _ = window.hide();
                    crate::window::tray::set_tray_active(window.app_handle(), false);
                } else {
                    let _ = window.emit("nomo://request-close-window", ());
                }
            }
            _ => {}
        })
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                crate::window::os::setup_window(&window);
                crate::window::menu::install_window_menu(app.handle(), &window)
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            }
            crate::window::tray::install_app_tray(app.handle())
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            crate::window::state::restore_window_state(app.handle(), "main");
            if let Some(window) = app.get_webview_window("main") {
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::file_system::read_markdown_file,
            crate::file_system::write_markdown_file,
            crate::file_system::install_sample_document,
            crate::file_system::stat_markdown_file,
            crate::database::remember_recent_entry,
            crate::database::list_recent_entries,
            crate::database::clear_recent_entries,
            crate::database::create_document_snapshot,
            crate::database::list_document_snapshots,
            crate::database::update_app_setting,
            crate::database::list_app_settings,
            crate::window::commands::update_window_state,
            crate::window::commands::refresh_window_menu,
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
            crate::window::commands::get_windows_context_menu_status,
            crate::window::commands::register_windows_context_menu,
            crate::software_update::is_windows_installer_installation,
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
