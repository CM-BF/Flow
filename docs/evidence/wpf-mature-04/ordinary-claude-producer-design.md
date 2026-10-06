# 普通 Claude 历史观测 producer：待审最小片

本页承接[原接缝准备](producer-seam-preparation.md)，不改其已绑定历史证据。固定源码为 `52ebd2b1efe5ecbfab9d3c59b1da2ed1580dd52f`；随后main/origin已到 `017adc276a888a218bed3ef9963bc4dabbc6cec2`、clean，所读14源与该固定提交及已集成bf067均相同；逐文件hash、SDK类型输入与账本时间见[只读输入](ordinary-claude-producer-inputs.json)。**仅设计，尚未批准实施；0测试/SDK调用/新Query/provider。** 沿本地find-skills、brainstorming的已授权短设计、codebase-design与固定clean-code方法，遵循[唯一模块化规则](../../../AGENTS.md#modular-design)。

## 已有公共接缝与职责

| 固定源码位置 | 本片复用，不修改 |
| --- | --- |
| `packages/contracts/src/runner.ts:43–65`、`context-observation-event.ts:4–31` | 已有公共`RunnerEventData`含历史观测；固定Claude source/version/method和有限payload，不复制合同 |
| `apps/runner/src/context-observations/claude-summary-values.ts:20–40` | c173唯一数值归一化：resolved model独立于requested alias、32输入类别归并4 kind，安全整数与未知校验；不恢复该已归还源的写权 |
| `apps/runner/src/execution-profiles.ts:37–59`、`runtime.ts:199–203` | 现profile gate负责配置一致性；runtime提供冻结executionIdentity，不由producer构造或自证 |
| `apps/runner/src/outbox.ts:32–52,82–89`、`apps/server/src/events.ts:25,79–106` | 现journal生成event id/sequence、持久化并等待ACK；原ownedAttempt/fence事务调用store，不增POST/sequence/重放协议 |
| `apps/server/src/context-transparency/store.ts:59–79` | 中心核session/profile/runner/attempt，注入真实detail ref和K02 metadata；ordinary缺冻结input时保留null；history current/remaining恒unknown |

## 最小 Interface 与采样时点

新增`readClaudeSummary(reader, { resolvedModel, signal })`小模块：reader仅可选`getContextUsage`方法；每次调用至多请求一次显式`{detail:'summary'}`，调用c173 normalize，返回有限`values`、`unavailable`或`unsettled`。内部固定最多1000ms等待（同时受原attempt/adapter signal约束），无重试、后台采样、日志原文、ref或emit；不接受full/default。Query生命周期、一次性调用门禁、observationId/observedAt与发布归`claude.ts`，不是新增状态机。helper只持一条pending promise、一个timer和一个abort listener，退出清理timer/listener并处理迟到拒绝，迟到结果不得emit。

`ClaudeQuery`现为AsyncIterable+close（`claude.ts:13`），只补窄可选control method类型，保持既有fake Query兼容。采样限定：task.harness=claude、显式executionProfile、已有executionIdentity且profile.runnerId匹配冻结runner；无steering/goalTools/goalGraphTools。现配置gate负责与本地模型/adapter匹配；producer不根据profile引用反查配置或改guard。缺身份/profile的legacy路径不采样、不改变原结果行为。

在`claude.ts:116–119`首个**成功、非is_error**的ordinary SDK result帧处理期间，先核session与resume一致、await ownership，并确保该session事件已ACK；无init时可从result绑定session，但resolvedModel仍null，不能拿options.model alias代替。随后同Query读summary一次并只保存归一化候选。`assistant-stream/index.ts:30–34`在该yield返回前不会发下一个本地next；这不证明SDK子进程无内部read-ahead，也不形成current/consumed cut。

不在首result直接发布，不break stream。继续原迭代直到正常EOF，保留`claude.test.ts:246–294`的同结果去重、冲突result、result后stream-error约束；任何此类失败丢弃候选。原最终session/成功校验通过后（`claude.ts:126–133`），再次await ownership，确认采样绑定的session/model未变，按正式payload schema组装并await context.emit，之后才走原artifact/verification/assistant-final。首次尝试前就置一次性标记，重复result不再采；后续身份变化只丢弃，不重采。observedAt为本次成功取得summary的时间，不在emit/replay时刷新；event envelope仍由outbox生成。

source只用`CLAUDE_CONTEXT_SOURCE`；nativeSessionId来自该Query，resolvedModel来自init与summary相等校验，requested模型由中心profile保存。只有允许数值/kind进入事件；无SDK names/path/body/grid、无fake evidenceRef、无材料全文。null model仍调用既有normalize的严格数值/类别校验后仅产生null值；hard capacity/compression/current/remaining不由producer新增推断。候选是有限规范值，payload≤65536 bytes，中心原校验继续生效。

## 失败、资源与待Root确认的保守边界

| 情况 | 明确行为 |
| --- | --- |
| 无方法；同步throw或明确reject；非法/模型不符response | 仅本次观测不可用、不造0、不重试、不记录SDK错误正文；原stream继续，只有原正常终止才可发布任务结果；不emit伪sample |
| summary pending期间1000ms到期或attempt/adapter abort，控制请求无法确认结束 | 不把Promise.race当取消确认；立即退出adapter进入原finally的abort+close，丢候选。清理后抛现有`NativeExecutionError('unknown')`，由runtime:226–240保留admission、不发送completed；close/iterator清理异常不得覆盖此unknown而降成普通failed。此保守行为待Root审，接受它可能使一次已返回结果的任务保持uncertain |
| summary已正常settled之后发生原stream失败/取消 | 沿原adapter路径处理；候选不发布，不因失败重采或扩展原全生命周期语义 |
| session/ownership/schema emit/outbox/ACK失败 | 与可忽略measurement read错误分开catch；直接传播，绝不吞后继续artifact/final；现runtime/EventStorageError/lost fence处理保留 |

SDK0.3.290 d.ts:3036–3038没有单次control的AbortSignal；3235–3243承诺close终止Query但返回void，没有可用exit receipt。不能声称超时后已确认child关闭，也不新增transport私有访问、whole-process hard deadline或第二settlement状态。仅请求已发但控制结束未知时使用既有unknown类型；没有pending control的既有路径不扩大改造。原finally仍唯一拥有Query/steering/goal资源；本片不采steering/goal，不修改其三事件finalize。

具体异常优先级：在summary返回`unsettled`时，caller先设置本次调用的`contextReadUnsettled`标记，再退出；finally照常清timer/listener、abort并尝试close，将close异常临时捕获。若该标记为true，**清理后最终抛出的必须仍是原`NativeExecutionError('unknown')`**，不能被close异常/取消异常替换；不得finally return。若标记为false，不吞原emit/fence/stream错误，保留既有清理错误行为。明确reject/invalid路径不会设置该标记；read异常catch只覆盖SDK请求与normalize，绝不包裹session/ownership/emit。未知分支不存在候选emit，之后迟到结果没有发布callback。

## 精确写权请求与验证

建议仅4路径：`apps/runner/src/claude.ts`；新`apps/runner/src/context-observations/claude-summary-read.ts`、`apps/runner/src/context-observations/claude-summary-read.test.ts`；新`apps/runner/src/claude-context-observation.test.ts`。11:53:55 UTC账本这些候选/claude.test/runtime均无active writer（新文件按相同父目录检查）；F01 Lead v31持有runner union/events。**空scope不是授权**：Root审设计后先交包含公共入口的受控base，再fresh ledger按当前v7原子amend成功才能实施；当前v7仅两个metadata目录，未预领、不恢复旧18源。旧claude.test、normalize、runtime/outbox/settlement/union/server/client均不改。

零模型计划：新helper测试显式summary/this绑定/一次调用、正常/非法/null/模型不符、reject/同步throw/缺方法、deadline/abort竞态、迟到reject与timer/listener释放；公共createClaudeAdapter+fake Query断言session ACK→采样、同Query未close、候选在正常EOF后才emit、alias≠resolved、重复result仅一次、stream错误/冲突不发布、缺profile/identity及steering/goal不调用、失败无raw泄露、emit/fence失败传播、unknown在close抛错时仍保留。新adapter测试另用public runRunner+专用loopback+真实临时journal核unknown无completed/重启阻挡、正常事件经真实RunnerEvent schema/outbox连续ACK；不改runtime测试hook、不启动PG/provider。

实施时保留全部原断言，显式Node24/pnpm9.15.4/Vitest4.0.18路径选择：两个新test + `claude.test.ts` + 直接`assistant-stream/stream.test.ts` + `runner.test.ts`；记录实际selected/pass/skip理由，0 tests不算绿。只在新风险需要时补选现outbox测试，不累加历史重复轮。root strict noEmit纳入实际类型/直接消费者，不造声明或放宽选项。已有生产中心/PG检查仅作复用前提，fake Query不证明真实SDK result后control可用、无provider网络或精确消费cut；这些未知单列，不以本片交付宣称04完整Done。
