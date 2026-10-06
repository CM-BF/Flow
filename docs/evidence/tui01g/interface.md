# TUI01G Interface（已授权设计）

固定输入 main 93a92c918b29126b6761b02258cef523906eca94。新 Module 只管有限 Claude 目录选择及有来源的显示。依赖方向：Ink/headless → typed command/controller → 可选 `Pick<FlowClient, 'claudeMessageSettingsProfiles'>` 与既有 mutation port → public contracts。默认缺端口不影响旧 client 构造。

- `settings { after? }` / `/settings [cursor]`：读一页≤6 profile，原合同每项≤32完整 choices。无无限累积/自动分页；失败或 epoch 变化不采用旧响应。
- `setting { profileId, choice }` / `/setting <profile-id> <1-based-choice>`：必须当前连接会话明确支持协议，conversation.executionProfile、capability.profile 和目录 reference 三元相等，原样 tuple 校验通过。无任意字段拼装/无 access 参数。
- `setting-clear` / `/setting-clear`：清除尚未发送的本地选择；未知 intent 不可由此改写。
- `/new --profile <id>`：可选当前普通目录或 settings 目录的 profile；creation ACK 仍旧稳定 capabilities，随后公开 GET 决定逐消息支持。Codex 不在该目录/创建合同内。
- `/send`：有能力的会话要求显式下一消息选择；冻结 messageSettings、revision、原文本、key 写同一现有 intent journal 后提交。成功 ACK 清除该次选择；unknown 持久原 intent，只有 `/recover` 明确重放原 bytes/key，不重新查目录或选择。确定拒绝保留草稿，不自动提交新 revision。
- 切换会话清空本地选择。断开停止读取；不取消中心任务。catalog 与 capability 变化不修改已持久 intent，中心仍是准入权威。
- 历史显示 requested tuple 与受绑定 final 的 observed init 字段分开；missing/非法/矛盾来源显示 unknown。thinking 没有原生观察证明，始终 unknown。不从 catalog、requested 或旧 runnerRequested 推断 observed。

现有 `decodeConversationTurnAccepted` 与合同负责 ACK 比较，不复制；选择/显示模块使用公开 schema/checker。未知 outcome 不造第二恢复状态机。选择和有限缓存属于 controller 观察生命周期；持久状态仍仅既有 IntentStore。

验证候选：允许 tuple/非法笛卡尔组合、缺能力/错 profile、成功/未知/矛盾 ACK、重启原 key/body、409 CAS、过期读、实际 Ink/headless 消费。当前无 provider、无后端、无新权限；真实 HTTP/PTY/PG 要另有资源准入。本设计不称完整 TUI→Web→TUI 验收。
