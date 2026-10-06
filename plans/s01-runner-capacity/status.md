# S01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 07:05 UTC；生产基线115b |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | mika / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe |
| Branch | codex/runner-capacity-probe |
| 工作基线 / HEAD | base 115b0dbdfa02db5483f9e9699852682ce699633c；正式入口target 9da9de1b6778afec5219e55f39b53b365c8cf900，metadata后继单列 |
| 工作树dirty状态 | 仅W1结果与状态待提交，源码9da未变 |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED 9da9de1b6778afec5219e55f39b53b365c8cf900：6纯统计/预算unit测试，noEmit0；仅运行准备验证，尚无gate/formal数据库任务 |
| 已集成main状态 / HEAD | 未集成；最近核验main115b0dbdfa02db5483f9e9699852682ce699633c |
| 实现目标 | 9da9de1b6778afec5219e55f39b53b365c8cf900 |
| 实现范围 | experiments/runner-capacity |
| 阶段 | M2 |
| 本片段交付阶段 | review |
| 优先级 | 4 |
| 当前产出 | 首个四进程测量已完成并清理，正在独立核对事件与计量结论 |
| 下一可用交付 | 交付首个窗口的独立结果审查，再决定是否运行有用的对照或故障片段 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，9da准备代码已APPROVED；W1结果待独立review，不宣称容量验收 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| S01-01 | completed | mika | [research](../../docs/evidence/s01/research.md)：权威来源/head/dirty核验及差距 |
| S01-02 | completed | mika | [合同](../../experiments/runner-capacity/README.md)、[参数](../../experiments/runner-capacity/contract.json) |
| S01-03 | completed | mika | 实验入口/计量/清理已固定9da，smoke及6unit检查通过；W1结果见manifest |
| S01-04 | in-progress | mika / Lead | W1首个128空会话+4runner/16task场景已运行并清理；可选control16/control12未运行，待证据决定 |
| S01-05 | in-progress | 独立reviewer | 准备代码APPROVED9da；W1固定结果9e10e09独审中，main尚未接收 |
| S01-06 | pending | 后继owner | 真实provider与更大并发未包含 |

## 权限、优先级与事实边界

claim `8e4660a6-625f-4ada-8558-20c19b9e23e0` v1 ACTIVE，06:22:33.774Z；[回执](../../docs/evidence/s01/claim-receipt.json)。只写3个新目录，无共享生产写权。K03关键验证与独审优先，本人负责S01，不新增agent。正式窗口未领取；不因无窗口将独立源码准备误记阻塞。

仅实验合同，没有能力通过、SLO、模型容量或真实provider成本结论。128背景会话对象与 native session、实际在途 attempts 各自计数。生产源码可能串行是源码观察，须由实验给出有效容量，不自动派生优化收益。

## Dashboard 同步

唯一手填事实源为本文件。Lead已在main a26a登记77 sources；本人06:38实读4320，本任务live、stale=false、issues=[]。不手改聚合JSON。架构无产品变化，后续若发现产品瓶颈交独立owner。

06:32安全停点：K03已交完整固定target，Mika优先独审；S01没有运行smoke/负载或调用模型。合同方法反馈明确读循环single-flight及总时限含清理，草稿已用await循环并为清理留10秒，仍待运行验证。

2026-10-06 预算重分配：Goal Owner明确批准一次最多4 tasks/attempts复核；smoke总8（4已用+4待用），可选声明capacity4对照16→12，其余不变、总64。第二轮若失败停止重跑；正式窗口未授权。首轮证据 docs/evidence/s01/smoke-first/result.json 原封保留，4.33秒；3个自有进程exit0、DB remaining=[]、pendingOutbox=[]。缺少attempt.created_at列，改首次claim初始lease反推区间并标毫秒精度，不能把第一次结果改为通过。

2026-10-06 06:43 UTC 修复复核：固定53c8713，smoke-repair整体PASS、2.821秒含清理，原smoke-first整体FAIL不变。已使用8/8功能smoke任务；不再重跑。总64额度余56，后继正式16+16+12、gate8、ACK2、browser2未运行。独立worker只读复核中，产品源码无变化。

2026-10-06 06:44 UTC 独立review完成：worker只读APPROVED target65d7a57；无P1/P2。功能片段已交付但main未集成；完整S01开放TODO不勾完。正式后继仍需实现与具体运行窗口。

2026-10-06 06:46 UTC 正式入口开工：Mika同一权威worktree/claim v1，沿用本任务find-skills与clean-code/codebase-design方法。保留smoke批准记录，新增源码不沿用批准；worker并行只读核真实字段/分页/计量界限。正式运行尚无窗口。

2026-10-06 06:51 UTC 正式入口实质进展：新增场景/统计module、128会话分页/16预受理task/四进程共同放行、96runner/80timeline/96workspace分层校验、单循环轻读/PG观察/区间峰值。3统计测试通过、noEmit0，未启动负载。准备提交只读review；协议超领gate将作同窗口前置，仍未实现。旧smoke批准target不覆盖新源码。

2026-10-06 06:54 UTC：正式c32d4d1入口已交独立worker只读review；同时新增8任务protocol gate草稿，使用8个并发HTTP claim竞争capacity2，真实DB核恰好2独有attempt，再用正式completed(cancelled)/owner cancel收尾，不执行adapter或模型。gate noEmit0；未运行。新代码不能沿用smoke approval，窗口未领取。

2026-10-06 06:58 UTC：两项P2已修，6unit tests/noEmit0；运行入口统一总64任务/attempts及180秒预算与同scenario不重跑，缺完成receipt时failclosed。正式要求先成功gate。尚未创建新的DB/task/进程，窗口申请待固定入口复审。

2026-10-06 07:01 UTC：运行准备独审APPROVED。待协调具体窗口；Mika为解阻责任人，向GO回固定target、60秒总窗、独有DB/PID正常清理。无窗口时可做只读结果报告模板/后继方法核查，不能启动负载。历史smoke8已用，计划本窗再24 tasks，累计最多32/64；0模型。

2026-10-06T07:05:09.162788+00:00 W1实质交付：gate8tasks/2attempts，formal16tasks/16attempts；结果failure=null、完整清理，实测attempt峰值4但结果待独审。累计32tasks/26attempts，余32task原分配未动；0模型。原2份smoke失败/修复证据原样保留；本窗raw已写，生产未变。
