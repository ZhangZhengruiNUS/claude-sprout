# Pet Message and Board Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the user-facing pet assistant modes to Message/Board and make Message mode low-frequency but rich enough to identify the session, current context, and required user action.

**Architecture:** Keep the persisted `petDisplayMode` values as `minimal` and `activity` for compatibility, but change user-facing language and behavior. The view model owns interruption policy and message content; the React components only render the richer message shape; settings/menu/i18n own visible naming.

**Tech Stack:** React, TypeScript, Vitest, react-dom server rendering tests, i18next resources, existing Tauri settings schema.

---

## File Structure

- Modify `src/pet/petAssistantViewModel.ts`: interruption policy, richer `PetAssistantMessage`, message persistence, shared safe metadata helpers.
- Modify `src/pet/petAssistantViewModel.test.ts`: TDD coverage for Message mode semantics and Board mode `waiting_input` behavior.
- Modify `src/pet/FloatingPetAssistant.tsx`: render message meta line.
- Modify `src/pet/FloatingPetAssistant.test.tsx`: render regression for message meta.
- Modify `src/pet/petDisplayModeMenu.ts`: user-facing menu label/title changes.
- Modify `src/pet/petDisplayModeMenu.test.ts`: Message/Board expectations.
- Modify `src/i18n/resources.ts`: English and Simplified Chinese strings for Message/Board and weak `waiting_input` wording.
- Modify `src/settings/SettingsPanel.tsx`: no structure change expected; it should pick up i18n key changes.
- Modify `src/styles/app.css`: message meta styling and message card height/line clamp if needed.
- Modify `docs/devlog.md`, `docs/handoff-state.json`, regenerate `docs/next-session.md` after implementation.

---

### Task 1: View Model Message Policy And Rich Context

**Files:**
- Modify: `src/pet/petAssistantViewModel.test.ts`
- Modify: `src/pet/petAssistantViewModel.ts`

- [x] **Step 1: Write failing tests for Message mode semantics**

Replace the existing test named `keeps permission intervention messages persistent and idle prompt messages weak` in `src/pet/petAssistantViewModel.test.ts` with:

```ts
  it('only creates message cards for permission, completion, and failure states', () => {
    const waiting = session('waiting', 'waiting_input')
    const permission = session('permission', 'waiting_permission', undefined, {
      display_name: 'Release publish',
      last_tool: 'Bash',
      context_used_percentage: 18,
    })
    const done = session('done', 'done', undefined, {
      display_name: 'Docs cleanup',
      conversation_preview: 'Claude: Updated the release checklist',
      context_used_percentage: 42,
    })
    const error = session('error', 'error', undefined, {
      project_name: 'claude-sprout',
      last_tool: 'Edit',
      context_used_percentage: 64,
    })
    const view = buildPetAssistantView({
      sessions: [waiting, permission, done, error],
      displayMode: 'minimal',
      visibleCount: 3,
      conversationPreviewEnabled: true,
    })

    expect(view.actionableCount).toBe(1)
    expect(view.messages.map((message) => message.sessionId)).toEqual([
      'permission',
      'error',
      'done',
    ])
    expect(view.messages).toContainEqual(
      expect.objectContaining({
        key: petAssistantMessageKey(permission),
        title: 'Release publish needs permission',
        detail: 'Needs permission for Bash',
        meta: 'project-permission - permiss - 18% ctx',
        tone: 'intervention',
        persistent: true,
      }),
    )
    expect(view.messages).toContainEqual(
      expect.objectContaining({
        key: petAssistantMessageKey(error),
        title: 'claude-sprout - error failed',
        detail: 'Failed around Edit',
        meta: 'error - 64% ctx',
        tone: 'failed',
        persistent: true,
      }),
    )
    expect(view.messages).toContainEqual(
      expect.objectContaining({
        key: petAssistantMessageKey(done),
        title: 'Docs cleanup finished',
        detail: 'Claude: Updated the release checklist',
        meta: 'project-done - done - 42% ctx',
        tone: 'complete',
        persistent: false,
      }),
    )
  })
```

Add a second test after `shows conversation preview only when the setting is enabled`:

```ts
  it('keeps message cards metadata-only when conversation preview is disabled', () => {
    const done = session('done', 'done', undefined, {
      display_name: 'Feature branch',
      conversation_preview: 'Claude: Secret-looking transcript text should stay hidden',
      last_tool: 'Write',
    })

    const view = buildPetAssistantView({
      sessions: [done],
      displayMode: 'minimal',
      visibleCount: 3,
      conversationPreviewEnabled: false,
    })

    expect(view.messages[0]).toEqual(
      expect.objectContaining({
        title: 'Feature branch finished',
        detail: 'Completed',
        meta: 'project-done - done',
      }),
    )
    expect(view.messages[0].detail).not.toContain('Secret-looking')
  })
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- --run src/pet/petAssistantViewModel.test.ts
```

Expected: FAIL because `waiting_input` still creates a message, `PetAssistantMessage` has no `meta`, error messages are not persistent, and message details do not reuse Board context.

- [x] **Step 3: Implement the minimal view model changes**

In `src/pet/petAssistantViewModel.ts`:

Change the message type to include meta:

```ts
export type PetAssistantMessage = {
  key: string
  sessionId: string
  title: string
  detail: string
  meta: string
  tone: PetAssistantMessageTone
  persistent: boolean
  updatedAt: string
}
```

Change message-triggering statuses:

```ts
const MESSAGE_STATUSES = new Set<SessionStatus>([
  'waiting_permission',
  'done',
  'error',
])
```

Pass preview setting into message creation:

```ts
      .map((session) =>
        messageForSession(session, completionToastSeconds, conversationPreviewEnabled, translate),
      )
```

Change persistence:

```ts
export function isPersistentPetMessage(status: SessionStatus, completionToastSeconds = 5) {
  return INTERVENTION_STATUSES.has(status) || status === 'error' || completionToastSeconds <= 0
}
```

Replace `messageForSession`, `messageTitle`, and `sessionMessageDetail` with:

```ts
function messageForSession(
  session: SessionSnapshot,
  completionToastSeconds: number,
  conversationPreviewEnabled: boolean,
  translate: Translate,
): PetAssistantMessage {
  const tone = messageTone(session.status)

  return {
    key: petAssistantMessageKey(session),
    sessionId: session.session_id,
    title: messageTitle(session, translate),
    detail: sessionActivityDetail(session, conversationPreviewEnabled, translate),
    meta: sessionActivityMeta(session, translate),
    tone,
    persistent: isPersistentPetMessage(session.status, completionToastSeconds),
    updatedAt: session.updated_at,
  }
}

function messageTitle(session: SessionSnapshot, translate: Translate) {
  const subject = activityTitle(session, translate)
  switch (session.status) {
    case 'waiting_permission':
      return translate('petAssistant.title.waiting_permission', { project: subject })
    case 'done':
      return translate('petAssistant.title.done', { project: subject })
    case 'error':
      return translate('petAssistant.title.error', { project: subject })
    default:
      return subject
  }
}
```

Delete the now-unused `sessionMessageDetail` function.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- --run src/pet/petAssistantViewModel.test.ts
```

Expected: PASS.

---

### Task 2: Message Card Rendering

**Files:**
- Modify: `src/pet/FloatingPetAssistant.test.tsx`
- Modify: `src/pet/FloatingPetAssistant.tsx`
- Modify: `src/styles/app.css`

- [x] **Step 1: Write failing render test for message meta**

Add this test to `src/pet/FloatingPetAssistant.test.tsx`:

```tsx
  it('renders rich context on Message mode cards', () => {
    const html = renderToStaticMarkup(
      <FloatingPetAssistant
        view={{
          ...baseView,
          displayMode: 'minimal',
          messages: [
            {
              key: 'release:done:2026-05-23T00:00:00Z',
              sessionId: 'release',
              title: 'Release publish finished',
              detail: 'Claude: Built the release checklist',
              meta: 'claude-sprout - releas - 42% ctx',
              tone: 'complete',
              persistent: false,
              updatedAt: '2026-05-23T00:00:00Z',
            },
          ],
        }}
        activityPage={0}
        onActivityPageChange={vi.fn()}
        onAcknowledgeMessage={vi.fn()}
        onOpenPanel={vi.fn()}
      />,
    )

    expect(html).toContain('Release publish finished')
    expect(html).toContain('Claude: Built the release checklist')
    expect(html).toContain('claude-sprout - releas - 42% ctx')
  })
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- --run src/pet/FloatingPetAssistant.test.tsx
```

Expected: FAIL because `PetMessageCard` does not render `message.meta`.

- [x] **Step 3: Render message meta**

In `src/pet/FloatingPetAssistant.tsx`, update `PetMessageCard`:

```tsx
      <div>
        <strong>{message.title}</strong>
        <small>{message.detail}</small>
        <em>{message.meta}</em>
      </div>
```

In `src/styles/app.css`, include message meta in the shared `em` styling:

```css
.pet-message-card em,
.pet-activity-card em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.12rem;
  color: rgba(223, 231, 236, 0.52);
  font-size: 0.54rem;
  font-style: normal;
  line-height: 1.1;
}
```

Increase message-card minimum height slightly:

```css
.pet-message-card {
  min-height: 3.35rem;
}
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- --run src/pet/FloatingPetAssistant.test.tsx
```

Expected: PASS.

---

### Task 3: User-Facing Message/Board Naming

**Files:**
- Modify: `src/pet/petDisplayModeMenu.test.ts`
- Modify: `src/pet/petDisplayModeMenu.ts`
- Modify: `src/i18n/resources.ts`

- [x] **Step 1: Write failing menu tests**

In `src/pet/petDisplayModeMenu.test.ts`, update expectations:

```ts
  it('labels the menu with the mode it will switch to', () => {
    expect(petDisplayModeMenuLabel('minimal')).toBe('Board')
    expect(petDisplayModeMenuLabel('activity')).toBe('Message')
  })

  it('describes the mode switch in the button title', () => {
    expect(petDisplayModeMenuTitle('minimal')).toBe('Switch to Board mode')
    expect(petDisplayModeMenuTitle('activity')).toBe('Switch to Message mode')
  })
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- --run src/pet/petDisplayModeMenu.test.ts
```

Expected: FAIL because labels still say Minimal/Activity.

- [x] **Step 3: Update menu helper labels**

In `src/pet/petDisplayModeMenu.ts`:

```ts
export function petDisplayModeMenuLabel(currentMode: PetDisplayMode) {
  return currentMode === 'activity' ? 'Message' : 'Board'
}
```

`petDisplayModeMenuTitle` can keep using this helper.

- [x] **Step 4: Update i18n resources**

In `src/i18n/resources.ts`, update English settings/menu text:

```ts
petInformationMode: 'Pet mode',
petInformationModeDescription: 'Message mode only interrupts for permission, completion, and failure. Board mode keeps a session stack visible.',
minimal: 'Message',
activity: 'Board',
completionMessage: 'Completion message',
completionMessageDescription: 'Seconds to show finished-task cards in Message mode. Use 0 to keep them until acknowledged.',
activityRows: 'Board rows',
activityRowsDescription: 'Number of open sessions shown before pager controls appear.',
activityWidth: 'Board width',
activityWidthDescription: 'Wider Board cards can show longer conversation previews.',
messageOpacityDescription: 'Adjust the glass background opacity for pet message and board cards.',
readConversationPreviewDescription: 'Allow Message and Board cards to show short transcript snippets. Leave off for metadata-only cards.',
switchToActivity: 'Switch to Board mode',
switchToMinimal: 'Switch to Message mode',
activity: 'Board',
minimal: 'Message',
activeSessions: 'Open sessions',
```

Also change English `petAssistant.activity.waitingInput`:

```ts
waitingInput: 'May be waiting for a reply',
```

Update the Simplified Chinese equivalents:

```ts
petInformationMode: '宠物模式',
petInformationModeDescription: '消息模式只在授权、完成、失败时介入；看板模式会长期显示会话堆栈。',
minimal: '消息',
activity: '看板',
completionMessage: '完成消息',
completionMessageDescription: '消息模式中已完成任务卡片显示秒数。设为 0 表示保留到手动确认。',
activityRows: '看板行数',
activityRowsDescription: '出现翻页控件前显示的开放会话数量。',
activityWidth: '看板宽度',
activityWidthDescription: '更宽的看板卡片可以显示更长的对话预览。',
messageOpacityDescription: '调整宠物消息和看板卡片的玻璃背景透明度。',
readConversationPreviewDescription: '允许消息和看板卡片显示短 transcript 片段。关闭时只显示元数据。',
switchToActivity: '切换到看板模式',
switchToMinimal: '切换到消息模式',
activity: '看板',
minimal: '消息',
activeSessions: '开放会话',
waitingInput: '可能在等待回复',
```

- [x] **Step 5: Run focused menu test and view model test**

Run:

```powershell
npm test -- --run src/pet/petDisplayModeMenu.test.ts src/pet/petAssistantViewModel.test.ts
```

Expected: PASS.

---

### Task 4: Verification, Browser QA, Handoff, Commit

**Files:**
- Modify: `docs/devlog.md`
- Modify: `docs/handoff-state.json`
- Regenerate: `docs/next-session.md`

- [x] **Step 1: Run frontend test suite**

Run:

```powershell
npm test -- --run
```

Expected: PASS.

- [x] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [x] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [x] **Step 4: Run browser QA for pet route**

Start dev server:

```powershell
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/?window=pet
```

Use Playwright to confirm:

- Message mode cards show title, detail, and meta without text overlap.
- Board mode at 300px width still keeps pet and card stack separated.
- English Message/Board labels appear in Settings/pet menu fixture.

- [x] **Step 5: Optional desktop smoke with controlled snapshots**

If the frontend validation is green, run:

```powershell
npm run tauri -- build --no-bundle
```

Then use a temporary `CLAUDE_SPROUT_HOME` and controlled session JSON transitions to verify:

- `running -> waiting_permission` shows a system notification and Message card.
- `running -> done` shows a Message card.
- `running -> error` shows a persistent Message card.
- `running -> waiting_input` does not show a system notification or Message card but appears in Board/Session Panel.

- [x] **Step 6: Update handoff state and devlog**

In `docs/devlog.md`, add a 2026-05-23 bullet:

```md
- Implemented the pet Message/Board mode redesign:
  - user-facing Minimal/Activity labels now read Message/Board while persisted settings remain compatible.
  - Message mode now interrupts only for permission, completion, and failure, with richer session identity, status detail, and metadata.
  - `waiting_input` no longer creates Message cards and remains a weak Board/Session Panel state.
```

In `docs/handoff-state.json`, update `implemented` and remove the completed next task from the top of `nextTasks`.

Run:

```powershell
npm run handoff:update
```

- [x] **Step 7: Final git check, commit, and push**

Run:

```powershell
git status --short --branch
git diff --stat
```

Then commit:

```powershell
git add src docs
git commit -m "feat: refine pet message and board modes"
git push origin codex/pet-assistant-modes
```

Expected: branch pushed successfully.

---

## Self-Review

- Spec coverage: mode naming, Message interruption policy, rich message context, Board persistence, `waiting_input` weak behavior, opt-in conversation preview, tests, browser QA, and handoff are all covered.
- Placeholder scan: this plan uses explicit test snippets, implementation snippets, commands, and expected outcomes.
- Type consistency: `PetAssistantMessage.meta` is added in the view model and rendered by `FloatingPetAssistant`; persisted `PetDisplayMode` remains `minimal | activity` for compatibility.
