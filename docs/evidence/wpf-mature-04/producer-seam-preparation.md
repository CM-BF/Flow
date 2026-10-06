# Claude 历史 producer：有界接缝准备（未实施）

2026-10-06 11:12:19 UTC fresh账本、main `2e71fabc218df28f6ccb78a927432ae1101c17c5` clean；当前已审历史片 `9ac549dddd12b6bb186bf34116c4c72fe9889cfc`，集成输入见 [history-integration-ready.json](history-integration-ready.json)。本页只读研究，不扩claim、不改源、不调用SDK/provider、不跑测试；完整current/remaining/cut仍unknown。

**最小可交付 Interface。** 后继先共用一个纯 `normalizeClaudeSummary(response, expectedResolvedModel)`，返回 `{ resolvedModel, used, compactionWindow, categories: [{kind,tokens}] }`。唯一负责固定SDK0.3.290 camelCase数字合法性、≤32行→≤4匿名类别、安全整数总和与resolved模型匹配；unknown host model继续null数值/空类别，不以requested alias替代resolved。无运行SDK import、IO、正文/path/名称、evidenceRef、DB identity或当前性。旧 `mapClaudeContextSummary` 消费此结果后保留其现有public行为，未来wire producer加固定source/host observationId/observedAt/nativeSessionId并经已有payload schema检查。中心继续独占真实detailRef/身份注入；不要复制归一化，也不要伪造ref过旧mapper。wire只有kind，旧mapper/中心的展示category ID保留各自映射，不把字面ID差异当token算法差异。

**最小真实 caller。** 首片限定普通、已有explicit executionProfile、非goal-tools/graph-tools、非active-steering的Claude attempt。沿当前 `claude.ts` 同一个Query，在成功result帧的session/结果身份已核之后、yield控制返回coalescer之前，最多尝试一次显式 `getContextUsage({detail:'summary'})`；不创建Query、不使用full/default、不后台重采样。`assistant-stream/index.ts:25–32`在yield result后才请求下一次iterator.next，因此本地coalescer在这个接缝没有新的next请求；这不证明SDK子进程内部没有read-ahead，summary与result的原生消费cut仍unknown。已有session事件ACK必须先于sample；source模型使用同Query init的已记录model，不能用options.model alias自证。host ID/时间生成一次，emit交既有runtime outbox，不新造journal/sequence。采样失败/缺control方法/模型不明/abort/所有权变化不得造0或重试；未知不破坏已有结果路径，也不能吞context.emit的fence/持久化失败。

Query控制方法当前未在 `ClaudeQuery`类型公开；后继采用窄可选method作为注入接缝，真实SDK方法是否能在result后、stream关闭前响应仍待真实caller证据。summary请求必须受现有attempt abort与有限等待约束；超时未确认取消只能unknown，finally仍由原adapter abort/close释放。首片不改steering `finalize` 的三事件原子合同，steering采样留后继既有serial/mailbox/CAS区间；不新增FSM或把transport sequence当消费cut。

| 下一片精确候选路径 | 11:12:19账本事实与职责 |
| --- | --- |
| `apps/runner/src/context-observations/claude-summary-values.ts`、`.test.ts` | 尚无active writer；待原子amend，单一纯数值归一化 |
| `apps/runner/src/context-observations/claude-summary.ts`、`.test.ts` | 本owner v5，但当前3ab批准源冻结；需Lead明确新片修改范围后才复用重构，保留旧断言 |
| `apps/runner/src/claude.ts`、`apps/runner/src/claude.test.ts` | 尚无active writer；待原子amend，只有普通result接缝与真实adapter注入测试 |
| `packages/contracts/src/runner.ts`、`apps/server/src/events.ts`、3个共享index | 全局接线由Lead处理，参考[当前路由](handoff-current.md)；空scope不是授权，不在producer候选写区 |

**零模型验证。** normalize共享数值/隐私/溢出/四kind/unknown/mismatch；旧mapper→projection断言保留；注入现有public createClaudeAdapter的fake Query提供summary方法，断言只调用summary一次、session先于sample、sample先于artifact/final、未close时调用、同Query与nativeSession、alias≠resolved可合法、无profile/steering/goal不采样、缺方法/拒绝/超时/abort/模型不符保持unknown及资源关闭、emit失败不能伪装完成。wire通过正式schema，已审store负责DB绑定，不在runner传DB ref。未调用真实SDK不声称生命周期/网络/当前性验证。

**明确依赖。** ① Lead接受历史片并交一个包含正式027、runner union及applyEvent挂载的受控base，才能通过真实RunnerEventData→center消费链交付producer；② Lead确认上列候选并允许旧mapper保持行为的复用提取，fresh amend成功后写；③ 真实SDK result后summary可用性、消费者cut与provider精度仍unknown，可在已授权模型任务中另验，不为查字段启动模型。纯归一化可先独立实现，但不因此把producer或完整04标Done。方法沿既有find-skills/codebase-design/clean-code固定基线与AGENTS#modular-design。
