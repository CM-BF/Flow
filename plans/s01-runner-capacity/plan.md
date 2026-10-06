# S01 确定性 Runner 容量验证

创建/更新：2026-10-06 07:20 UTC。状态 in-progress；owner Mika / gpt-6-astra。Goal Owner 已批准最小实验方向。权威 worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe`，branch `codex/runner-capacity-probe`；已审主线基线 `115b0dbdfa02db5483f9e9699852682ce699633c`。

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
