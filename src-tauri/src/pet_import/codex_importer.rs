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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPet {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub spritesheet_path: String,
    pub atlas: String,
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
    fs::copy(source.join("pet.json"), target.join("pet.json"))
        .map_err(|error| error.to_string())?;
    fs::copy(
        source.join("spritesheet.webp"),
        target.join("spritesheet.webp"),
    )
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

pub fn list_installed_pets() -> Result<Vec<InstalledPet>, String> {
    let root = session_store::ensure_layout()?.join("pets");
    list_installed_pets_from_root(&root)
}

fn list_installed_pets_from_root(root: &Path) -> Result<Vec<InstalledPet>, String> {
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let mut pets = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let pet_dir = entry.path();
        let manifest_path = pet_dir.join("manifest.json");
        if !manifest_path.is_file() {
            continue;
        }

        let raw = fs::read_to_string(manifest_path).map_err(|error| error.to_string())?;
        let manifest: PetManifest =
            serde_json::from_str(&raw).map_err(|error| error.to_string())?;
        let spritesheet_path = pet_dir.join(&manifest.spritesheet);
        if !spritesheet_path.is_file() {
            continue;
        }

        pets.push(InstalledPet {
            id: manifest.id,
            name: manifest.name,
            description: manifest.description,
            spritesheet_path: spritesheet_path.to_string_lossy().to_string(),
            atlas: manifest.atlas,
        });
    }

    pets.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(pets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_root() -> PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("claude-sprout-pets-test-{id}"))
    }

    #[test]
    fn lists_installed_pets_from_manifests() {
        let root = temp_root();
        let pet_dir = root.join("sprout");
        fs::create_dir_all(&pet_dir).expect("pet directory should be created");
        fs::write(pet_dir.join("spritesheet.webp"), "fake")
            .expect("spritesheet should be writable");
        fs::write(
            pet_dir.join("manifest.json"),
            r#"{"id":"sprout","name":"Sprout","description":"Test pet","source":"codex","sourcePath":"C:/pets/sprout","spritesheet":"spritesheet.webp","atlas":"codex-8x9","importedAt":"2026-05-20T00:00:00Z"}"#,
        )
        .expect("manifest should be writable");

        let pets = list_installed_pets_from_root(&root).expect("installed pets should load");

        assert_eq!(
            pets,
            vec![InstalledPet {
                id: "sprout".into(),
                name: "Sprout".into(),
                description: Some("Test pet".into()),
                spritesheet_path: pet_dir
                    .join("spritesheet.webp")
                    .to_string_lossy()
                    .to_string(),
                atlas: "codex-8x9".into(),
            }]
        );
        fs::remove_dir_all(root).expect("temp pets root should be removable");
    }

    #[test]
    fn serializes_installed_pet_for_frontend() {
        let raw = serde_json::to_string(&InstalledPet {
            id: "sprout".into(),
            name: "Sprout".into(),
            description: None,
            spritesheet_path: "C:/pets/sprout/spritesheet.webp".into(),
            atlas: "codex-8x9".into(),
        })
        .expect("installed pet should serialize");

        assert!(raw.contains("spritesheetPath"));
        assert!(!raw.contains("spritesheet_path"));
    }
}
