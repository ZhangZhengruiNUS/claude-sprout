use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

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
    if let Ok(path) = std::env::var("CLAUDE_SPROUT_HOME") {
        return PathBuf::from(path);
    }

    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude-sprout")
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
    let session_dir = root.join("sessions");
    let mut sessions = Vec::new();

    for entry in fs::read_dir(session_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry.path().extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let raw = fs::read_to_string(entry.path()).map_err(|error| error.to_string())?;
        let mut session: SessionSnapshot =
            serde_json::from_str(&raw).map_err(|error| error.to_string())?;
        session.status = derive_status(&session);
        sessions.push(session);
    }

    Ok(sessions)
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
}
