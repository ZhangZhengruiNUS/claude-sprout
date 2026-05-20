use std::path::Path;

pub fn validate_codex_pet_dir(path: &Path) -> Result<(), String> {
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", path.display()));
    }

    for file in ["pet.json", "spritesheet.webp"] {
        let candidate = path.join(file);
        if !candidate.is_file() {
            return Err(format!("Missing required file: {}", candidate.display()));
        }
    }

    Ok(())
}
