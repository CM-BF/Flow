# S01 确定性 Runner 容量验证

创建/更新：2026-10-07T12:55:31.777835+00:00。状态 in-progress；owner status_read / gpt-6-astra（co-lead Mika）。Goal Owner 已批准最小实验方向。权威 worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe`，branch `codex/runner-capacity-probe`；初始已审基线 `115b0dbdfa02db5483f9e9699852682ce699633c`。

目标：在真实中心、PostgreSQL、独立 runner 进程及持久 outbox 上，区分持久会话数、中心声明容量、实际执行并发与本次确定性工具负载。先找出最小容量缺口，不把观察者、数据库行数或模拟模型当真实 provider 容量。父要求见 [FLOW-001](../flow-001-architecture/plan.md) 与 [FLOW-002](../flow-002-provider-harness/plan.md)。

## TODO

- [x] **S01-01** 核对 B01/LAB01/LAB02/R03 权威来源、固定证据及缺口。
- [x] **S01-02** 固定有预算、资源归属和通过条件的实验合同。
- [x] **S01-03** 仅在新 experiment 目录实现薄实验入口、计量和资源清理，完成功能 smoke。
- [ ] **S01-04** 经 Lead/Web 协调窗口，运行首个 128 持久会话背景 + 4 runner / 16 task 场景；按瓶颈再运行 1 runner 对照及声明容量场景。
- [ ] **S01-05** 独立方法/结果审查，发布事实、清理与 main 接收记录。
- [ ] **S01-06** 根据结果另立产品修复或更大容量片段；真实 provider/工具预算另行授权。

## 已确认合同与边界

可逐步执行的 [实验合同](../../experiments/runner-capacity/README.md) 与 [机器可读参数](../../experiments/runner-capacity/contract.json) 是本片段实施输入。已确认：0 模型/云调用；只写新 plan/evidence/experiment 三目录；不改变生产 runner、scheduler、池或 outbox。并行队伍仍 Mika + K03 worker 两槽；K03关键审查优先。

先运行一项最小真实执行窗口，不能一次展开完整矩阵。正式计时由 Execution Lead 协调 Web；未取得具体时间窗口前只做源码、合同与低成本功能准备。若正式失败，保存原始失败及归属，不能换种子/删断言/重复至满意。需要产品变化时按新 owner/scope/claim 处理。

架构影响：实验只消费现有公开接口与 runner runtime，没有产品接口、数据库 schema 或生命周期变化；无需修改产品架构图。生产瓶颈成立后的改动另行登记。

## 完成条件

S01-01/02 是文档片段，不代表压测已运行。实验交付须包含固定源码 commit/hash、实际配置/总任务数、样本数/分位数、事件身份全量核验、声明与有效容量、真实浏览器关闭后的执行事实、独有资源清理及独立 review。分支结论与 main 集成分别记录。

2026-10-06：初始合同。最小场景与实施/正式窗口分开，后继容量目标保持开放。

2026-10-06 W1已独审并集成main30b；Goal Owner确定下一最小对照为1进程声明capacity4/12任务，capacity1/16暂缓，ACK/browser各2保留。只准备新入口/预算检查，独审后申请≤30秒独立窗口，仍base115b与原总预算。

以下各带时间的阶段记录是当时的历史判断；当前 idle/A/B 已交付并main接收、S01P07 已main接收的事实见末节与唯一 status。历史 pending 不覆盖当前结果。

## S01-06 最小 slot 调度建议（2026-10-06 07:46 UTC，只读提案）

依据：W2固定结果0dac已独审，1进程注册capacity4而12个fixture attempts峰值1；base115b的`runRunner`逐次`await execute`，`RunnerOptions`及main入口当前没有本地并发参数。该事实支持先补本地执行槽的功能缺口，不支持修改PG池、重写中心scheduler或预测模型收益。W1/W2不再运行；capacity1/16对照继续暂缓。

推荐最小接口是`RunnerOptions.maxConcurrentAttempts`（默认1，显式正整数且有上限；首验只用4），由native runner入口传入；注册capacity和本地limit必须各自记录，实际运行不超过两者约束。参数命名与最终上限由接手owner确认，不自动把既有注册capacity解释成本地已启用。保留现有claim协议和中心容量/会话事务作为权威，不新增调度服务、数据库表或通用插件框架；A2A/protocol runner另有入口，不因native变更自动声明覆盖。

实现职责只分为一个admission/recovery owner和每attempt独立执行上下文：启动先恢复可恢复旧记录，再由一个single-flight claim循环在本地槽位有余量时领取；每个attempt放入有限Map并启动现有execute，完成或停止时明确settle。不能把现有完整while循环复制N份，否则每轮全目录replay会与活跃outbox写入竞争。运行中恢复必须排除active attempt，并在同attempt内串行；恢复结果未知时保留持久记录，不能换身份重发或绕过中心容量。

| 边界 | 必须保留的行为与验证 |
| --- | --- |
| 容量与未知结果 | Map的执行数、中心未completed的占用和注册capacity分别观测。execute Promise结束/SDK关闭/confirmed-final receipt都不能冒充completion ACK；uncertain仍可能占中心容量。claim未知结果不为填槽立即重试成新执行；当前没有丢失claim回执的可靠恢复接口，先停admission并保留unknown，具体缺口与后继接口见下文。 |
| 会话与状态隔离 | 中心resumeSessionId/active_task_id原子排他与saveSession再验证保持。每attempt独有AttemptControl、EventOutbox、decision Map、steering host/tail/session；继续按baseUrl digest和attempt digest分目录，不共享可变会话上下文。 |
| outbox与final proposal | replay与CHAT08 FinalProposalJournal恢复只有一个owner；活跃attempt不被扫描重放/删除。未知proposal只查询原proposal状态，不能重送native输入、合成completed或提前释放session。 |
| 停止与maintenance | draining/maintenance先停新领取，收束全部已起attempt；hold的active=0含uncertain占用。主abort/auth拒绝/EventStorageError按host失败处理，停止admission并等待各attempt清理，不能Promise.all首reject后遗弃其它心跳/SDK。 |
| 单attempt故障 | adapter失败、取消或ownership-lost只影响该attempt的执行；其他合法attempt继续。共享adapter对象是否可重入要逐个核对，不能由fixture可并行推断任意provider adapter安全。 |

建议独立验收片段：先用受控barrier验证一个进程limit4确实有四个执行重叠且不超限；再验证单attempt失败/取消不牵连其余槽、全局停止可收束、同session互斥、pending/live outbox不竞争、unknown完成/claim不重复执行及maintenance不误报可hold。直接测runtime/outbox与配置入口和真实中心claim/事件消费者；若公共契约、SQL或资源生命周期有变，显式扩入相关验证。fixture并发测试仍不等于真实模型吞吐或成本批准。

所有权输入：worker只读采样CHAT08权威WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/native-active-steering`，branch `codex/native-active-steering`，HEAD005e042994e61a15044c3825c533388776a21371，现场dirty、最终target UNKNOWN；status07:38:30由runner_owner负责，claim2f7b66e3 v2 ACTIVE已在账本核对，范围含runtime/outbox/active-steering。该工作树正在引入FinalProposalJournal，不能把移动中的源码当已审固定输入。Mika只写本S01提案，未领取或修改共享生产源码。解除实现阻塞条件：ExecutionLead与CHAT08 owner先固定接口/成果并明确新owner、独立worktree、原子scope交接，再选择最小实现任务；不先release抢占。

方法改进：少量功能峰值验收默认专用DB、动态端口、自有进程及实际背景负载记录，不反复暂停全队只取少量延迟样本。严格性能比较另约条件一致的测量窗口；记录观察开销与样本量，不由本提案推导百分比收益。CHAT06P01入口/实际矩阵优先于此建议；S01-06保持pending，因为提案不是产品实现或验收。

### 丢失 claim 回执的当前缺口（2026-10-06 07:51 UTC，GO只读review修正）

现状：`POST /api/runner/claim`要求空body，`FlowClient.claim()`不带稳定requestId，响应只有assignment/remainingLeaseMs；本轮未发现按claim请求身份查回执的公开接口。请求可能已在中心提交但响应丢失，本地不知道attemptId；现有outbox重放和FinalProposalJournal只覆盖已知身份记录，**不能恢复这个未知claim**。即使网络恢复、下次claim得到另一个task、或本地Map有空槽，也不能把原claim记成已恢复。lease到期可把任务标uncertain，但`completed_at IS NULL`仍计中心容量，不等于释放。

当前可实现的保守行为：发送单一claim请求前先持久化本地in-flight意图，只在收到确定响应后清除；进程崩溃后遗留意图也按未知结果处理，覆盖中心已提交但本地还没记unknown的窗口。单一claim请求一旦出现无法确认提交结果的失败，进入明确unknown-claim状态、停止新admission，不重试成新执行；已知合法attempt继续各自心跳/执行/清理。保留请求开始时间、runner身份与未知结果事实（不含token），向owner报告需核对。没有新回执接口时，本地不能自动猜测未知attempt身份、补发completed或用超时清空占用；需由中心/owner明确核对并按现有授权恢复动作处理后，才解除admission阻断。进程重启也不是清空该状态的证据。此保守模式降低可用性，是首个局部并发片的明确限制，不能称已支持无损claim恢复。

真正的自动恢复需要一个窄claim回执能力：客户端在发送前持久化稳定requestId；同runner+requestId的重试/查询必须返回同一次已提交的assignment及权属/剩余租约，或明确的未分配/已失效/仍未知状态，不能领取另一个task冒充恢复。中心必须在领取事务中原子绑定requestId与结果，重试冲突/重复键/身份变更要明确拒绝；已过期或uncertain不得通过查回执静默重新执行。接口形状和最小存储方式由后继owner评审，可优先评估既有领取记录的窄扩展，不预设新表/服务或通用调度框架。

此接口属于产品契约与资源行为的新实现范围，未在本S01只读提案中领取或实现。若首交付仅接受保守停admission，可先不引入该接口；若要求丢失claim回执后自动继续，则它是显式前置依赖，必须有“中心已提交/响应丢失/按相同requestId恢复且仅一个attempt”的行为证据。GO认可提案方向不等于该接口存在或产品实现批准。

### S01P01 已授权后继（2026-10-06 08:11 UTC）

GO/Lead已授权首个保守并行执行片段，由 s01p01_owner / gpt-6-astra 在独立工作树负责；权威 [S01P01 plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-attempt-pool/plans/s01-attempt-pool/plan.md) 与 [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-attempt-pool/plans/s01-attempt-pool/status.md) 记录实施进度。branch `codex/runner-attempt-pool`，base `9c6fa9b100f04916f43b04280f05f497b28eeb0f`；08:11观察 HEAD `155494b0f797004e5d3299cf26312118dd6664af` clean，仅准备metadata。claim `599454b1-52d2-4f22-8fc2-f68fb7ac6973` v1 ACTIVE、08:07:56.393Z COMMITTED；六个literal scope见该任务claim回执。上述07:46 CHAT08仍占用的观察是历史事实；当前runtime已释放并在固定base领取，不再构成实现阻塞。

首片默认1、显式整数1..16；仅启动或本地active=0时运行既有全目录恢复，任何active存在都不重放其outbox。未知claim或缺completion ACK的持久绑定保守阻断新领取；已知其它attempt继续。收到assignment后先可靠保存绑定再清in-flight意图，不存在“清意图后、开始执行前”丢失占用的空窗。仅confirmed-final不能删除绑定。无新claim回执API/迁移，main/config接线仍由CHAT09/F01后继负责。

S01-06转in-progress，表示独立后继已开工，不表示并发功能已验收。实验预算累计44 tasks/38 attempts、20.925025秒不变；W1/W2不重跑，capacity1/16暂缓，ACK/browser原验收继续开放。后继功能测试使用专库/动态端口及0模型确定性adapter，独立于原测量预算；实际并发、故障隔离、同session互斥、重启未知claim分别取证。Mika负责只读独审，ExecutionLead负责全局索引/聚合登记和已审片段集成。

## S01-04 / S01-05 后继混合负载阶段（2026-10-06 09:46 UTC）

owner status_read / gpt-6-astra，co-lead mika，所属 FLOW-001、M2。完整旧TODO及原预算证据保留；本节是既有S01的后继细项，不建立第三层任务。

- [ ] 固定[混合负载合同](../../experiments/runner-capacity/mixed/README.md)、真实runtime/outbox driver与实验私有PG观测seam。
- [ ] 纯观测透传/预算行为tests及strict noEmit；固定源码commit后独立review。
- [ ] 由Mika明确安排一次真实窗口后运行2×16、1×16/4×4，实际16重叠、事件/心跳/轻读/取消直接取证。
- [ ] 独审结果及清理、main接收；任何失败/unknown原样记录，不扩大额度或补跑。

新阶段32固定tasks、总上限40，60秒含清理，传输加证据64MiB；0provider。受控main4391基线，无产品pool/锁/schema改动；旧累计44tasks/38attempts/20.925025秒不变。当前仅driver实施获批，真实负载尚未运行。

## S01-04 / S01-05 停止修复后独立窗口（2026-10-06）

原mixed FAIL/partial-A结果已独审封存；P03修复已集成main0cee。GO新授权一次独立同负载窗口，当前先准备，不复用原reservation、task IDs、raw目录或retained journal。该阶段沿S01既有TODO，不建立第三层任务。

- [x] 固定[新输入/资源合同](../../docs/evidence/s01/mixed-after-drain-preparation/README.md)和最小run identity适配，绑定P03已审源码与独立输出。
- [x] 新输入纯检查/strict与独立固定target review；旧14检查不得冒充新增实测。
- [x] Mika点名唯一windowId/cleanHEAD后，执行一次32tasks A1×16→B4×4；失败停且B可NOT_RUN，60秒含清理/64MiB不放宽。
- [ ] 如实封存本次结果/资源/unknown、独审和主线接收；不对旧journal作自动恢复。

2026-10-06 after-drain实际窗口已完成：两组门禁PASS、资源清理完成，1次heartbeat错误原因unknown保留，实际结果独审/main接收仍开放。原FAIL不能改为PASS；本次仅固定fixture混合负载证明，无>100实际执行或SLO。

## S01-04 / S01-05 / S01-06：REQ-18 128实际fixture执行后继

GO批准唯一 `s01-128-after-light-reads-once`，先准备后独审再由Mika开门禁；一个8×16 case，最多128独立task/attempt与持久fixture session，180秒含启动/证据/cleanup，256MiB；无warmup/预演/补数/SDK/provider。固定设计见[Interface](../../docs/evidence/s01/mixed-128-preparation/interface.md)。

- [x] 固定main1c496835输入、profile与128身份/持续行为/预算/资源验收；41纯checks/strict0，source6de928d。
- [x] 独立review固定准备实现：Mika 2026-10-06 12:29:56 UTC APPROVED 6de928d；实际窗口仍待明确OPEN。
- [x] Mika点名70c92414后唯一128实际window完成，CLI0/14.64s/清理完成；0额外capacity调用，结果待独审。
- [x] 本次全量session/attempt/event ACK/fence/unknown与资源证据封存独审：Mika 2026-10-06 12:37:14 UTC APPROVED 64911a3c；REQ-18真实模型/完整故障/部署边界继续开放。

## S01-06 长驻wait后继登记（2026-10-06 13:00:30 UTC）

固定main280289 runtime.ts:55–59每轮race订阅全部active promises；结合TC39规范推断长驻pending订阅随tick积累。详见[有界登记与验收](../../docs/evidence/s01/long-lived-wait/README.md)。现6秒128已审证据不证明小时驻留有界，无heap/RSS实测结论。S01-06继续in-progress；后继需fresh产品scope+独立WT，由Mika协调owner，少量pending/有限虚拟ticks红绿验证订阅/唤醒、及时补槽及shutdown/unknown-claim/recovery-drain不变。此轮只metadata，0测试/负载，不触旧raw。

## S01-04 / S01-05 A/B准备（2026-10-06 13:43 UTC）

沿既有TODO实施固定A3e/Baae、共同observerc259、单一300s/512MiB总账本，详见[Interface](../../docs/evidence/s01/mixed-ab-preparation/interface.md)。只授权准备与pure/fake验证；实际窗口NOT_OPEN。产品唯一events差异，旧raw冻结；原未验收ACK/browser/native/SLO边界不变。


## S01-06 空闲成本测量与产品后继（2026-10-06 19:54:21 UTC）

本次测量已交付、双审通过，主线接收待定；不是未运行的只读候选。唯一窗口`s01-idle-claim-cost-once`基于固定main8d84公开runRunner只执行一次，1runtime/capacity1/active0、12空领取、24原子rename/48sync，正常stop后journal EMPTY与自有资源关闭。结果target `e4ed2cd8fa80159839a07ba8a2f7f212732f2b2a`，完整方法、检查、计量与限制见[接收入口](../../docs/evidence/s01/idle-claim-cost/result-ready.md)；原准备失败、raw、manifest及overall-archive历史快照不改。

15秒/2MiB约束已按实际外壳时间和保守计量核验。API调用次数与异步elapsed不等于物理I/O、功耗或SSD寿命；采样间峰值UNKNOWN。100agents不等于100runner，本片没有100runner/模型/SLO结论。测量没有改poll、durability、fsync、claim intent或恢复语义。旧17:21候选及18:31准备过程保留在Git e61ba2c3，不再作为当前未运行状态。

S01-06继续开放：已选S01P07“稳定领取机会”作为独立产品候选，空响应复用已durable key且不新增本地journal/中心永久empty receipt，保留500ms轮询；首次非空分配与compact receipt同事务，durable accept绑定原key和同attempt，历史receipt不当当前执行授权。v1未知请求、已持久assignment及过期/uncertain保持保守，不删journal或复活旧租约。上述为19:54时设计；现S01P07已由独立runner-claim-recovery树交付main0aa1d033，85非PG/8中心PG/4capacity分轮证据和主线组合核对见其权威status。该子任务claim已release，本树无其产品写权；不把功能验收当idle或A/B优化测量。

A/B在上述19:54历史阶段为另一未运行准备片；其后唯一实际窗口及独审现已完成，见下方当前记录；不为本次空领取样本扩大矩阵。原6TODO、ACK/browser/真实provider等完整验收不因此勾完。本S01架构影响仍仅实验观察；S01P07已将main0aa1d033架构target交Execution Lead更新，关联见本status。

2026-10-07 A/B实际已在唯一窗口完成并归还，固定结果`914cb63824f614223b62153c770186e9d46d586e`及报告见唯一status；2026-10-07T06:09:46Z结果独审通过（0 P1/P2），[接收入口](../../docs/evidence/s01/mixed-ab-run/READY.md)已READY、main仍待真实回执；无一致延迟收益结论，原S01-04/05/06验收和未完成TODO保持，不因本局部结果改完整plan完成。

## S01-04 / S01-06 连接等待与聊天响应设计（2026-10-07T12:16:51Z开工）

沿原六TODO推进[最小方法设计](../../docs/evidence/s01/mixed-ab-preparation/pool-wait-design.md)：先在固定main4fdd同负载下对照逐query IPC与中心有界累积，保留pool/SQL/同步节奏；真实conversation轻读与四cancel取用户结果。原数据只证明观察到排队，不将不同分母quantile相减归因。设计列出当前v2领取观测适配缺口、独立生命周期/预算与后继直接验证。两侧128活动fixture加各1合成聊天setup，总258task，是新的未开放预算；旧A/B256/原raw不改。当前DESIGN_READY/NOT_OPEN，不运行实验、不安装、不改产品。ACK/browser/native和完整S01仍开放。

2026-10-07T12:28:56.483Z 方法设计已由chatui01_owner对固定f0f56e80bc4450b4b12f2a1218fefff4ef6e1208独审通过（0 P1/P2），见review；只可进入合法准备，真实运行NOT_OPEN，原六TODO完成状态未变。

2026-10-07T12:37:38.684Z 首片仅新增私有pg-delivery/test，11/11与修后strict0，见[接口](../../docs/evidence/s01/mixed-ab-preparation/pg-delivery-interface.md)。已固定待独审；当前driver未接，v2/chat轻读/取消与新namespace另按原设计继续准备，不把Module通过当实验完成。

2026-10-07T12:40:13.864Z 私有delivery首片source03164654已独审通过，0 P1/P2；完整driver/新实验未接未跑。剩余v2观测、真实chat轻读/取消按已审设计继续，不重跑11绿，主线接收与未来窗口另如实记录。

## 2026-10-07T12:55:31.777835+00:00 方法实施首个消费者片

[已固定接线Interface](../../docs/evidence/s01/mixed-ab-preparation/pg-wiring-interface.md)以原child/driver/reporter贯穿有界交付、同epoch本地phase、当前公开v2 DTO与重放观察。这里只交可独立核验接线，完整recipe仍缺新输出领取/当前production source调用与chat/cancel尾段；原六TODO/性能验收不降低，当前0PG/NOT_OPEN。


2026-10-07 后继实施checkpoint：已审f0f56交付策略设计的真实配方现固定source130c6ec855db850a817312623742cf14e8b45135，见[queue-interface](../../docs/evidence/s01/mixed-ab-preparation/queue-interface.md)。局部6 distinct分轮/strict0仅证明新私有接缝；当前等待独审、完整runtime准备与新输出scope，NOT_OPEN。原稳定TODO与完整ACK/browser/native验收不变。

## S01-06：失败后的独立成本诊断（2026-10-07T14:19:41.736Z）

本次queue窗口O1持续ACK跨度不足、O2按门禁未启；结果忠实性已独审通过，不是容量/优化通过。原4秒跨度、真实取消最终态和UNKNOWN/KEEP不降要求。下一小片仅[固定轨迹观察交付策略成本](../../docs/evidence/s01/mixed-ab-preparation/delivery-strategy-replay-design.md)，复用现pg-delivery/bridge/reporter/OPS14，0PG候选，尚未实施/运行。buffered改变SQL聚合和finish交付时序，因此不称纯IPC隔离；原128验收独立保留。无新大task/新性能窗口/2×2矩阵，Web发布和经理完整fresh资源优先；stable TODO状态不变。

2026-10-07T15:25:09Z 后继小片：上述2048-trace实际已完成并独审，仅支持两交付策略成本；buffered JSON较少、完整耗时及CPU较高。先在既有pg-delivery.finish内消除重复增长prefix编码，保留所有原边界，用直接行为及编码工作量反例验证；[窄接口/输入](../../docs/evidence/s01/mixed-ab-preparation/pg-delivery-chunk-ready.md)。此为普通实现准备，0新实际replay/PG，不改变原128/ACK/cancel验收或任何稳定TODO。

## S01-06：stock initialize/close 小基线候选（2026-10-08T01:16:08.829Z）

沿原S01-06安排[1→2→4设计与候选预算](../../docs/evidence/s01/idle-claim-cost/stock-initialize-design.md)，仅零model/provider初始化及空闲资源/关闭成本，不是128native容量。原128同步burst ACK失败诊断优先；本候选尚无源码、sampler或native窗口。复用既有host/R06/OPS14，数字整树采样方法与scope必须另固定；UNKNOWN/KEEP、ENG原outerFAIL与后续独立cleanup分列。70s/64MiB只是待审候选，本次仅4MiB/10min元数据段。稳定TODO仍三完成三开放。
