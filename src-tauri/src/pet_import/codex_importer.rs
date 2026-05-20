use super::{atlas_profile::codex_8x9_profile, codex_validator::validate_codex_pet_dir};
use crate::session_store;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetManifest {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    pub spritesheet: String,
    pub atlas: String,
    #[serde(rename = "importedAt")]
    pub imported_at: String,
}

pub fn import_codex_pet(source: &Path) -> Result<PetManifest, String> {
    validate_codex_pet_dir(source)?;

    let id = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Unable to infer pet id".to_string())?
        .to_string();
    let target = session_store::ensure_layout()?.join("pets").join(&id);
    fs::create_dir_all(&target).map_err(|error| error.to_string())?;
    fs::copy(source.join("pet.json"), target.join("pet.json")).map_err(|error| error.to_string())?;
    fs::copy(source.join("spritesheet.webp"), target.join("spritesheet.webp"))
        .map_err(|error| error.to_string())?;

    let profile = codex_8x9_profile();
    let manifest = PetManifest {
        id: id.clone(),
        name: id,
        description: None,
        source: "codex".into(),
        source_path: source.to_string_lossy().to_string(),
        spritesheet: "spritesheet.webp".into(),
        atlas: profile.id,
        imported_at: Utc::now().to_rfc3339(),
    };

    let raw = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(target.join("manifest.json"), raw).map_err(|error| error.to_string())?;

    Ok(manifest)
}
