# Claude Sprout 宠物消息/看板模式设计

## 背景

Claude Sprout 的核心价值不是把 Session Panel 缩小成一个悬浮面板，而是让宠物成为 Claude Code 多会话工作的低噪声入口。当前实现已经有 `minimal` 和 `activity` 两种模式，但命名和行为边界还不够贴近真实使用：

- `minimal` 容易被理解成“信息很少”，但用户真正需要的是“少打扰，只在该介入时出现”。
- `activity` 容易被理解成“动态状态”，但用户真正需要的是“多会话看板，长期展示配置数量内的会话情况”。
- `waiting_input` 的判定在真实 Claude Code 使用中不稳定，常常不像真正需要用户输入，因此不应该触发消息、通知、等待动画或 actionable 计数。

本设计将两种模式重新定义为 `消息模式` 和 `看板模式`。内部设置值可以继续兼容 `minimal` / `activity`，但用户可见概念应更新。

## 目标

- 将“最小/活动”重命名为“消息/看板”，让用户理解模式差异。
- 消息模式保持低打扰，但弹出的消息必须有足够上下文，帮助用户判断是哪一个会话、发生了什么、是否需要介入。
- 看板模式长期显示配置数量内的开放会话，用于扫视多会话状态。
- `waiting_input` 降级为弱状态：不弹消息、不发系统通知、不计入 action、不触发等待动画；只在看板和 Session Panel 中可见。
- 保持 pet-first：不把宠物窗口变成完整 dashboard，Session Panel 仍是 secondary surface。
- 保持隐私边界：对话预览仍必须由 Settings 显式 opt-in 开启。

## 非目标

- 不新增自动审批 Claude Code 权限的能力。
- 不读取完整 prompt、assistant 输出、secret 或项目文件内容。
- 不把消息模式变成长期会话列表。
- 不在首版实现复杂的逐会话规则、静音规则或通知路由。
- 不改变本地数据根目录，仍使用 `%USERPROFILE%\.claude-sprout` 或测试时的 `CLAUDE_SPROUT_HOME`。

## 模式定义

### 消息模式

消息模式是默认的低打扰宠物模式。宠物平时保持小型透明窗口，只展示轻量状态；只有强信号出现时才弹出消息卡。

强信号包括：

- `waiting_permission`：Claude Code 需要用户授权、审批或做选择。
- `done`：任务完成，用户需要知道结果。
- `error`：任务失败，用户需要知道失败位置并决定是否回到会话处理。

弱状态不弹消息：

- `waiting_input`：保留在 Session Panel 和看板模式中，但不作为消息、系统通知或 action。
- `running` / `tool_running` / `idle` / `stale` / `probably_closed` / `closed`：不弹消息。

消息模式的弹卡不是简陋提示，而是“低频富信息提示”。每张卡应回答三个问题：

1. 哪一个会话？
2. 当前发生了什么？
3. 用户要不要介入，或者应该回到哪里看？

### 看板模式

看板模式是长期可见的多会话状态堆栈。它显示配置数量内的开放会话，并提供分页。排序应优先让用户看到最需要处理的会话：

1. `waiting_permission`
2. `error`
3. `tool_running`
4. `running`
5. `done`
6. `waiting_input`
7. `stale`
8. `probably_closed`
9. `idle`

`closed` 不进入看板。

看板模式可以显示 `waiting_input`，但必须表现为弱状态，文案避免制造“必须立刻输入”的错觉。推荐用“可能在等待回复”或“弱等待提醒”类语义，而不是强制性“需要回复”。

## 消息卡信息结构

消息卡复用看板卡的会话识别和上下文生成逻辑，但在视觉上更紧凑。

每张消息卡包含：

- 标题：会话身份 + 状态结论。
  - 优先使用 `display_name`，例如 Claude 会话标题或用户重命名。
  - 没有 `display_name` 时使用 `project_name + short session id`。
- 主描述：需要用户理解的当前情况。
  - `waiting_permission`：说明需要为哪个 tool 或操作授权；没有 tool 时说明需要 Claude Code 授权。
  - `done`：说明任务完成；如果有对话预览，展示完成了什么。
  - `error`：说明失败；如果有 tool，展示失败发生在 tool 附近。
- 辅助信息：项目名、短 session id、上下文百分比、最近事件或最近工具，按可用信息组合。
- 操作：
  - 点击卡片打开 Session Panel。
  - `waiting_permission` 和 `error` 默认保留到用户确认。
  - `done` 按 `petCompletionToastSeconds` 自动消失；值为 `0` 时保留到用户确认。

如果 `petConversationPreviewEnabled` 为 true，消息卡可以使用已有 `conversation_preview` 字段显示一段受限摘要。该摘要必须沿用现有 hook/statusline 限制：只读 transcript 尾部、跳过 `tool_use` / `tool_result`、规范化空白、截断、写入单个 snapshot 字段。消息模式不得绕过该设置直接读取 transcript。

如果 `petConversationPreviewEnabled` 为 false，消息卡仍应显示安全元数据，不能因为没有预览而退化成只有“完成/失败”的泛泛提示。

## HUD 和计数语义

消息模式 HUD 应突出“安静待命”和少量关键计数，而不是成为缩小版看板。

保留的计数：

- running：`running` + `tool_running`
- finished：`done` + `error`
- action：仅 `waiting_permission`

不计入 action：

- `waiting_input`

看板模式 header 显示开放会话总数和分页，不需要重复消息模式的计数语义。

## 文案

用户可见模式名称：

- 英文：`Message` / `Board`
- 中文：`消息` / `看板`

设置说明：

- 消息模式：只在授权、完成、失败时弹出富信息消息；日常保持低打扰。
- 看板模式：长期显示配置数量内的开放会话，用于扫视多会话状态。

右键菜单：

- 当前为消息模式时，菜单项显示“看板” / `Board`，title 为“切换到看板模式” / `Switch to Board mode`。
- 当前为看板模式时，菜单项显示“消息” / `Message`，title 为“切换到消息模式” / `Switch to Message mode`。

## 数据和兼容性

为降低迁移风险，内部 `AppSettings.petDisplayMode` 可继续使用：

- `minimal` 表示消息模式。
- `activity` 表示看板模式。

这避免破坏已持久化的 settings、Rust schema、窗口 sizing、测试 fixture 和旧版本配置。用户可见文案和组件语义更新即可。

如果未来需要清理命名，可以单独设计一次 `minimal/activity -> message/board` 的设置迁移；本次不做。

## 前端实现边界

主要修改点：

- `src/pet/petAssistantViewModel.ts`
  - 移除 `waiting_input` 的 message 生成。
  - 为 message 增加更丰富的会话身份、主描述和辅助信息。
  - 让 message 可复用 activity detail / meta 的安全上下文逻辑。
- `src/pet/FloatingPetAssistant.tsx`
  - 消息卡渲染支持 richer detail/meta，但保持紧凑。
  - 看板卡行为不降级。
- `src/i18n/resources.ts`
  - 将设置和菜单文案改为 Message/Board、消息/看板。
  - 弱化 `waiting_input` 的看板文案。
- `src/settings/SettingsPanel.tsx`
  - 保持 segmented control，但显示新名称和说明。
- `src/pet/petDisplayModeMenu.ts`
  - 保持 toggle 逻辑，更新 label/title。

## 测试计划

前端单元测试：

- `waiting_input` 不生成消息卡。
- `waiting_permission` 生成 persistent intervention 消息，并包含会话身份、tool/permission 细节和 meta。
- `done` 生成 completion 消息；启用 conversation preview 时展示 preview；未启用时展示安全元数据。
- `error` 生成 persistent 或可确认失败消息，并包含 tool/失败上下文。
- action count 只统计 `waiting_permission`。
- 看板仍包含 `waiting_input`，排序低于 running/tool/permission/error，并使用弱状态文案。
- 菜单和设置显示 Message/Board、消息/看板。

浏览器视觉 QA：

- 消息模式：多条强信号消息不会超出小宠物窗口的可读区域，按钮文字不溢出。
- 看板模式：300px 宽度和默认 3 行配置下，宠物和看板不互相遮挡。
- 中英文文案都不挤出卡片。

本机 Claude Code / 桌面验证：

- 构造或触发 `running -> waiting_permission`，确认系统通知和消息卡都出现。
- 构造或触发 `running -> done`，确认完成消息出现并按配置消失或保留。
- 构造或触发 `running -> error`，确认失败消息出现。
- 构造或触发 `running -> waiting_input`，确认不弹系统通知、不弹消息卡、不触发 waiting 动画，但看板和 Session Panel 可见。
- 在开启和关闭 `Read conversation preview` 两种情况下分别验证消息内容。

## 验收标准

- 用户可以从名称上理解：消息模式负责低频介入，看板模式负责长期扫视。
- 消息模式不会因为 `waiting_input` 产生误报。
- 消息模式的强信号卡足够说明会话身份和当前情况，不需要用户先打开面板才能判断是不是自己的目标会话。
- 看板模式保留多会话长期可见价值。
- 对话预览仍是显式 opt-in，未开启时没有 transcript 内容进入消息卡。
- 不引入 dashboard-first 的主界面形态。
