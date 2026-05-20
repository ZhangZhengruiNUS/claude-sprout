use super::codex_validator::validate_codex_pet_dir;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

    scan_codex_pets_from_roots(roots)
}

fn scan_codex_pets_from_roots(roots: Vec<PathBuf>) -> Result<Vec<CodexPetCandidate>, String> {
    let mut seen_roots = HashSet::new();
    let mut candidates = Vec::new();
    for root in roots {
        if !root.is_dir() {
            continue;
        }

        let root_key = fs::canonicalize(&root).unwrap_or(root.clone());
        if !seen_roots.insert(root_key) {
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

    candidates.sort_by(|left, right| {
        left.id
            .cmp(&right.id)
            .then_with(|| left.source_path.cmp(&right.source_path))
    });
    Ok(candidates)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_root() -> PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("claude-sprout-codex-scan-test-{id}"))
    }

    fn write_valid_pet(path: &Path) {
        fs::create_dir_all(path).expect("pet directory should be created");
        fs::write(path.join("pet.json"), "{}").expect("pet manifest should be writable");
        fs::write(path.join("spritesheet.webp"), "fake").expect("spritesheet should be writable");
    }

    #[test]
    fn scans_multiple_roots_and_reports_invalid_candidates() {
        let root = temp_root();
        let first_root = root.join("home").join(".codex").join("pets");
        let second_root = root.join("codex-home").join("pets");
        write_valid_pet(&first_root.join("sprout"));
        fs::create_dir_all(second_root.join("broken")).expect("broken pet directory should exist");

        let candidates = scan_codex_pets_from_roots(vec![first_root, second_root])
            .expect("pet candidates should scan");

        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].id, "broken");
        assert!(!candidates[0].valid);
        assert!(candidates[0]
            .reason
            .as_deref()
            .expect("invalid pet should include reason")
            .contains("Missing required file"));
        assert_eq!(candidates[1].id, "sprout");
        assert!(candidates[1].valid);
        assert_eq!(candidates[1].reason, None);

        fs::remove_dir_all(root).expect("temp scan root should be removable");
    }

    #[test]
    fn skips_duplicate_scan_roots() {
        let root = temp_root();
        let pets_root = root.join("home").join(".codex").join("pets");
        write_valid_pet(&pets_root.join("sprout"));

        let candidates = scan_codex_pets_from_roots(vec![pets_root.clone(), pets_root])
            .expect("pet candidates should scan");

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].id, "sprout");

        fs::remove_dir_all(root).expect("temp scan root should be removable");
    }

    #[test]
    fn serializes_candidate_for_frontend() {
        let raw = serde_json::to_string(&CodexPetCandidate {
            id: "sprout".into(),
            source_path: "C:/Users/Test/.codex/pets/sprout".into(),
            valid: true,
            reason: None,
        })
        .expect("candidate should serialize");

        assert!(raw.contains("sourcePath"));
        assert!(!raw.contains("source_path"));
    }
}
