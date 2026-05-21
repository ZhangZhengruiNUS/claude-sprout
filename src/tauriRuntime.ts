export function isTauriRuntime() {
  return Boolean(
    (globalThis as { isTauri?: unknown }).isTauri ||
      (globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  )
}
