use super::codex_validator::validate_codex_pet_dir;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexPetCandidate {
    pub id: String,
    pub source_path: String,
    pub valid: bool,
    pub reason: Option<String>,
}

pub fn scan_codex_pets() -> Result<Vec<CodexPetCandidate>, String> {
    let mut roots = Vec::new();
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".codex").join("pets"));
    }
    if let Ok(codex_home) = std::env::var("CODEX_HOME") {
        roots.push(PathBuf::from(codex_home).join("pets"));
    }

    let mut candidates = Vec::new();
    for root in roots {
        if !root.is_dir() {
            continue;
        }

        for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let id = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("unknown")
                .to_string();
            let validation = validate_codex_pet_dir(&path);
            candidates.push(CodexPetCandidate {
                id,
                source_path: path.to_string_lossy().to_string(),
                valid: validation.is_ok(),
                reason: validation.err(),
            });
        }
    }

    Ok(candidates)
}
