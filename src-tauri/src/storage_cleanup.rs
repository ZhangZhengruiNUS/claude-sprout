use crate::session_store::{self, SessionSnapshot, SessionStatus};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

const OLD_EVENT_AGE: Duration = Duration::from_secs(14 * 24 * 60 * 60);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageSummary {
    pub root_path: String,
    pub sessions: StorageBucketSummary,
    pub events: StorageBucketSummary,
    pub pets: StorageBucketSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageBucketSummary {
    pub file_count: u64,
    pub directory_count: u64,
    pub total_bytes: u64,
    pub cleanable_file_count: u64,
    pub cleanable_bytes: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StorageCleanKind {
    SafeSessions,
    OldEvents,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanResult {
    pub deleted_file_count: u64,
    pub deleted_bytes: u64,
    pub kept_file_count: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanRequest {
    pub kind: StorageCleanKind,
    pub expected_cleanable_file_count: u64,
    pub expected_cleanable_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CleanCandidate {
    path: PathBuf,
    bytes: u64,
}

pub fn summarize() -> Result<StorageSummary, String> {
    let root = session_store::ensure_layout()?;
    summarize_from_root(&root)
}

pub fn clean(request: StorageCleanRequest) -> Result<StorageCleanResult, String> {
    let root = session_store::ensure_layout()?;
    clean_from_root_checked(&root, request)
}

pub(crate) fn summarize_from_root(root: &Path) -> Result<StorageSummary, String> {
    summarize_from_root_at(root, SystemTime::now())
}

pub(crate) fn summarize_from_root_at(
    root: &Path,
    now: SystemTime,
) -> Result<StorageSummary, String> {
    Ok(StorageSummary {
        root_path: root.display().to_string(),
        sessions: summarize_sessions(&root.join("sessions"))?,
        events: summarize_events_at(&root.join("events"), now)?,
        pets: summarize_pets(&root.join("pets"))?,
    })
}

#[cfg(test)]
pub(crate) fn clean_from_root(
    root: &Path,
    kind: StorageCleanKind,
) -> Result<StorageCleanResult, String> {
    clean_from_root_at(root, kind, SystemTime::now())
}

pub(crate) fn clean_from_root_checked(
    root: &Path,
    request: StorageCleanRequest,
) -> Result<StorageCleanResult, String> {
    clean_from_root_checked_at(root, request, SystemTime::now())
}

pub(crate) fn clean_from_root_checked_at(
    root: &Path,
    request: StorageCleanRequest,
    now: SystemTime,
) -> Result<StorageCleanResult, String> {
    let (candidates, kept_file_count) = collect_clean_candidates_for_kind(root, request.kind, now)?;
    let cleanable_file_count = candidates.len() as u64;
    let cleanable_bytes = candidates.iter().map(|candidate| candidate.bytes).sum::<u64>();

    if cleanable_file_count != request.expected_cleanable_file_count
        || cleanable_bytes != request.expected_cleanable_bytes
    {
        return Err(format!(
            "Storage changed since preview. Expected {} files / {} bytes, found {} files / {} bytes. Refresh storage and try again.",
            request.expected_cleanable_file_count,
            request.expected_cleanable_bytes,
            cleanable_file_count,
            cleanable_bytes
        ));
    }

    delete_candidates(candidates, kept_file_count)
}

#[cfg(test)]
pub(crate) fn clean_from_root_at(
    root: &Path,
    kind: StorageCleanKind,
    now: SystemTime,
) -> Result<StorageCleanResult, String> {
    let (candidates, kept_file_count) = collect_clean_candidates_for_kind(root, kind, now)?;
    delete_candidates(candidates, kept_file_count)
}

fn summarize_sessions(path: &Path) -> Result<StorageBucketSummary, String> {
    summarize_direct_files(path, |path, metadata| {
        if is_safe_session_file(path, metadata) {
            Some(metadata.len())
        } else {
            None
        }
    })
}

fn summarize_events_at(path: &Path, now: SystemTime) -> Result<StorageBucketSummary, String> {
    summarize_direct_files(path, |_, metadata| {
        if is_old_event_file(metadata, now) {
            Some(metadata.len())
        } else {
            None
        }
    })
}

fn summarize_direct_files<F>(
    path: &Path,
    mut cleanable_bytes: F,
) -> Result<StorageBucketSummary, String>
where
    F: FnMut(&Path, &fs::Metadata) -> Option<u64>,
{
    let mut summary = StorageBucketSummary::default();
    if !path.exists() {
        return Ok(summary);
    }

    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if file_type.is_file() {
            summary.file_count += 1;
            summary.total_bytes += metadata.len();
            if let Some(bytes) = cleanable_bytes(&entry.path(), &metadata) {
                summary.cleanable_file_count += 1;
                summary.cleanable_bytes += bytes;
            }
        } else if file_type.is_dir() {
            summary.directory_count += 1;
        }
    }

    Ok(summary)
}

fn summarize_pets(path: &Path) -> Result<StorageBucketSummary, String> {
    let mut summary = StorageBucketSummary::default();
    if !path.exists() {
        return Ok(summary);
    }

    count_recursive(path, &mut summary)?;
    Ok(summary)
}

fn count_recursive(path: &Path, summary: &mut StorageBucketSummary) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if file_type.is_file() {
            summary.file_count += 1;
            summary.total_bytes += metadata.len();
        } else if file_type.is_dir() {
            summary.directory_count += 1;
            count_recursive(&entry.path(), summary)?;
        }
    }
    Ok(())
}

fn collect_clean_candidates_for_kind(
    root: &Path,
    kind: StorageCleanKind,
    now: SystemTime,
) -> Result<(Vec<CleanCandidate>, u64), String> {
    match kind {
        StorageCleanKind::SafeSessions => {
            collect_clean_candidates(&root.join("sessions"), is_safe_session_file)
        }
        StorageCleanKind::OldEvents => collect_clean_candidates(&root.join("events"), |_, metadata| {
            is_old_event_file(metadata, now)
        }),
    }
}

fn collect_clean_candidates<F>(
    path: &Path,
    mut cleanable: F,
) -> Result<(Vec<CleanCandidate>, u64), String>
where
    F: FnMut(&Path, &fs::Metadata) -> bool,
{
    let mut candidates = Vec::new();
    let mut kept_file_count = 0;
    if !path.exists() {
        return Ok((candidates, kept_file_count));
    }

    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };

        if !file_type.is_file() {
            continue;
        }

        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if cleanable(&path, &metadata) {
            candidates.push(CleanCandidate {
                path,
                bytes: metadata.len(),
            });
        } else {
            kept_file_count += 1;
        }
    }

    Ok((candidates, kept_file_count))
}

fn delete_candidates(
    candidates: Vec<CleanCandidate>,
    kept_file_count: u64,
) -> Result<StorageCleanResult, String> {
    let mut result = StorageCleanResult {
        kept_file_count,
        ..StorageCleanResult::default()
    };

    for candidate in candidates {
        fs::remove_file(&candidate.path).map_err(|error| error.to_string())?;
        result.deleted_file_count += 1;
        result.deleted_bytes += candidate.bytes;
    }

    Ok(result)
}

fn is_safe_session_file(path: &Path, _: &fs::Metadata) -> bool {
    let Ok(raw) = fs::read_to_string(path) else {
        return false;
    };
    let Ok(session) = serde_json::from_str::<SessionSnapshot>(&raw) else {
        return false;
    };

    matches!(
        session.status,
        SessionStatus::Done
            | SessionStatus::Error
            | SessionStatus::Closed
            | SessionStatus::ProbablyClosed
    )
}

fn is_old_event_file(metadata: &fs::Metadata, now: SystemTime) -> bool {
    metadata
        .modified()
        .ok()
        .and_then(|modified| now.duration_since(modified).ok())
        .is_some_and(|age| age > OLD_EVENT_AGE)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    use std::{
        fs,
        path::{Path, PathBuf},
        process::Command,
    };

    fn temp_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "claude-sprout-storage-cleanup-{name}-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ))
    }

    fn session_json(status: &str, heartbeat_minutes_ago: Option<i64>) -> String {
        let updated_at = Utc::now() - Duration::minutes(heartbeat_minutes_ago.unwrap_or(0));
        let ended_at = if status == "closed" {
            format!(r#""{}""#, Utc::now().to_rfc3339())
        } else {
            "null".to_string()
        };

        format!(
            r#"{{
  "session_id": "test-{status}",
  "project_name": "project",
  "cwd": "C:/project",
  "status": "{status}",
  "last_event": "UserPromptSubmit",
  "notification_type": null,
  "last_tool": null,
  "context_used_percentage": null,
  "last_heartbeat_at": "{}",
  "updated_at": "{}",
  "ended_at": {ended_at},
  "end_reason": null,
  "source": "test"
}}"#,
            updated_at.to_rfc3339(),
            updated_at.to_rfc3339()
        )
    }

    fn write_file(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent directory should be created");
        }
        fs::write(path, contents).expect("file should be writable");
    }

    fn make_file_old(path: &Path, days: u64) {
        let status = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "& { param($Path, $Days) (Get-Item -LiteralPath $Path).LastWriteTimeUtc = (Get-Date).ToUniversalTime().AddDays(-[int]$Days) }",
            ])
            .arg(path)
            .arg(days.to_string())
            .status()
            .expect("PowerShell should be available to set file modified time");

        assert!(status.success(), "file modified time should be adjustable");
    }

    #[test]
    fn summarizes_storage_buckets() {
        let root = temp_root("summary");
        write_file(
            &root.join("sessions").join("done.json"),
            &session_json("done", None),
        );
        write_file(&root.join("events").join("recent.json"), "event");
        write_file(
            &root.join("pets").join("sprout").join("manifest.json"),
            "{}",
        );

        let summary = summarize_from_root(&root).expect("storage summary should succeed");

        assert_eq!(summary.root_path, root.display().to_string());
        assert_eq!(summary.sessions.file_count, 1);
        assert_eq!(summary.sessions.directory_count, 0);
        assert_eq!(summary.sessions.cleanable_file_count, 1);
        assert!(summary.sessions.cleanable_bytes > 0);
        assert_eq!(summary.events.file_count, 1);
        assert_eq!(summary.events.cleanable_file_count, 0);
        assert_eq!(summary.pets.file_count, 1);
        assert_eq!(summary.pets.directory_count, 1);
        assert_eq!(summary.pets.cleanable_file_count, 0);
        assert_eq!(summary.pets.cleanable_bytes, 0);

        fs::remove_dir_all(root).expect("temp root should be removable");
    }

    #[test]
    fn cleans_only_safe_sessions() {
        let root = temp_root("sessions");
        write_file(
            &root.join("sessions").join("done.json"),
            &session_json("done", None),
        );
        write_file(
            &root.join("sessions").join("error.json"),
            &session_json("error", None),
        );
        write_file(
            &root.join("sessions").join("closed.json"),
            &session_json("closed", None),
        );
        write_file(
            &root.join("sessions").join("probably-closed.json"),
            &session_json("probably_closed", Some(11)),
        );
        write_file(
            &root.join("sessions").join("old-waiting-input.json"),
            &session_json("waiting_input", Some(11)),
        );
        write_file(
            &root.join("sessions").join("running.json"),
            &session_json("running", None),
        );
        write_file(
            &root.join("sessions").join("tool-running.json"),
            &session_json("tool_running", None),
        );
        write_file(
            &root.join("sessions").join("waiting-input.json"),
            &session_json("waiting_input", None),
        );
        write_file(
            &root.join("sessions").join("waiting-permission.json"),
            &session_json("waiting_permission", None),
        );
        write_file(
            &root.join("sessions").join("idle.json"),
            &session_json("idle", None),
        );
        write_file(
            &root.join("sessions").join("stale.json"),
            &session_json("running", Some(3)),
        );
        write_file(
            &root.join("sessions").join("raw-stale-old.json"),
            &session_json("stale", Some(11)),
        );
        write_file(&root.join("sessions").join("broken.json"), "{");

        let result =
            clean_from_root(&root, StorageCleanKind::SafeSessions).expect("cleanup should succeed");

        assert_eq!(result.deleted_file_count, 4);
        assert_eq!(result.kept_file_count, 9);
        assert!(!root.join("sessions").join("done.json").exists());
        assert!(!root.join("sessions").join("error.json").exists());
        assert!(!root.join("sessions").join("closed.json").exists());
        assert!(!root.join("sessions").join("probably-closed.json").exists());
        assert!(root.join("sessions").join("running.json").exists());
        assert!(root.join("sessions").join("tool-running.json").exists());
        assert!(root.join("sessions").join("waiting-input.json").exists());
        assert!(root.join("sessions").join("old-waiting-input.json").exists());
        assert!(root
            .join("sessions")
            .join("waiting-permission.json")
            .exists());
        assert!(root.join("sessions").join("idle.json").exists());
        assert!(root.join("sessions").join("stale.json").exists());
        assert!(root.join("sessions").join("raw-stale-old.json").exists());
        assert!(root.join("sessions").join("broken.json").exists());

        fs::remove_dir_all(root).expect("temp root should be removable");
    }

    #[test]
    fn checked_cleanup_rejects_stale_preview_counts() {
        let root = temp_root("stale-preview");
        write_file(
            &root.join("sessions").join("done.json"),
            &session_json("done", None),
        );

        let result = clean_from_root_checked(
            &root,
            StorageCleanRequest {
                kind: StorageCleanKind::SafeSessions,
                expected_cleanable_file_count: 0,
                expected_cleanable_bytes: 0,
            },
        );

        assert!(result.is_err());
        assert!(root.join("sessions").join("done.json").exists());

        fs::remove_dir_all(root).expect("temp root should be removable");
    }

    #[test]
    fn cleans_only_old_event_files() {
        let root = temp_root("events");
        write_file(&root.join("events").join("old.json"), "old");
        write_file(&root.join("events").join("recent.json"), "recent");
        fs::create_dir_all(root.join("events").join("old-dir"))
            .expect("event directory should be created");
        make_file_old(&root.join("events").join("old.json"), 15);

        let result =
            clean_from_root(&root, StorageCleanKind::OldEvents).expect("cleanup should succeed");

        assert_eq!(result.deleted_file_count, 1);
        assert_eq!(result.kept_file_count, 1);
        assert!(!root.join("events").join("old.json").exists());
        assert!(root.join("events").join("recent.json").exists());
        assert!(root.join("events").join("old-dir").exists());

        fs::remove_dir_all(root).expect("temp root should be removable");
    }

    #[test]
    fn old_event_symlinks_are_not_cleanable_files() {
        let root = temp_root("event-symlink");
        let target = root.join("target.json");
        let link = root.join("events").join("linked.json");
        write_file(&target, "old target");
        fs::create_dir_all(root.join("events")).expect("event directory should be created");
        if !create_file_symlink(&target, &link) {
            fs::remove_dir_all(root).expect("temp root should be removable");
            return;
        }
        make_file_old(&target, 15);

        let result =
            clean_from_root(&root, StorageCleanKind::OldEvents).expect("cleanup should succeed");

        assert_eq!(result.deleted_file_count, 0);
        assert!(link.exists());
        assert!(target.exists());

        fs::remove_dir_all(root).expect("temp root should be removable");
    }

    #[test]
    fn pets_are_counted_but_never_cleanable() {
        let root = temp_root("pets");
        write_file(
            &root.join("pets").join("sprout").join("manifest.json"),
            "{}",
        );
        write_file(
            &root.join("pets").join("sprout").join("sprites.png"),
            "sprites",
        );

        let summary = summarize_from_root(&root).expect("storage summary should succeed");
        let result =
            clean_from_root(&root, StorageCleanKind::SafeSessions).expect("cleanup should succeed");

        assert_eq!(summary.pets.file_count, 2);
        assert_eq!(summary.pets.directory_count, 1);
        assert_eq!(summary.pets.total_bytes, 9);
        assert_eq!(summary.pets.cleanable_file_count, 0);
        assert_eq!(summary.pets.cleanable_bytes, 0);
        assert_eq!(result.deleted_file_count, 0);
        assert!(root
            .join("pets")
            .join("sprout")
            .join("manifest.json")
            .exists());
        assert!(root
            .join("pets")
            .join("sprout")
            .join("sprites.png")
            .exists());

        fs::remove_dir_all(root).expect("temp root should be removable");
    }

    #[cfg(windows)]
    fn create_file_symlink(target: &Path, link: &Path) -> bool {
        std::os::windows::fs::symlink_file(target, link).is_ok()
    }

    #[cfg(unix)]
    fn create_file_symlink(target: &Path, link: &Path) -> bool {
        std::os::unix::fs::symlink(target, link).is_ok()
    }
}
