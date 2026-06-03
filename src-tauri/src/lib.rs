mod database;
mod file_system;
mod models;
mod window;

use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                crate::window::state::persist_current_window_state(window);
            }
            _ => {}
        })
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                crate::window::os::setup_window(&window);
            }
            crate::window::state::restore_window_state(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::file_system::read_markdown_file,
            crate::file_system::write_markdown_file,
            crate::file_system::stat_markdown_file,
            crate::database::remember_recent_file,
            crate::database::list_recent_files,
            crate::database::create_document_snapshot,
            crate::database::list_document_snapshots,
            crate::database::update_app_setting,
            crate::database::list_app_settings,
            crate::window::commands::update_window_state,
            crate::window::commands::refresh_window_menu,
            crate::file_system::list_folder_markdown_files,
            crate::window::commands::create_new_window,
            crate::window::commands::minimize_window,
            crate::window::commands::maximize_window,
            crate::window::commands::close_window,
            crate::file_system::get_folder_tree
        ])
        .run(tauri::generate_context!())
        .expect("error while running NewMd");
}
