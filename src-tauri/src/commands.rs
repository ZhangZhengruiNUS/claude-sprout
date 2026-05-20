use crate::{pet_import, session_store};
use std::{path::Path, process::Command};

#[tauri::command]
pub fn list_sessions() -> Result<Vec<session_store::SessionSnapshot>, String> {
    session_store::list_sessions()
}

#[tauri::command]
pub fn refresh_sessions() -> Result<(), String> {
    session_store::ensure_layout().map(|_| ())
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
pub fn scan_codex_pets() -> Result<Vec<pet_import::CodexPetCandidate>, String> {
    pet_import::scan_codex_pets()
}

#[tauri::command]
pub fn import_codex_pet(path: String) -> Result<pet_import::PetManifest, String> {
    pet_import::import_codex_pet(Path::new(&path))
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
