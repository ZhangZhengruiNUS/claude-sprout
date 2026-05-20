# Storage Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the conservative `Settings -> Storage` cleanup slice for local Claude Sprout data.

**Architecture:** Rust owns filesystem inspection and deletion under `CLAUDE_SPROUT_HOME` / `%USERPROFILE%\.claude-sprout`; React owns presentation, confirmation, and refresh orchestration. The UI stays inside Settings so the Session Panel remains focused on live Claude Code state.

**Tech Stack:** Tauri v2, Rust, React, TypeScript, Vitest, existing CSS.

---

## File Structure

- Create `src-tauri/src/storage_cleanup.rs`: storage summaries, safe session classification, old-event classification, and delete operations.
- Modify `src-tauri/src/commands.rs`: add `get_storage_summary` and `clean_storage` commands.
- Modify `src-tauri/src/lib.rs`: register `storage_cleanup` module and commands.
- Create `src/storage/storageApi.ts`: typed Tauri invoke wrapper with non-Tauri empty fallback.
- Create `src/storage/storageApi.test.ts`: invoke contract tests.
- Create `src/storage/StoragePanel.tsx`: Settings Storage UI.
- Modify `src/settings/SettingsPanel.tsx`: render `StoragePanel` and pass callbacks.
- Modify `src/App.tsx`: hold storage state, load summaries, call cleanup, refresh sessions after session cleanup.
- Modify `src/styles/app.css`: compact Storage layout styles.
- Modify `docs/devlog.md`, `docs/handoff-state.json`, regenerate `docs/next-session.md`.

## Task 1: Rust Storage Summary and Cleanup

**Files:**
- Create: `src-tauri/src/storage_cleanup.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests**

Add tests in `src-tauri/src/storage_cleanup.rs` that create a temp root with:

```rust
#[test]
fn summarizes_storage_buckets() {
    let root = temp_root("summary");
    fs::create_dir_all(root.join("sessions")).unwrap();
    fs::create_dir_all(root.join("events")).unwrap();
    fs::create_dir_all(root.join("pets").join("sprout")).unwrap();
    fs::write(root.join("sessions").join("done.json"), session_json("done", None)).unwrap();
    fs::write(root.join("events").join("recent.json"), "event").unwrap();
    fs::write(root.join("pets").join("sprout").join("manifest.json"), "{}").unwrap();

    let summary = summarize_from_root(&root).unwrap();

    assert_eq!(summary.sessions.file_count, 1);
    assert_eq!(summary.sessions.cleanable_file_count, 1);
    assert_eq!(summary.events.file_count, 1);
    assert_eq!(summary.pets.directory_count, 1);
    assert_eq!(summary.pets.cleanable_file_count, 0);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn cleans_only_safe_sessions() {
    let root = temp_root("sessions");
    fs::create_dir_all(root.join("sessions")).unwrap();
    fs::write(root.join("sessions").join("done.json"), session_json("done", None)).unwrap();
    fs::write(root.join("sessions").join("running.json"), session_json("running", None)).unwrap();
    fs::write(root.join("sessions").join("broken.json"), "{").unwrap();

    let result = clean_from_root(&root, StorageCleanKind::SafeSessions).unwrap();

    assert_eq!(result.deleted_file_count, 1);
    assert!(!root.join("sessions").join("done.json").exists());
    assert!(root.join("sessions").join("running.json").exists());
    assert!(root.join("sessions").join("broken.json").exists());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn cleans_only_old_event_files() {
    let root = temp_root("events");
    fs::create_dir_all(root.join("events")).unwrap();
    fs::write(root.join("events").join("old.json"), "old").unwrap();
    fs::write(root.join("events").join("recent.json"), "recent").unwrap();
    make_file_old(root.join("events").join("old.json"), 15);

    let result = clean_from_root(&root, StorageCleanKind::OldEvents).unwrap();

    assert_eq!(result.deleted_file_count, 1);
    assert!(!root.join("events").join("old.json").exists());
    assert!(root.join("events").join("recent.json").exists());
    fs::remove_dir_all(root).unwrap();
}
```

- [ ] **Step 2: Run Rust test and verify RED**

Run: `cargo test --manifest-path src-tauri\Cargo.toml storage_cleanup`

Expected: FAIL because `storage_cleanup` module, types, and helper functions do not exist.

- [ ] **Step 3: Implement Rust module**

Implement:

```rust
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
```

Use `session_store::ensure_layout()` for public commands, and root-taking helper functions for tests. Safe sessions are parsed `SessionSnapshot`s whose raw status is `Done`, `Error`, `Closed`, or `ProbablyClosed`; raw running/waiting/idle/stale files stay untouched even when their old heartbeat would be displayed as `ProbablyClosed` elsewhere. Events are cleanable when regular files have modified time older than 14 days. Pets are counted recursively but never cleanable.

- [ ] **Step 4: Wire commands**

In `commands.rs`, add:

```rust
#[tauri::command]
pub fn get_storage_summary() -> Result<storage_cleanup::StorageSummary, String> {
    storage_cleanup::summarize()
}

#[tauri::command]
pub fn clean_storage(
    kind: storage_cleanup::StorageCleanKind,
) -> Result<storage_cleanup::StorageCleanResult, String> {
    storage_cleanup::clean(kind)
}
```

Register the module and commands in `lib.rs`.

- [ ] **Step 5: Verify Rust GREEN**

Run: `cargo test --manifest-path src-tauri\Cargo.toml storage_cleanup`

Expected: PASS.

## Task 2: Frontend Storage API and Panel

**Files:**
- Create: `src/storage/storageApi.ts`
- Create: `src/storage/storageApi.test.ts`
- Create: `src/storage/StoragePanel.tsx`
- Modify: `src/settings/SettingsPanel.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Write failing frontend API tests**

Create `src/storage/storageApi.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanStorage, getStorageSummary } from './storageApi'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

function setTauriRuntime(enabled: boolean) {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis })
  if (enabled) {
    Object.defineProperty(globalThis, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    return
  }
  Reflect.deleteProperty(globalThis, '__TAURI_INTERNALS__')
}

describe('storage api', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    setTauriRuntime(true)
  })

  it('loads storage summary from Tauri', async () => {
    invokeMock.mockResolvedValueOnce({ rootPath: 'C:/data', sessions: {}, events: {}, pets: {} })

    await getStorageSummary()

    expect(invokeMock).toHaveBeenCalledWith('get_storage_summary')
  })

  it('cleans selected storage kind through Tauri', async () => {
    invokeMock.mockResolvedValueOnce({ deletedFileCount: 2, deletedBytes: 100, keptFileCount: 1 })

    await cleanStorage('safe_sessions')

    expect(invokeMock).toHaveBeenCalledWith('clean_storage', { kind: 'safe_sessions' })
  })
})
```

- [ ] **Step 2: Run API test and verify RED**

Run: `npm test -- src/storage/storageApi.test.ts`

Expected: FAIL because `src/storage/storageApi.ts` does not exist.

- [ ] **Step 3: Implement storage API**

Create typed API:

```ts
export type StorageCleanKind = 'safe_sessions' | 'old_events'
export type StorageBucketSummary = {
  fileCount: number
  directoryCount: number
  totalBytes: number
  cleanableFileCount: number
  cleanableBytes: number
}
export type StorageSummary = {
  rootPath: string
  sessions: StorageBucketSummary
  events: StorageBucketSummary
  pets: StorageBucketSummary
}
export type StorageCleanResult = {
  deletedFileCount: number
  deletedBytes: number
  keptFileCount: number
}
```

Non-Tauri fallback returns zero summary and no-op clean result.

- [ ] **Step 4: Implement StoragePanel**

`StoragePanel` props:

```ts
type Props = {
  summary: StorageSummary | null
  isLoading: boolean
  isCleaning: boolean
  message: string | null
  onRefresh: () => void
  onClean: (kind: StorageCleanKind) => void
  onOpenDataFolder: () => void
}
```

Render rows for Sessions, Events, and Imported pets. Disable clean buttons when `cleanableFileCount` is `0` or cleaning is active. Use `formatBytes()` to show `B`, `KB`, and `MB`.

- [ ] **Step 5: Connect SettingsPanel**

Import `StoragePanel` into `SettingsPanel.tsx`, add props, and render it after pet import content.

- [ ] **Step 6: Verify frontend GREEN**

Run: `npm test -- src/storage/storageApi.test.ts`

Expected: PASS.

## Task 3: App Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/settings/SettingsPanel.tsx` if needed after Task 2

- [ ] **Step 1: Add storage state and loaders**

In `App.tsx`, import:

```ts
import {
  cleanStorage,
  getStorageSummary,
  type StorageCleanKind,
  type StorageSummary,
} from './storage/storageApi'
```

Add state:

```ts
const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null)
const [isStorageLoading, setIsStorageLoading] = useState(false)
const [isStorageCleaning, setIsStorageCleaning] = useState(false)
const [storageMessage, setStorageMessage] = useState<string | null>(null)
```

- [ ] **Step 2: Load storage when Settings is active**

Use an effect keyed on `activeTab`:

```ts
useEffect(() => {
  if (windowKind !== 'panel' || activeTab !== 'settings') return
  void loadStorageSummary()
}, [activeTab, windowKind])
```

- [ ] **Step 3: Implement cleanup action**

`handleCleanStorage(kind)` should confirm with specific counts, call `cleanStorage(kind)`, set a success message, reload summary, and call `load({ showLoading: false })` after `safe_sessions`.

- [ ] **Step 4: Pass props into SettingsPanel**

Add props:

```tsx
storageSummary={storageSummary}
isStorageLoading={isStorageLoading}
isStorageCleaning={isStorageCleaning}
storageMessage={storageMessage}
onRefreshStorage={() => void loadStorageSummary()}
onCleanStorage={(kind) => void handleCleanStorage(kind)}
onOpenDataFolder={() => void openDataFolder()}
```

Use existing `open_data_folder` through a small frontend API if one does not already exist.

- [ ] **Step 5: Verify integration**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: all pass.

## Task 4: Documentation and Final Verification

**Files:**
- Modify: `docs/devlog.md`
- Modify: `docs/handoff-state.json`
- Modify generated: `docs/next-session.md`

- [ ] **Step 1: Update project records**

Record that Settings Storage cleanup is implemented, including safe session cleanup, old event cleanup, and pets counted only.

- [ ] **Step 2: Regenerate handoff**

Run: `npm run handoff:update`

Expected: `docs/next-session.md` reflects the current commit context and new implementation state.

- [ ] **Step 3: Full verification**

Run:

```powershell
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri\Cargo.toml
```

Expected: all pass. If frontend or Tauri runtime behavior changed materially, also run `npm run release:exe`.

- [ ] **Step 4: Commit and push**

Commit all implementation and doc changes:

```powershell
git add .
git commit -m "feat: add storage cleanup panel"
git push origin main
```

---

## Self-Review

- Spec coverage: Settings entry, summaries, safe session cleanup, old event cleanup, pets counted only, confirmations, and test coverage are represented.
- Placeholder scan: no TBD/TODO/fill-in instructions.
- Type consistency: Rust uses camelCase serialization for frontend fields; clean kind uses snake_case strings.
- Scope: WiX/MSI and pet deletion remain out of scope.
