# Claude Sprout 本地存储清理设计

## 背景

Claude Sprout 已经具备宠物窗口、Session Panel、通知、托盘菜单、Codex 宠物导入和 release smoke 工具。当前本地数据都放在 `%USERPROFILE%\.claude-sprout` 或测试时的 `CLAUDE_SPROUT_HOME` 下，主要包括 `sessions/`、`events/`、`pets/`。下一步需要让用户能看见这些数据的规模，并执行低风险清理。

这个功能必须保持 pet-first 产品形态：宠物窗口仍是主入口，Session Panel 继续专注于 Claude Code 会话状态，维护性动作放在 Settings 中。

## 目标

- 在 Settings 中新增 `Storage` 区块，展示本地数据概览。
- 统计 `sessions/`、`events/`、`pets/` 的文件数、目录数和总大小。
- 提供两个保守清理动作：
  - 清理安全会话文件。
  - 清理过期事件文件。
- 清理前展示预计删除数量和大小，并要求用户确认。
- 不在首版删除 imported pets，只展示占用并保留打开数据目录入口。

## 非目标

- 不做自动定时清理。
- 不删除当前正在运行、等待输入、等待权限或正在调用工具的 session。
- 不删除当前 active pet，也不删除任何 imported pet 文件夹。
- 不新增独立 Storage 页面，不把 Session Panel 改成管理后台。
- 不处理 WiX/MSI 下载证书问题。

## 用户界面

入口放在 Settings 底部，标题为 `Storage`。内容由三行摘要和一组动作组成：

- `Sessions`：显示总 session 文件数、可清理文件数和总大小。
- `Events`：显示总 event 文件数、过期文件数和总大小。
- `Imported pets`：显示宠物目录数和总大小，只读展示。

动作按钮：

- `Refresh storage`：重新读取统计。
- `Clean safe sessions`：只清理安全会话。
- `Clean old events`：只清理过期事件。
- `Open data folder`：复用现有打开数据目录能力。

确认文案应明确删除范围，例如：

`Clean 8 safe session files and free 420 KB? Running and waiting sessions will be kept.`

如果没有可清理项，清理按钮禁用并显示零值，不弹确认。

## 安全规则

安全 session 的定义：

- JSON 可以被解析为 `SessionSnapshot`，并且原始状态为 `done` / `error` / `closed` / `probably_closed`。
- JSON 无法解析时不删除，避免误删格式变化或损坏但仍有诊断价值的文件。
- 状态为 `running`、`tool_running`、`waiting_input`、`waiting_permission`、`idle`、`stale` 的 session 不删除。

过期 event 的定义：

- 位于 `events/` 下的普通文件。
- 文件修改时间早于 14 天。
- 目录、非普通文件、无法读取元数据的条目不删除。

Pets 首版只统计：

- `pets/` 下目录数量。
- 所有普通文件总大小。
- 不提供删除动作。

## Rust API 设计

新增存储模块，建议放在 `src-tauri/src/storage_cleanup.rs`，避免继续扩大 `session_store.rs`。

新增数据类型：

- `StorageSummary`
  - `root_path`
  - `sessions`
  - `events`
  - `pets`
- `StorageBucketSummary`
  - `file_count`
  - `directory_count`
  - `total_bytes`
  - `cleanable_file_count`
  - `cleanable_bytes`
- `StorageCleanKind`
  - `safe_sessions`
  - `old_events`
- `StorageCleanResult`
  - `deleted_file_count`
  - `deleted_bytes`
  - `kept_file_count`

新增 Tauri commands：

- `get_storage_summary() -> Result<StorageSummary, String>`
- `clean_storage(kind: StorageCleanKind) -> Result<StorageCleanResult, String>`

`clean_storage` 完成后不直接负责前端状态刷新；前端在成功后重新调用 `get_storage_summary()`，并在清理 sessions 后刷新 session 列表。

## 前端设计

新增前端 API 文件：

- `src/storage/storageApi.ts`

新增组件：

- `src/storage/StoragePanel.tsx`

SettingsPanel 接收 storage 相关 props 或由 App 统一加载后传入。为保持现有 App 数据流简单，首版由 `App.tsx` 持有：

- `storageSummary`
- `isStorageLoading`
- `storageMessage`

Settings tab 打开时和用户点击 `Refresh storage` 时加载统计。清理动作使用 `window.confirm`，确认后调用 API，再刷新 storage 和 sessions。

## 错误处理

- 统计失败：在 Storage 区块内显示错误，不影响其他 Settings。
- 清理失败：保留当前统计并显示错误。
- 清理中按钮禁用，避免重复删除。
- 如果数据目录不存在，Rust 通过现有 `ensure_layout()` 创建空目录并返回零值统计。

## 测试计划

Rust 单测：

- 统计 sessions/events/pets 的文件数、目录数和字节数。
- 安全 session 清理只删除原始状态为 `done` / `error` / `closed` / `probably_closed` 的文件，保留 running/waiting/idle/stale，即使这些活动态因为心跳过旧会被列表派生为 `probably_closed`。
- 无法解析的 session JSON 不删除。
- event 清理只删除修改时间超过 14 天的普通文件。
- pets 只统计不删除。

前端单测：

- `storageApi.ts` 调用正确的 Tauri command 和参数。
- StoragePanel 在有可清理项时启用按钮，无可清理项时禁用。
- 清理动作确认后调用对应 API。

验证命令：

```powershell
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri\Cargo.toml
```

如果改动影响 release exe 行为，再补跑：

```powershell
npm run release:exe
```

## 实施顺序

1. Rust：先写 storage cleanup 统计和清理单测。
2. Rust：实现 `storage_cleanup.rs` 和 Tauri commands。
3. Frontend：写 `storageApi.ts` 测试和 API。
4. Frontend：实现 `StoragePanel` 并接入 Settings。
5. App：清理成功后刷新 storage；清理 sessions 后刷新 session list。
6. 文档：更新 `docs/devlog.md`、`docs/handoff-state.json`，再运行 `npm run handoff:update`。

## 自检

- 没有占位项或待定项。
- 清理范围和用户选择的保守方案一致。
- pets 删除明确排除在首版之外。
- 入口固定为 Settings Storage，没有引入 dashboard 式页面。
- Rust、前端和验证路径都有明确边界。
