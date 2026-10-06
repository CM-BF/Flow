# Native工程接线：file-only、模型身份与writer settlement

2026-10-06 11:54:48 UTC；WPF-MATURE-02 / chatui01_owner / co-lead mika。仅向ExecutionLead提供固定输入与owner路由，不实现native writer或更改权限。本片不运行Codex、诊断、query、PG或测试；不以02/R06整体阻塞已授权的fixture/checker/snapshot零模型工作。

## 固定输入

| 输入 | 固定来源及用途 |
| --- | --- |
| 已集成生产参照 | main `52ebd2b1efe5ecbfab9d3c59b1da2ed1580dd52f`。本次通过Git blob实读 `apps/runner/src/native-harness/codex/{turn,policy,wire,evidence}.ts`、`apps/runner/src/native-harness/settlement.ts`、`apps/runner/src/engineering/{writer,adapter,resources,launch}.ts`；不追随移动WT解释旧结论。 |
| 0.154协议 | `/tmp/flow-e02-schema.6svf7w/ts/v2/` 的 `Model`、`ModelListResponse`、`ThreadStartResponse`、`ModelReroutedNotification`、`SandboxPolicy`、`Turn`、`TurnCompletedNotification`、`TurnInterruptResponse`；manifest SHA256 `1f5e3f224266c31f3e885341fca395c2b3d35e8b722f8b067c44864f9261f78f`。源码存在不证明本机执行兑现；binary来源限制见[只读版本事实](bootstrap-policy-readonly.md)。 |
| 已审R06接口 | [独立交付输入](integration-readiness.md)：原transport `a239b14d5328c78cca02a8757e26f2b65502f926`；五源private stderr delta `0778847702e595405f6cba0de51c1058b1436504`（本树逐字复核），仅受信sink与有界观察，不能补充writer隔离证明。main52eb的CloseReport仍不含该可选sink。 |
| 已封存实际事实 | [v3结果](fd-canary-v3/run-report.md) target `d8038d3ab4b8e58fbe30a19e7135f457eb4cd958`，仅faithful FAIL批准；没有本机隔离通过或失败因果证明。旧窗口不恢复。 |

## 1. 当前没有可宣称兑现的原生file-only策略

| 层 | 已有事实 | 仍不能证明的内容 |
| --- | --- | --- |
| native请求声明 | SandboxPolicy声明workspaceWrite/writableRoots/networkAccess等；ordinary wire固定readOnly、networkAccess:false。 | workspace-write不是禁exec，approval never不是禁工具；prompt约束和配置接受回执都不能替代执行控制。禁网络的范围不能自行缩成只禁某个网络工具，也不能暗设provider通信例外。 |
| host执行与观测 | 当前`denyCodexRequest`拒fileChange/command审批及其他server请求；`assertOrdinaryItem`只允许user/agent/reasoning/plan，fileChange被拒，看到工具活动按违例处理。 | 只约束收到的请求；native自动允许的操作可能不经过host。事后看到/拒绝事件不能证明操作未发生。现ordinary policy无法直接作为允许文件写改的engineering policy。 |
| OS边界 | C/Node自有profile实验均封存失败；可用的trusted factory接口不默认提供sandbox。 | 尚无覆盖受管repo精确写范围、禁exec/network/提权、子进程与其他写入通道的已验证强制策略。上游完整policy/stock日志收集也不能直接导入。 |

所以file-only目前**未证实**。禁exec约束本次native writer/tool；既有可信checker沿自己的固定授权执行，不能把checker授权下放给模型。后继生产owner需独立说明可执行控制、全部工具/写入通道、准确路径与未知处理；本页不通过放宽ordinary policy制造支持。模型只生成候选文本、由可信零模型代码验证并写入的设计属于另一明确边界，也不能冒充已支持native fileChange。

## 2. ≥Sol门槛：目录、请求、接收配置、实际身份分别保留

`model/list`给目录id/model/displayName和能力选项，可能来自bundled目录；不证明entitlement、调用成功或该turn身份。requested model只证明请求意图。`ThreadStartResponse.model/modelProvider`证明native回报的接受配置，不能直接填actual。`ModelReroutedNotification`含同thread/turn的from/to，可作为真实逐turn观测来源；不证明未通知时一定无降级。当前ordinary evidence不支持该通知、遇到会拒绝；当前`runOrdinaryCodexTurn`明确返回`actualExecution.model=null/evidence=unknown`，尚无真实模型身份已达门槛的证据。

项目规则覆盖所有项目写入：只有明确达到Sol的模型可修改，`gpt-5.6-sol`、`gpt-6-astra`符合；其他名称/别名需可信明确映射，不能按displayName、字符串相似、推理effort或fast档推定能力。Actual unknown不能声称≥Sol，也不能先准许不明模型写入再用最终文本反证。生产准入需可信模型身份来源、明确能力映射与禁止自动fallback/降级的执行约束；缺证就拒绝native写改，不fallback至低能力或unknown模型。收到reroute/mismatch/unknown须保留事实、停止继续推广，不能把requested复制成actual。

## 3. 可复用settlement与未覆盖的“全部writer已停”

- **turn语义与pump**：复用main52eb `runOrdinaryCodexTurn`唯一R06 `receive()`消费、thread/turn身份绑定、已审普通final projection；item/completed final_answer与对应turn/completed成功是两层证据。`turn/interrupt {}`只是ACK；断连/EOF/超时不是成功完成。工程policy差异必须由生产owner明示，不另造pump或agent loop。
- **本地进程关闭**：R06 `close()/closed`给`child: confirmed-exited|unconfirmed`、exitCode/signal，`remoteEffects`始终unknown。它只持有直属ChildProcess，不枚举所有后代/其他writer；EOF不等于退出，直属close不等于全部写入已停止。private sink只细化stdio观察，不提升settlement。实验`groupGone`只针对当时自有进程组；也不证明逃逸后代或其他主体不会再写，不能提升成生产保证。
- **工程结算接口**：复用`engineering/writer.ts`的`executeEngineeringWriter`及同leaseId的`settlement: stopped|unknown`；异常/坏receipt保持unknown。`engineering/adapter.ts`只在stopped后snapshot/checker，unknown时保留lease不release。`NativeExecutionError('settled')`的native终态语义不能直接转换成工程`stopped`；前者并未证明目录内全部writer静止。

后继native writer必须提供可核的全写入者停止/撤销写权依据，绑定本次lease、工作目录与执行身份；至少覆盖被允许的native工具、后代与任何受托写入者。来源/生命周期覆盖未知就不能返回stopped、不能native promote或释放该lease。仅发cancel、Promise settled、一次snapshot相等、直属child close或group信号成功均不充分。零模型fixture/checker/snapshot可继续在自己的可信writer与受管资源证据内推进，不依赖真实provider或本任务诊断成功。

## Owner路由与本片范围

ExecutionLead指定的native/ENG生产owner负责file-only policy、模型身份准入及EngineeringWriter到单turn的组合；共享host仍维护assignment/lease/journal/最终状态。R06 owner负责transport生命周期的真实事实，不承诺全部writer已停；02保留协议/证据解释与已审sink交付输入，不修改生产adapter、ENG或已交回store。新增生产scope/权限/窗口均不能从本页推导。此文只记录缺口，不给现有已审普通turn或受限checker追加未运行结论。

方法：沿既有本地find-skills、codebase-design/clean-code（sickn33 bdacd76）检查状态所有权、单一pump复用、声明/强制/观测分层及unknown传播；只读固定源码与metadata检查，不重复工程验证。新接口说明属于封存后的文档工作，旧v3归档保持固定快照。
