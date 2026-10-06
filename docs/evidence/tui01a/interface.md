# TUI01A Interface v1

所属 [TUI-001](../../../plans/tui01-terminal-client/plan.md)。终端与 headless 均通过 packages/interaction 同一 typed handler；中心是会话、任务、正文与权限权威。

`createInteractionController({client,connectionId,intents,makeKey?,pollMs?})`：client 为 FlowClient 窄 Pick（conversation/list/turns/create/submit/profiles）；connectionId 为 host 提供的不含 token 的连接绑定；intents 是 load/save/clear 持久端口。`initialize()` 仅加载未决意图，不发 POST。`execute(Command)` 返回结构化结果；`snapshot/subscribe` 给纯轻投影；`disconnect/dispose` 只 abort 本地观察与等待。

Command descriptor 单表定义 name/help/completion/parse。首版类型：help、conversations{after?}、open{id}、profiles{after?}、new{title,profileId?}、send{text}、recover、disconnect、quit。slash `/new [--profile UUID] title`，普通文本原样进入 send；帮助/发现命令不触发模型；send经中心受理后可能调用已配置runner。queue/steer/cancel/decision 不在首片，未知命令明确拒绝。

每次 create/turn 在 POST 前持久保存 immutable body + key + connectionId；成功清除，网络/5xx/中止/丢 ACK 保持 unknown，绝不换 key 自动重试。`/recover` 有未决时仅由显式用户动作重放完全相同 key/body，一次；无未决时 GET 当前会话。存在 unknown 禁止新 mutation 和切换会话。启动恢复不会自动 POST。

controller 仅拥有选择、草稿、观察、intent；GET 用连接 epoch/AbortController，旧响应不能覆盖新选择。mutation acknowledgement 不冒远端完成。退出不调用cancel，不自动提交草稿。重复 execute mutation busy 拒绝，不设本地队列。

有界：草稿/消息 16,000 UTF16且64KiB UTF8；会话/profile列表一页6（全部可见），仅缓存最近20条turn，正文每条8KiB、用户文本每条4KiB，纯正文缓存最多240KiB（另有有界元数据与JSON转义开销）；截断可见，原正文与hash不改写。仅有限轮询当前会话；关闭释放timer/signal/subscription。终端 ANSI/OSC/C0/C1/双向控制符显示前净化，原文与protocol分开。首版不请求tools/detail/stream。

apps/tui 提供 Ink renderer 与 `--headless` JSONL（每行typed Command，输出structured result/light snapshot）两consumer，同handler/controller。凭据仅明确 FLOW_URL/FLOW_TOKEN 环境，不进argv/history/log。CLI 私有intent journal 0600 + 目录0700 + exclusive lock + 原子写；绑定连接身份并限制体积，unknown不跨连接恢复。交互用 react-ink 独立受控 TextInput，无 AssistantRuntimeProvider/LocalRuntime/history。

首片工程证据分纯controller、真实HTTP/随机PG+fixture runner、Ink输出、真实PTY输入/resize/退出；0provider，不称自然语言能力。父任务其余TODO保留。
