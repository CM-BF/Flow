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
| 容量与未知结果 | Map的执行数、中心未completed的占用和注册capacity分别观测。execute Promise结束/SDK关闭/confirmed-final receipt都不能冒充completion ACK；uncertain仍可能占中心容量。claim未知结果不为填槽立即重试成新执行，按现有租约/恢复协议核实。 |
| 会话与状态隔离 | 中心resumeSessionId/active_task_id原子排他与saveSession再验证保持。每attempt独有AttemptControl、EventOutbox、decision Map、steering host/tail/session；继续按baseUrl digest和attempt digest分目录，不共享可变会话上下文。 |
| outbox与final proposal | replay与CHAT08 FinalProposalJournal恢复只有一个owner；活跃attempt不被扫描重放/删除。未知proposal只查询原proposal状态，不能重送native输入、合成completed或提前释放session。 |
| 停止与maintenance | draining/maintenance先停新领取，收束全部已起attempt；hold的active=0含uncertain占用。主abort/auth拒绝/EventStorageError按host失败处理，停止admission并等待各attempt清理，不能Promise.all首reject后遗弃其它心跳/SDK。 |
| 单attempt故障 | adapter失败、取消或ownership-lost只影响该attempt的执行；其他合法attempt继续。共享adapter对象是否可重入要逐个核对，不能由fixture可并行推断任意provider adapter安全。 |

建议独立验收片段：先用受控barrier验证一个进程limit4确实有四个执行重叠且不超限；再验证单attempt失败/取消不牵连其余槽、全局停止可收束、同session互斥、pending/live outbox不竞争、unknown完成/claim不重复执行及maintenance不误报可hold。直接测runtime/outbox与配置入口和真实中心claim/事件消费者；若公共契约、SQL或资源生命周期有变，显式扩入相关验证。fixture并发测试仍不等于真实模型吞吐或成本批准。

所有权输入：worker只读采样CHAT08权威WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/native-active-steering`，branch `codex/native-active-steering`，HEAD005e042994e61a15044c3825c533388776a21371，现场dirty、最终target UNKNOWN；status07:38:30由runner_owner负责，claim2f7b66e3 v2 ACTIVE已在账本核对，范围含runtime/outbox/active-steering。该工作树正在引入FinalProposalJournal，不能把移动中的源码当已审固定输入。Mika只写本S01提案，未领取或修改共享生产源码。解除实现阻塞条件：ExecutionLead与CHAT08 owner先固定接口/成果并明确新owner、独立worktree、原子scope交接，再选择最小实现任务；不先release抢占。

方法改进：少量功能峰值验收默认专用DB、动态端口、自有进程及实际背景负载记录，不反复暂停全队只取少量延迟样本。严格性能比较另约条件一致的测量窗口；记录观察开销与样本量，不由本提案推导百分比收益。CHAT06P01入口/实际矩阵优先于此建议；S01-06保持pending，因为提案不是产品实现或验收。
