use std::{fs, path::Path};

const CODEX_SPRITESHEET_WIDTH: u32 = 1536;
const CODEX_SPRITESHEET_HEIGHT: u32 = 1872;

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

    let spritesheet_path = path.join("spritesheet.webp");
    let (width, height) = read_webp_dimensions(&spritesheet_path)?;
    if width != CODEX_SPRITESHEET_WIDTH || height != CODEX_SPRITESHEET_HEIGHT {
        return Err(format!(
            "Expected spritesheet.webp to be {CODEX_SPRITESHEET_WIDTH}x{CODEX_SPRITESHEET_HEIGHT}, got {width}x{height}"
        ));
    }

    Ok(())
}

fn read_webp_dimensions(path: &Path) -> Result<(u32, u32), String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    if bytes.len() < 30 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return Err(format!("Invalid WebP spritesheet: {}", path.display()));
    }

    let mut offset = 12;
    while offset + 8 <= bytes.len() {
        let chunk = &bytes[offset..offset + 4];
        let size = u32::from_le_bytes([
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7],
        ]) as usize;
        let data_offset = offset + 8;
        if data_offset + size > bytes.len() {
            return Err(format!("Invalid WebP chunk in {}", path.display()));
        }

        match chunk {
            b"VP8X" if size >= 10 => {
                return Ok((
                    read_u24_le(&bytes[data_offset + 4..data_offset + 7]) + 1,
                    read_u24_le(&bytes[data_offset + 7..data_offset + 10]) + 1,
                ));
            }
            b"VP8L" if size >= 5 => {
                let b1 = bytes[data_offset + 1] as u32;
                let b2 = bytes[data_offset + 2] as u32;
                let b3 = bytes[data_offset + 3] as u32;
                let b4 = bytes[data_offset + 4] as u32;
                let width = 1 + (((b2 & 0x3f) << 8) | b1);
                let height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
                return Ok((width, height));
            }
            b"VP8 " if size >= 10 => {
                let width =
                    u16::from_le_bytes([bytes[data_offset + 6], bytes[data_offset + 7]]) as u32
                        & 0x3fff;
                let height =
                    u16::from_le_bytes([bytes[data_offset + 8], bytes[data_offset + 9]]) as u32
                        & 0x3fff;
                return Ok((width, height));
            }
            _ => {
                offset = data_offset + size + (size % 2);
            }
        }
    }

    Err(format!(
        "Unable to read WebP dimensions from {}",
        path.display()
    ))
}

fn read_u24_le(bytes: &[u8]) -> u32 {
    bytes[0] as u32 | ((bytes[1] as u32) << 8) | ((bytes[2] as u32) << 16)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_pet_dir() -> PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("agent-desktop-companion-codex-validator-test-{id}"))
    }

    fn write_pet_with_sprite_size(width: u32, height: u32) -> PathBuf {
        let pet_dir = temp_pet_dir();
        fs::create_dir_all(&pet_dir).expect("pet directory should be created");
        fs::write(pet_dir.join("pet.json"), "{}").expect("pet manifest should be writable");
        fs::write(pet_dir.join("spritesheet.webp"), vp8x_webp_header(width, height))
            .expect("spritesheet should be writable");
        pet_dir
    }

    #[test]
    fn accepts_codex_sized_webp_spritesheets() {
        let pet_dir = write_pet_with_sprite_size(1536, 1872);

        validate_codex_pet_dir(&pet_dir).expect("codex-sized spritesheet should be valid");

        fs::remove_dir_all(pet_dir).expect("temp pet directory should be removable");
    }

    #[test]
    fn rejects_non_codex_sized_webp_spritesheets() {
        let pet_dir = write_pet_with_sprite_size(1728, 1664);

        let error = validate_codex_pet_dir(&pet_dir)
            .expect_err("old 9-column by 8-row spritesheet should be rejected");

        assert!(error.contains("Expected spritesheet.webp to be 1536x1872"));
        fs::remove_dir_all(pet_dir).expect("temp pet directory should be removable");
    }

    fn vp8x_webp_header(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&22u32.to_le_bytes());
        bytes.extend_from_slice(b"WEBP");
        bytes.extend_from_slice(b"VP8X");
        bytes.extend_from_slice(&10u32.to_le_bytes());
        bytes.extend_from_slice(&[0, 0, 0, 0]);
        bytes.extend_from_slice(&u24_le(width - 1));
        bytes.extend_from_slice(&u24_le(height - 1));
        bytes
    }

    fn u24_le(value: u32) -> [u8; 3] {
        [
            (value & 0xff) as u8,
            ((value >> 8) & 0xff) as u8,
            ((value >> 16) & 0xff) as u8,
        ]
    }
}
