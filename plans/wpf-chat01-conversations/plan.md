# WPF-CHAT01 持续对话 Web

创建/更新：2026-10-06 03:36 UTC。状态：in-progress。唯一 owner：workspace_panels_owner / gpt-6-astra ultra。继承父准备计划 WPF-CHAT01-01..07 和 U11（父 REQ41..45），首批交付不删除后继需求。

## 用户目标与首批范围

首页主路径是持续聊天：自然用户/assistant正文、可编辑composer、同一持久conversation追问。保持Arc式紧凑侧栏、Codex式48px竖rail、split/merge、右侧tabs和已审可信插件接缝；Work overview留rail入口，工程dashboard保持独立。执行telemetry折叠或进右面板，不用系统timeline、Field notes、Verification卡片冒充模型回答。49922与55049现有fixture服务和用户tab保留，新增独立预览明确fixture/真实来源，不暗换入口。

首冻结合同4c2408e4db3595879f6471cb5fffccadec975b3d给出conversation稳定ID、revision、immutable有序turn→durable task、reply可用来源、requested/effective配置。公共client输入84117ca1c7446ee2e2b50f0526f3460dd42a2869由MainLead独占；本owner不得手造DTO/第二HTTP client/改shared。中心模块仍在实现，公共client测试不等于live中心可用。

capabilities明确queue/steer/liveAssistantText/perTurnModel/perTurnThinking/perTurnTools=false：本批清晰禁用，不装默认queue、不伪装流式或假控件。正文只渲染turn.user与assistant.available的adapter-final文本；pending/unavailable单独表达，telemetry仅执行下钻。truncated正文保留text与typed contentRef展开入口，cache键包含connection/conversation/turn/task/attempt/artifactVersion，未展开0detail。

## 已确认方案

- 新 conversations 深模块拥有ConversationProjection/Outbox/消息转换；App只组合，仍用公共FlowClient。conversation.id为路由/侧栏/草稿身份，nativeSessionId不作会话主键。turn.task.id用于执行观察/决定/取消/插件局部身份。
- 保留真实官方完整Thread与ExternalStoreRuntime；isSendDisabled仅锁发送，受理后和运行中草稿可编辑；不永久isDisabled。不混入整个任务entries为assistant正文。
- 发出前冻结commandId、text、mode、expectedRevision；outbox记录独立于新draft。ACK未知保留原key/payload显式核对重试，迟到ACK或失败不清/覆盖新输入。409只刷新权威态，禁止自动改revision/key重答。MessageNotSentError只用于确定未送达；普通Error不意味着未受理。
- 本地core0.3.22有message.steer ?? isRunning默认路由，普通按钮/Enter/Ctrl或Cmd+Shift+Enter必须统一门禁。本批queue=false不挂queue adapter；已授权follow-up仅在中心允许时发。
- revision是命令CAS，异步reply变化不增revision；不能用revision作唯一缓存水位。按实际task.updatedAt/artifactVersion/刷新结果更新正文。首合同暂无conversation SSE，只按公共读取与可见pane观察接缝实现，不伪造接口。
- 换中心销毁旧connectionscope/outbox/缓存/hidden views，旧closure不能复活到同ID新中心；隐藏观察不取消任务/丢幂等key。最多可见双pane占观察预算。消息动作按该message对应turn.task身份，不把整conversation假作一个task。

## TODO

- [x] **WPF-CHAT01-01** 持久化U11与能力/会话/消息/queue/steer合同，完成唯一owner、worktree、正式claim和公共输入接入。
- [ ] **WPF-CHAT01-02** 最小持续对话：自然hi回复、同conversation追问、断线恢复、幂等与正文气泡；Web公共协议fixture、真实中心和真实模型分别验收。
- [ ] **WPF-CHAT01-03** 实际capability驱动model/effort/access/context/files；首批不支持明确禁用，后继真实授权控件仍待合同。
- [ ] **WPF-CHAT01-04** tool/允许展示thinking仅轻引用和鉴权详情0→1→cache；首批只真实typed reply引用，无来源不伪造thinking/tool。
- [ ] **WPF-CHAT01-05** 持久queue顺序/取消/恢复与steering确认/生效/拒绝；首批capfalse，后继仍pending。
- [ ] **WPF-CHAT01-06** 语音设备许可/录音与转写分开、错误回文字；无已支持服务明确禁用，不暗接付费服务。
- [ ] **WPF-CHAT01-07** 固定target独立review、双主题/390px/keyboard/reduced-motion、真实中心/模型证据分开、dashboard与原Lead集成闭环。

## 边界、依赖与验收

精确写入scope见[status](status.md)与[take receipt](../../docs/evidence/wpf-chat01/take-receipt.json)。I01已v2移出四接缝，本owner不在旧I01恢复写；不碰PERF02 workspace-feed、B01/X02/backend、shared exports/client或plugins。新树base b5844442699733558a152c12392ea78f26c393a4；固定输入与现场冲突见[输入记录](../../docs/evidence/wpf-chat01/inputs.md)。共享冲突只交MainLead，纯outbox/文档可继续。

验收覆盖独立新draft与pending/unknown、相同payload/key重试、409权威刷新、同ID跨center、关闭/隐藏迟到ACK、8聊天双pane预算、分页去重、pending/unavailable语义、lazy detail0→1→cache。真实模型旅程由主线明确认证/预算安排；未安排时明确未验证，不能以协议fixture替代自然模型回复。每段及约30分钟安全点/交付应用clean-code，不重复安装技能。计划的未完成后继需求由管理者按明确owner/claim滚动派发。
