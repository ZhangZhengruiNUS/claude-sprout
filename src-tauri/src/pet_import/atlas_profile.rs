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
        rows: 8,
        cols: 9,
        frame_width: 192,
        frame_height: 208,
        default_frame_duration_ms: 120,
    }
}
