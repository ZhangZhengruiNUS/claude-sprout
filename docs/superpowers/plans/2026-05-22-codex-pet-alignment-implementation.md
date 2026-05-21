# Codex Pet Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claude Sprout render imported Codex-compatible pets with the same atlas geometry, row semantics, frame counts, and state mapping used by Codex/Hatch Pet.

**Architecture:** Keep atlas metadata in `src/pet/atlasProfiles/codex8x9.ts`, business status mapping in `src/pet/petStateMapper.ts`, and rendering in `src/pet/PetRenderer.tsx`. Mirror the corrected atlas geometry in Rust import metadata and update docs/handoff after verification.

**Tech Stack:** Tauri v2, React, TypeScript, Vitest, Rust.

---

### Task 1: Codex Atlas Contract Tests

**Files:**
- Create: `src/pet/atlasProfiles/codex8x9.test.ts`
- Modify: `src/pet/atlasProfiles/codex8x9.ts`
- Modify: `src-tauri/src/pet_import/atlas_profile.rs`

- [ ] Add a Vitest test asserting `codexAtlasProfile.cols === 8`, `rows === 9`, `frameWidth === 192`, `frameHeight === 208`, and every Codex row animation has the expected row, frame count, mode, and duration.
- [ ] Run `npm test -- src/pet/atlasProfiles/codex8x9.test.ts` and confirm it fails against the current 8-row/9-column profile.
- [ ] Update the TypeScript profile to the Codex contract.
- [ ] Add or update Rust unit coverage for `codex_8x9_profile()`.
- [ ] Run the focused TypeScript test and `cargo test --manifest-path src-tauri\Cargo.toml atlas_profile`.

### Task 2: Status Mapping Tests

**Files:**
- Create: `src/pet/petStateMapper.test.ts`
- Modify: `src/pet/petStateMapper.ts`
- Modify: `src/pet/petAnimation.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/settings/SettingsPanel.tsx` if action names require updates

- [ ] Add tests that map `running/tool_running` to `running`, `waiting_permission/waiting_input` to `waiting`, `done` to `review`, `error` to `failed`, and quiet/closed statuses to `idle`.
- [ ] Run `npm test -- src/pet/petStateMapper.test.ts` and confirm it fails against the current `run/wave/jump` mapping.
- [ ] Rename `PetAnimation` values to Codex row names while preserving explicit action support for `waving` and `jumping`.
- [ ] Update call sites and existing animation key tests.
- [ ] Run focused pet tests.

### Task 3: Docs, Handoff, and Verification

**Files:**
- Modify: `docs/codex-pet-importer.md`
- Modify: `docs/handoff-state.json`
- Modify: `docs/next-session.md`
- Modify: `docs/devlog.md`

- [ ] Document the true 8x9 Codex atlas contract and row semantics.
- [ ] Update handoff state with the completed alignment and remaining drag-direction follow-up.
- [ ] Run `npm run handoff:update`.
- [ ] Run `npm run lint`, `npm run build`, and `cargo test --manifest-path src-tauri\Cargo.toml`.
- [ ] Commit and push the branch.
