use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const APP_HOME_ENV: &str = "AGENT_DESKTOP_COMPANION_HOME";
const LEGACY_HOME_ENV: &str = "CLAUDE_SPROUT_HOME";
const APP_DATA_DIR: &str = ".agent-desktop-companion";
const LEGACY_DATA_DIR: &str = ".claude-sprout";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Idle,
    Running,
    ToolRunning,
    WaitingPermission,
    WaitingInput,
    Done,
    Error,
    Stale,
    ProbablyClosed,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSnapshot {
    pub session_id: String,
    pub project_name: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub conversation_preview: Option<String>,
    pub cwd: String,
    pub status: SessionStatus,
    pub last_event: String,
    pub notification_type: Option<String>,
    pub last_tool: Option<String>,
    pub context_used_percentage: Option<f64>,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub end_reason: Option<String>,
    pub source: String,
}

pub fn data_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let app_home = std::env::var(APP_HOME_ENV).ok();
    let legacy_home = std::env::var(LEGACY_HOME_ENV).ok();
    resolve_data_dir(&home, app_home.as_deref(), legacy_home.as_deref())
}

fn resolve_data_dir(home: &Path, app_home: Option<&str>, legacy_home: Option<&str>) -> PathBuf {
    if let Some(path) = non_empty_env_path(app_home) {
        return PathBuf::from(path);
    }
    if let Some(path) = non_empty_env_path(legacy_home) {
        return PathBuf::from(path);
    }

    let app_dir = home.join(APP_DATA_DIR);
    if app_dir.exists() {
        return app_dir;
    }

    let legacy_dir = home.join(LEGACY_DATA_DIR);
    if legacy_dir.exists() {
        return legacy_dir;
    }

    app_dir
}

fn non_empty_env_path(value: Option<&str>) -> Option<&str> {
    value.and_then(|path| {
        if path.trim().is_empty() {
            None
        } else {
            Some(path)
        }
    })
}

pub fn ensure_layout() -> Result<PathBuf, String> {
    let root = data_dir();
    for child in ["sessions", "events", "pets"] {
        fs::create_dir_all(root.join(child)).map_err(|error| error.to_string())?;
    }
    Ok(root)
}

pub fn list_sessions() -> Result<Vec<SessionSnapshot>, String> {
    let root = ensure_layout()?;
    list_sessions_from_root(&root)
}

fn list_sessions_from_root(root: &Path) -> Result<Vec<SessionSnapshot>, String> {
    let session_dir = root.join("sessions");
    let mut sessions = Vec::new();

    for entry in fs::read_dir(session_dir).map_err(|error| error.to_string())? {
        let Ok(entry) = entry else {
            continue;
        };
        if entry.path().extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let Ok(raw) = fs::read_to_string(entry.path()) else {
            continue;
        };
        let Ok(mut session) = parse_session_snapshot(&raw) else {
            continue;
        };
        session.status = derive_status(&session);
        sessions.push(session);
    }

    Ok(sessions)
}

pub fn session_dir_fingerprint() -> Result<Vec<String>, String> {
    let root = ensure_layout()?;
    session_dir_fingerprint_from_root(&root)
}

fn session_dir_fingerprint_from_root(root: &Path) -> Result<Vec<String>, String> {
    let session_dir = root.join("sessions");
    let mut fingerprint = Vec::new();

    for entry in fs::read_dir(session_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(system_time_ms)
            .unwrap_or_default();
        fingerprint.push(format!(
            "{}:{}:{}",
            path.file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default(),
            metadata.len(),
            modified_ms
        ));
    }

    fingerprint.sort();
    Ok(fingerprint)
}

fn parse_session_snapshot(raw: &str) -> Result<SessionSnapshot, serde_json::Error> {
    serde_json::from_str(raw.trim_start_matches('\u{feff}'))
}

fn system_time_ms(value: SystemTime) -> Option<u128> {
    value
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis())
}

fn derive_status(session: &SessionSnapshot) -> SessionStatus {
    if matches!(
        session.status,
        SessionStatus::Closed
            | SessionStatus::Done
            | SessionStatus::Error
            | SessionStatus::WaitingPermission
    ) {
        return session.status.clone();
    }

    if session.ended_at.is_some() {
        return SessionStatus::Closed;
    }

    let heartbeat = session.last_heartbeat_at.unwrap_or(session.updated_at);
    let age = Utc::now() - heartbeat;
    if age > Duration::minutes(10) {
        return SessionStatus::ProbablyClosed;
    }
    if age > Duration::minutes(2) {
        return SessionStatus::Stale;
    }

    session.status.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot_with_age(minutes: i64) -> SessionSnapshot {
        SessionSnapshot {
            session_id: "test".into(),
            project_name: "project".into(),
            display_name: None,
            conversation_preview: None,
            cwd: "C:/project".into(),
            status: SessionStatus::Running,
            last_event: "UserPromptSubmit".into(),
            notification_type: None,
            last_tool: None,
            context_used_percentage: None,
            last_heartbeat_at: Some(Utc::now() - Duration::minutes(minutes)),
            updated_at: Utc::now() - Duration::minutes(minutes),
            ended_at: None,
            end_reason: None,
            source: "test".into(),
        }
    }

    #[test]
    fn marks_stale_after_two_minutes() {
        assert_eq!(derive_status(&snapshot_with_age(3)), SessionStatus::Stale);
    }

    #[test]
    fn marks_probably_closed_after_ten_minutes() {
        assert_eq!(
            derive_status(&snapshot_with_age(11)),
            SessionStatus::ProbablyClosed
        );
    }

    #[test]
    fn marks_ended_running_session_closed() {
        let mut snapshot = snapshot_with_age(0);
        snapshot.ended_at = Some(Utc::now());

        assert_eq!(derive_status(&snapshot), SessionStatus::Closed);
    }

    #[test]
    fn fingerprints_json_session_files_only() {
        let root = std::env::temp_dir().join(format!(
            "agent-desktop-companion-session-fingerprint-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let session_dir = root.join("sessions");
        fs::create_dir_all(&session_dir).expect("session directory should be created");
        fs::write(session_dir.join("a.json"), "{}").expect("json file should be writable");
        fs::write(session_dir.join("ignore.txt"), "text").expect("text file should be writable");

        let fingerprint =
            session_dir_fingerprint_from_root(&root).expect("fingerprint should be readable");

        assert_eq!(fingerprint.len(), 1);
        assert!(fingerprint[0].starts_with("a.json:2:"));

        fs::remove_dir_all(root).expect("temp root should be removable");
    }

    #[test]
    fn parses_real_statusline_snapshot_with_waiting_input() {
        let raw = r#"{"session_id":"585b245a-9664-492d-b7f2-377b6cee236e","project_name":"ASUS","cwd":"C:\\Users\\ASUS","status":"waiting_input","last_event":"Notification","notification_type":"idle_prompt","last_tool":null,"context_used_percentage":12,"last_heartbeat_at":"2026-05-21T10:08:57.9219847Z","updated_at":"2026-05-21T10:08:57.9219847Z","ended_at":null,"end_reason":null,"source":"claude-code-statusline"}"#;

        let session = parse_session_snapshot(raw).expect("real statusline snapshot should parse");

        assert_eq!(session.status, SessionStatus::WaitingInput);
        assert_eq!(session.project_name, "ASUS");
        assert_eq!(session.context_used_percentage, Some(12.0));
    }

    #[test]
    fn parses_powershell_utf8_bom_snapshot() {
        let raw = "\u{feff}{\"session_id\":\"ps-session\",\"project_name\":\"ASUS\",\"cwd\":\"C:\\\\Users\\\\ASUS\",\"status\":\"waiting_input\",\"last_event\":\"Notification\",\"notification_type\":\"idle_prompt\",\"last_tool\":null,\"context_used_percentage\":2,\"last_heartbeat_at\":\"2026-05-21T10:31:20.8214442Z\",\"updated_at\":\"2026-05-21T10:31:20.8214442Z\",\"ended_at\":null,\"end_reason\":null,\"source\":\"claude-code-statusline\"}";

        let session =
            parse_session_snapshot(raw).expect("PowerShell UTF-8 BOM snapshot should parse");

        assert_eq!(session.session_id, "ps-session");
        assert_eq!(session.status, SessionStatus::WaitingInput);
    }

    #[test]
    fn parses_optional_display_name_for_renamed_sessions() {
        let raw = r#"{"session_id":"named-session","project_name":"ASUS","display_name":"Renamed release follow-up","cwd":"C:\\Users\\ASUS","status":"running","last_event":"UserPromptSubmit","notification_type":null,"last_tool":null,"context_used_percentage":4,"last_heartbeat_at":"2026-05-22T00:00:00Z","updated_at":"2026-05-22T00:00:00Z","ended_at":null,"end_reason":null,"source":"claude-code-statusline"}"#;

        let session = parse_session_snapshot(raw).expect("renamed session snapshot should parse");

        assert_eq!(session.display_name.as_deref(), Some("Renamed release follow-up"));
    }

    #[test]
    fn parses_optional_conversation_preview_for_opt_in_cards() {
        let raw = r#"{"session_id":"preview-session","project_name":"ASUS","display_name":null,"conversation_preview":"Claude: running the release smoke now","cwd":"C:\\Users\\ASUS","status":"tool_running","last_event":"PreToolUse","notification_type":null,"last_tool":"Bash","context_used_percentage":4,"last_heartbeat_at":"2026-05-22T00:00:00Z","updated_at":"2026-05-22T00:00:00Z","ended_at":null,"end_reason":null,"source":"claude-code-statusline"}"#;

        let session = parse_session_snapshot(raw).expect("preview session snapshot should parse");

        assert_eq!(
            session.conversation_preview.as_deref(),
            Some("Claude: running the release smoke now")
        );
    }

    #[test]
    fn resolves_new_data_home_before_legacy_home() {
        let root = PathBuf::from("C:/Users/Test");

        assert_eq!(
            resolve_data_dir(
                &root,
                Some("C:/custom/agent-desktop-companion"),
                Some("C:/custom/claude-sprout"),
            ),
            PathBuf::from("C:/custom/agent-desktop-companion")
        );
    }

    #[test]
    fn resolves_legacy_home_when_new_home_is_not_set() {
        let root = PathBuf::from("C:/Users/Test");

        assert_eq!(
            resolve_data_dir(&root, None, Some("C:/custom/claude-sprout")),
            PathBuf::from("C:/custom/claude-sprout")
        );
    }

    #[test]
    fn resolves_existing_legacy_directory_before_creating_new_default() {
        let home = std::env::temp_dir().join(format!(
            "agent-desktop-companion-home-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let legacy = home.join(LEGACY_DATA_DIR);
        fs::create_dir_all(&legacy).expect("legacy data directory should be created");

        assert_eq!(resolve_data_dir(&home, None, None), legacy);

        fs::remove_dir_all(home).expect("temp home should be removable");
    }

    #[test]
    fn resolves_new_default_when_no_legacy_directory_exists() {
        let home = std::env::temp_dir().join(format!(
            "agent-desktop-companion-new-home-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));

        assert_eq!(resolve_data_dir(&home, None, None), home.join(APP_DATA_DIR));
    }

    #[test]
    fn skips_malformed_session_files_when_listing() {
        let root = std::env::temp_dir().join(format!(
            "agent-desktop-companion-session-list-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let session_dir = root.join("sessions");
        fs::create_dir_all(&session_dir).expect("session directory should be created");
        fs::write(session_dir.join("bad.json"), "not-json").expect("bad file should be writable");

        let good_snapshot = snapshot_with_age(0);
        fs::write(
            session_dir.join("good.json"),
            serde_json::to_string(&good_snapshot).expect("snapshot should serialize"),
        )
        .expect("good file should be writable");

        let sessions = list_sessions_from_root(&root).expect("sessions should list");

        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, good_snapshot.session_id);

        fs::remove_dir_all(root).expect("temp root should be removable");
    }
}
