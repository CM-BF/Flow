# R05B B1 Interface

固定输入：R05 8a148c5；Mika b880169的0.154.0生成schema。本片只做中心普通task/final，未实现生产Codex运行。

- `codexExecutionProfileConfigurationSchema` 固定 `harness:codex`、`adapterVersion:codex-app-server-0.154.0-v1`，显式model，nullable reasoningEffort/serviceTier/serviceTierForTurn，access:none，approvalPolicy:never，sandboxMode:read-only，hostLimits `{wallTimeMs:1..90000,maxOutputBytes:1..1048576}`。host限制不声称SDK美元/turn硬限。effort与tier请求非catalogue/entitlement证明。
- `nativeExecutionProfileConfigurationSchema/Json` 为中心新入口，保留现有Claude codec/type和字段顺序；`NativeExecutionProfileConfiguration` 是两种严格分支。默认列表仍只返回现有`ExecutionProfilePage`（Claude）。中心publish使用新的native publication codec；公共exports/client与本机descriptor由Lead接入。
- `codexAssistantFinalDataSchema` 固定source `codex.app-server.agent-message`。沿用type/messageId/nativeSessionId/sourceMessageId/content/settings，增加必填 `nativeSourceIdentity:{turnId,itemId}`。原始thread/turn/item分别≤128 UTF-8 bytes；不截断；正文≤1MiB UTF-8。
- `sourceMessageId=sha256(JSON.stringify([turnId,itemId]))`；新`messageId=sha256(JSON.stringify([source,nativeSessionId,sourceMessageId]))`。Claude仍用旧`sha256(JSON.stringify([nativeSessionId,sourceMessageId]))`。025扩final来源、以source隔离唯一键并新增原始身份JSONB及session evidence局部索引；旧行保持null，旧ID/正文/日期不重写。
- Codex `settings.requested:{model,reasoningEffort,serviceTier,serviceTierForTurn,access:'none'}`。`observedThreadConfiguration`为null或已观察thread response中的model/modelProvider/nullable effort+tier/approvalPolicy never/sandbox `{type:'readOnly',networkAccess:false}`。B1只识别这一有限策略；其他实际策略不能伪装此形状。`actualExecution:{model:null,reasoningEffort:null,serviceTier:null,tools:null,evidence:'unknown'}`；thread配置不提升为turn实际事实。
- access:none只是Flow请求意图；never/read-only/networkAccess:false不证明native未执行工具或进程自身不读账户。B1不启动native，不提供此类运行保证。
- `AssistantSettings`保留Claude别名；新增`CodexAssistantSettings/NativeAssistantSettings`。普通final与读回消息按source严格区分；旧会话投影只消费Claude分支。新写入未知source、version、跨harness组合拒绝（包括未知Claude typed-final版本；旧v1 artifact会话fallback保持），Codex final须当前task/attempt/runner/session和pinned profile一致。

中心Module只有有限静态来源策略、身份复算与迁移入口；事件序列、lease/fence、终态与ACK仍归现宿主。新的adapter不能靠字符串注册取得能力，新增实现需明确新增严格schema、静态policy和迁移约束以及直接消费者验证。native usage仍unknown，不开放resume/queue/steer/stream/activity/goal。

验收：schema边界与旧canonical bytes、真实旧PG rows升级及重复migration、namespace身份复算、当前session/profile、ACK异内容/错误、旧profile目录和Claude会话。共享server mount需要在原migrations1..24之后调用 `migrateNativeHarnessSources(pool)`；没有挂载不能声称main具备此能力。
