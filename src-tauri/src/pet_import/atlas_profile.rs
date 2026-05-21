use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtlasProfile {
    pub id: String,
    pub rows: u8,
    pub cols: u8,
    pub frame_width: u16,
    pub frame_height: u16,
    pub default_frame_duration_ms: u16,
}

pub fn codex_8x9_profile() -> AtlasProfile {
    AtlasProfile {
        id: "codex-8x9".into(),
        rows: 9,
        cols: 8,
        frame_width: 192,
        frame_height: 208,
        default_frame_duration_ms: 120,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_profile_matches_codex_atlas_geometry() {
        let profile = codex_8x9_profile();

        assert_eq!(profile.id, "codex-8x9");
        assert_eq!(profile.rows, 9);
        assert_eq!(profile.cols, 8);
        assert_eq!(profile.frame_width, 192);
        assert_eq!(profile.frame_height, 208);
    }
}
