mod app_settings;
mod commands;
mod notifications;
mod pet_import;
mod session_store;
mod session_watcher;
mod storage_cleanup;
mod tray;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            tray::create_tray(app)?;
            session_watcher::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_sessions,
            commands::refresh_sessions,
            commands::load_app_settings,
            commands::save_app_settings,
            commands::show_session_panel,
            commands::toggle_pet_window,
            commands::open_data_folder,
            commands::open_project_folder,
            commands::scan_codex_pets,
            commands::import_codex_pet,
            commands::list_installed_pets,
            commands::get_storage_summary,
            commands::clean_storage
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Claude Sprout");
}
