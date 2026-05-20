#[allow(dead_code)]
pub fn notification_title_for_status(status: &str) -> &'static str {
    match status {
        "waiting_permission" => "Claude Code needs permission",
        "waiting_input" => "Claude Code is waiting for input",
        "done" => "Claude Code task finished",
        "error" => "Claude Code task failed",
        _ => "Claude Sprout",
    }
}
