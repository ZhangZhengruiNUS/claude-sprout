use crate::{app_settings, pet_import, session_store, storage_cleanup};
use std::{path::Path, process::Command};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn list_sessions() -> Result<Vec<session_store::SessionSnapshot>, String> {
    session_store::list_sessions()
}

#[tauri::command]
pub fn refresh_sessions() -> Result<(), String> {
    session_store::ensure_layout().map(|_| ())
}

#[tauri::command]
pub fn load_app_settings() -> Result<app_settings::AppSettings, String> {
    app_settings::load()
}

#[tauri::command]
pub fn save_app_settings(
    settings: app_settings::AppSettings,
) -> Result<app_settings::AppSettings, String> {
    app_settings::save(&settings)
}

#[tauri::command]
pub fn open_data_folder() -> Result<(), String> {
    let path = session_store::ensure_layout()?;
    open_path(&path)
}

#[tauri::command]
pub fn open_project_folder(path: String) -> Result<(), String> {
    open_path(Path::new(&path))
}

#[tauri::command]
pub fn show_session_panel(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_pet_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pet") {
        if window.is_visible().map_err(|error| error.to_string())? {
            window.hide().map_err(|error| error.to_string())?;
        } else {
            window.show().map_err(|error| error.to_string())?;
            window.set_focus().map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn scan_codex_pets() -> Result<Vec<pet_import::CodexPetCandidate>, String> {
    pet_import::scan_codex_pets()
}

#[tauri::command]
pub fn import_codex_pet(path: String) -> Result<pet_import::PetManifest, String> {
    pet_import::import_codex_pet(Path::new(&path))
}

#[tauri::command]
pub fn list_installed_pets() -> Result<Vec<pet_import::InstalledPet>, String> {
    pet_import::list_installed_pets()
}

#[tauri::command]
pub fn get_storage_summary() -> Result<storage_cleanup::StorageSummary, String> {
    storage_cleanup::summarize()
}

#[tauri::command]
pub fn clean_storage(
    request: storage_cleanup::StorageCleanRequest,
) -> Result<storage_cleanup::StorageCleanResult, String> {
    storage_cleanup::clean(request)
}

fn open_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}
