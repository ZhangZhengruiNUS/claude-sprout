use crate::session_store;
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter};

const SESSION_CHANGED_EVENT: &str = "agent-desktop-companion://sessions-changed";
const POLL_INTERVAL: Duration = Duration::from_secs(2);

pub fn start(app: AppHandle) {
    thread::spawn(move || {
        let mut last_fingerprint = session_store::session_dir_fingerprint().unwrap_or_default();

        loop {
            thread::sleep(POLL_INTERVAL);

            let Ok(next_fingerprint) = session_store::session_dir_fingerprint() else {
                continue;
            };

            if next_fingerprint == last_fingerprint {
                continue;
            }

            last_fingerprint = next_fingerprint;
            let _ = app.emit(SESSION_CHANGED_EVENT, ());
        }
    });
}
