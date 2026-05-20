use crate::session_store;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

const SETTINGS_FILE: &str = "settings.json";
pub const MIN_PET_SCALE: f64 = 0.75;
pub const MAX_PET_SCALE: f64 = 1.65;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PetSizePreset {
    Small,
    Medium,
    Large,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub do_not_disturb: bool,
    pub pet_always_on_top: bool,
    pub pet_lock_position: bool,
    pub pet_scale: f64,
    pub pet_size_preset: PetSizePreset,
    #[serde(default)]
    pub active_pet_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            do_not_disturb: false,
            pet_always_on_top: true,
            pet_lock_position: false,
            pet_scale: 1.0,
            pet_size_preset: PetSizePreset::Medium,
            active_pet_id: None,
        }
    }
}

pub fn load() -> Result<AppSettings, String> {
    let root = session_store::ensure_layout()?;
    load_from_root(&root)
}

pub fn save(settings: &AppSettings) -> Result<AppSettings, String> {
    let root = session_store::ensure_layout()?;
    save_to_root(&root, settings)
}

fn load_from_root(root: &Path) -> Result<AppSettings, String> {
    let path = root.join(SETTINGS_FILE);
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let settings: AppSettings = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    Ok(normalize(settings))
}

fn save_to_root(root: &Path, settings: &AppSettings) -> Result<AppSettings, String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let settings = normalize(settings.clone());
    let raw = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    fs::write(root.join(SETTINGS_FILE), raw).map_err(|error| error.to_string())?;
    Ok(settings)
}

fn normalize(mut settings: AppSettings) -> AppSettings {
    if !settings.pet_scale.is_finite() {
        settings.pet_scale = AppSettings::default().pet_scale;
    }
    settings.pet_scale = settings.pet_scale.clamp(MIN_PET_SCALE, MAX_PET_SCALE);
    settings
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_root() -> PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("claude-sprout-settings-test-{id}"))
    }

    #[test]
    fn loads_defaults_when_settings_file_is_missing() {
        let root = temp_root();

        assert_eq!(
            load_from_root(&root).expect("settings load should succeed"),
            AppSettings::default()
        );
    }

    #[test]
    fn saves_and_loads_settings_from_root() {
        let root = temp_root();
        let settings = AppSettings {
            do_not_disturb: true,
            pet_always_on_top: false,
            pet_lock_position: true,
            pet_scale: 1.25,
            pet_size_preset: PetSizePreset::Large,
            active_pet_id: Some("custom-sprout".into()),
        };

        save_to_root(&root, &settings).expect("settings save should succeed");

        assert_eq!(
            load_from_root(&root).expect("settings load should succeed"),
            settings
        );
        fs::remove_dir_all(root).expect("temp settings root should be removable");
    }

    #[test]
    fn clamps_invalid_pet_scale_values_on_load() {
        let root = temp_root();
        fs::create_dir_all(&root).expect("temp settings root should be created");
        fs::write(
            root.join("settings.json"),
            r#"{"doNotDisturb":false,"petAlwaysOnTop":true,"petLockPosition":false,"petScale":99.0,"petSizePreset":"custom"}"#,
        )
        .expect("settings file should be writable");

        let settings = load_from_root(&root).expect("settings load should succeed");

        assert_eq!(settings.pet_scale, MAX_PET_SCALE);
        fs::remove_dir_all(root).expect("temp settings root should be removable");
    }

    #[test]
    fn loads_settings_written_before_active_pet_selection() {
        let root = temp_root();
        fs::create_dir_all(&root).expect("temp settings root should be created");
        fs::write(
            root.join("settings.json"),
            r#"{"doNotDisturb":true,"petAlwaysOnTop":true,"petLockPosition":false,"petScale":1.0,"petSizePreset":"medium"}"#,
        )
        .expect("settings file should be writable");

        let settings = load_from_root(&root).expect("legacy settings should load");

        assert_eq!(settings.active_pet_id, None);
        assert!(settings.do_not_disturb);
        fs::remove_dir_all(root).expect("temp settings root should be removable");
    }
}
