# WPF-MATURE-04 只读源码基线

观察时间：2026-10-06 08:58–08:59 UTC。产品main与新工作树固定base：`b1c2e39837c2208e6fc2c59a80e16797f26448b5`；创建前main clean，创建后context-transparency clean。本研究没有工程测试、服务或provider调用。

| 入口 | 已核事实 | 不能推出的结论 |
| --- | --- | --- |
| [execution-profiles contract](../../../packages/contracts/src/execution-profiles.ts) | runner-configured配置；model.resolvedModel=null、providerCapabilities=unknown；opaque materialScopeDigest | 实际模型、provider容量、材料正文/token占用 |
| [K02 contract](../../../packages/contracts/src/conversation-context.ts) / [store](../../../apps/server/src/conversation-context/store.ts) | 精确引用与byteLength；immutable context/input；公开metadata与私有compiled prompt分离；rawBytes8192等Flow预算 | 8192是模型token容量；executionInputDigest涵盖全部SDK上下文 |
| [Claude adapter](../../../apps/runner/src/claude.ts) | SDK0.3.290；task prompt还追加本机材料路径/系统提示；emitUsage输出session累计modelUsage；材料最多32个，每文件限制1MiB | 当前窗口used/remaining；文件被授权就已读取/驻留；账本消耗可当上下文大小 |
| [usage center](../../../apps/server/src/usage.ts) | 稳定sample去重、session baseline差分、unknown保留、任务总消费 | 压缩后的当前窗口占用、实际安全余量 |
| [native activity](../../../apps/runner/src/native-activity/index.ts) / [contract](../../../packages/contracts/src/native-activity.ts) | assistant/user/tool_progress有限映射；read引用/正文另存 | 系统compaction事件或current-context测量已支持 |
| [Web selection](../../../apps/web/src/conversation-context/selection.ts) / [profile picker](../../../apps/web/src/execution-profiles/ExecutionProfilePicker.tsx) | 草稿引用冻结、字节限额；profile创建后锁定，请求/实际未知分开 | 可在已有对话任意换模型，或前端已显示完整窗口统计 |
| [CTX01 plan](../../../plans/ctx01-context-kernel/plan.md) | 固定core的手写摘要/原文ref/恢复合成实验 | 生产压缩已集成、摘要语义质量或真实token/账单节省已验证 |

仓库定向检索 `contextWindow|context_window|compact_boundary|compact_metadata|pre_tokens` 在当前 `apps/runner/src`、`packages/contracts/src`、`apps/server/src` 没有命中；这只是此基线范围内缺少相关字段的静态证据，不代表provider永远不支持。

## R05权威分支快照

- 登记worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/native-harness-host`，branch `codex/native-harness-host`。
- 实际HEAD：`a8a2517fda7d5dffa5135b88d9b85bb3c75fcfaf`，实际dirty为空；status声明实现target `47e6943080a0d4713190c51dd5ffb234b8efd915`、base `d7e1e64e7792f4d1ad4933db042f10f266ad0cca`、review NOT_STARTED/main未集成（按该owner源记录，不推断更新）。
- 只读文件：`packages/contracts/src/native-harness.ts`、`apps/runner/src/native-harness/descriptor.ts`、`docs/evidence/r05/interface.md`、`plans/r05-native-harness-host/{plan,status}.md`。
- Interface为`ConfiguredNativeHarness={adapter,descriptor}`；descriptor含protocol/harness/adapterVersion/ports/publicProfile。ports仅steering/goalTools/goalGraphTools；本地配置，不序列化到中心或旧profile digest；保留run():Promise<void>。不含context测量port。
- live ledger 08:58:10 UTC显示R05 claim `3f2622a4-0a55-4122-8522-7f4ed388d875` v1 ACTIVE，owner assignment_review / lead astra_ultra_execution_lead。WPF-MATURE-04首片与它无literal范围冲突，不修改其scope。

本任务take前ledger state=available，WPF-MATURE-04任务/新worktree/两个scope的父子重叠冲突均空；正式成功凭证见[take receipt](take-receipt.json)。不在本证据复制所有任务账本或连接配置。

## 固定SDK/协议类型的有限只读证据

2026-10-06，按mika提供的精确位置读取Claude SDK0.3.290本机` sdk.d.ts `的Query.getContextUsage、SDKContextUsage、SDKContextUsageCategory、SDKControlGetContextUsageRequest段落，未调用SDK。实际文件为主仓`node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.290_@anthropic-ai+sdk@0.131.0_zod@4.6.5__@modelcontextprot_qzqoiskwjgbes3l4fvedsmb7w4/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`。

- Query.getContextUsage公开summary/full；默认full会使用逐类token-count API，summary使用上次response usage和本地估算。本任务0调用；summary能否零模型初始化后获得可用数据仍unknown。
- SDKContextUsage.total_tokens明确是估算且不clamp；raw_max_tokens为autocompact窗口，不总是模型hard limit；over_limit区分hard_limit和compaction_window。
- categories必须按kind分类，deferred不参与窗口数学，不解析英文label；本机memory_files.path不能直接公开到新的中心快照。
- 仅存在API/type不证明Flow已经采集、持久化、展示或跨重启恢复。

有限读取Codex固定生成schema：`/tmp/flow-e02-schema.6svf7w/ts/v2/ThreadTokenUsage.ts`、`ThreadTokenUsageUpdatedNotification.ts`、`TokenUsageBreakdown.ts`。字段为total/last/modelContextWindow以及threadId/turnId关联；schema不解释last/total是否完整驻留上下文，因此不能直接映射used。没有启动Codex、登录或调用模型。

文件hash及观察时间见[sdk-source-hashes.json](sdk-source-hashes.json)。mika另提供Pi输入清单`/tmp/flow-runner-consumer-input-20261006.json`、SHA256 `a2e942933c6b6ad6ff95a52295cebcc05462ef1b76f9390d72f1fecf21e83cef`；本owner未重读大规模probe，不据此扩展到Pi实现或声称其行为验证。WPF-MATURE-02/R05只作为明确依赖，不另维护它们进度。
