# S01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 07:48 UTC；W1/W2已main6426，slot提案独立后继 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | mika / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe |
| Branch | codex/runner-capacity-probe |
| 工作基线 / HEAD | base 115b0dbdfa02db5483f9e9699852682ce699633c；W2源码target 2ab7967f2eb808fecd1205f7552a119eee8e0b36，metadata后继单列 |
| 工作树dirty状态 | 固定结果0dac4b92747db5a3c8ed2dc25301e7cbecc2e8bf clean，后继仅独审/状态/报告说明metadata |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED 2ab：11纯统计/预算/参数tests，noEmit0；W2实跑12tasks/12attempts且正常清理，结果0dac独审APPROVED |
| 已集成main状态 / HEAD | W1/W2已集成main/origin6426b44cd32d10216141af13ecfa83b8879025fb，W2交接5504三scope零diff；slot提案未集成 |
| 实现目标 | 2ab7967f2eb808fecd1205f7552a119eee8e0b36 |
| 实现范围 | experiments/runner-capacity |
| 阶段 | M2 |
| 本片段交付阶段 | delivered |
| 优先级 | 4 |
| 当前产出 | W2测量已独审并集成main；slot提案已补未知claim恢复缺口 |
| 下一可用交付 | 协调后继owner：保守停领取的局部并发，或先补窄claim回执接口 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，W2准备2ab与结果0dac均APPROVED；W1已批准并集成 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| S01-01 | completed | mika | [research](../../docs/evidence/s01/research.md)：权威来源/head/dirty核验及差距 |
| S01-02 | completed | mika | [合同](../../experiments/runner-capacity/README.md)、[参数](../../experiments/runner-capacity/contract.json) |
| S01-03 | completed | mika | 实验入口/计量/清理已固定9da，smoke及6unit检查通过；W1结果见manifest |
| S01-04 | in-progress | mika / Lead | W1首个128空会话+4runner/16task场景已运行并清理；可选control16/control12未运行，待证据决定 |
| S01-05 | in-progress | 独立reviewer / Lead | W1/W2结果均独审APPROVED并main6426；完整S01后继ACK/browser仍开放 |
| S01-06 | pending | 后继owner待Lead协调 | [既有plan内最小slot建议](plan.md)：0调用只读提案；CHAT08 runtime/outbox在用，未领取产品实现；真实provider另计 |

## 权限、优先级与事实边界

claim `8e4660a6-625f-4ada-8558-20c19b9e23e0` v1 ACTIVE，06:22:33.774Z；[回执](../../docs/evidence/s01/claim-receipt.json)。只写3个新目录，无共享生产写权。K03关键验证与独审优先，本人负责S01，不新增agent。W1与W2许可均已执行、清理并释放；没有新的运行授权。

W1证明本机四个独立fixture runner可同时执行该固定负载，没有SLO、模型容量或真实provider成本结论。128背景会话对象与 native session、实际在途 attempts 各自计数。生产源码可能串行是源码观察，须由实验给出有效容量，不自动派生优化收益。

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

2026-10-06 07:11 UTC W1独立结果审查APPROVED target9e10e09，无P1/P2，报告补充poll50/默认500ms、读端小样本和总时长非吞吐窗口。冻结manifest/raw未改，独审回执独立保存。本片段已审待main接收，完整S01仍开放；可选12task declared4优先建议待GO决定，0新增运行。架构影响：仅实验消费者与证据，无产品接口/DB/生命周期变更。

2026-10-06 07:12 UTC dashboard实读：权威S01 source live/stale=false，9cda03662783c58ce606958d68ed7526d8847179 clean，review approved、implementation unchanged、issues=[]；首窗片段integration，等待Lead主线接收。见[当前dashboard回执](../../docs/evidence/s01/w1-dashboard-receipt.json)。原子账本07:11实读claim v1仍ACTIVE，scope与唯一owner未变；本段之后继续保留后继协调权，不释放或启动新负载。

2026-10-06 07:16 UTC W2准备启动：Goal Owner明确批准仅准备declared4/12，继续同WT/claim/base115b；root唯一writer，worker转独立CHAT06P01。按声明capacity校验且保留实际peak；修复claim未emit/未知结果的保守预算扣额。W1已限定验收并交Lead接收2784473，新源码不沿用旧批准。0新增smoke/负载/模型，纯unit与noEmit检查允许；固定源码独审后申请≤30秒窗口。S01-04继续in-progress。

2026-10-06 07:19 UTC 实质进展：W1获MAIN_ACCEPTED30b，owner核2784473祖先且三scope对main零diff，见w1-main-receipt.json。W2固定场景解析/真实注册容量与per-runner峰值、未知attempt保守预算已实现；新6预算用例先复现5失败，再与统计/参数共11tests通过，noEmit0（最终源码11pass/noEmit0）。未创建任何新PG或负载。新源码待固定与独审；W1 main事实不覆盖W2。

2026-10-06 07:26 UTC W2独审完成：独立worker限定APPROVED2ab，无P1/P2，源码/25hash与旧raw边界核验。Mika向GO申请≤30秒阶段，CHAT06P01尚准备时不拖S01；常驻服务刷新与测量由GO错开。当前0新负载/模型，原64/64/180秒/64MiB及实际32/26未变。

2026-10-06 07:27 UTC dashboard实读：S01 a22329e clean、approved/unchanged/current、live且stale=false、issues=[]；人类摘要为准备已独审、协调实际测量窗口。见[W2聚合回执](../../docs/evidence/s01/w2-approved-dashboard.json)。

2026-10-06 07:33 UTC 窗口阻塞：两次固定起点预约因最终GO未及时到达而不启动，后续07:32:30租约到期也未收到最终GO；0新tasks/attempts/PG，见w2-window-coordination.json。解除条件为明确GO且剩余静默期足够完整30秒，责任Mika协调GO；不用缩短清理或补跑绕行。独立工作为CHAT06P01源码/纯验证，worker已恢复必要检查；S01源码固定2ab不变。

2026-10-06 07:37 UTC W2实质交付：条件GO/三队全ACK后07:36:13.218→21.191完成declared4/12一次运行并清理，已QUIET_RELEASE。注册容量4、保守attempt峰值1/1、adapter/tool峰值1，12任务全部通过；结果待独审，不能作加速比/SLO。累计44tasks/38attempts/20.925025秒stage，0模型；原raw保留，W2未集成main。下一独立工作为既有plan内的0调用有界slot方案，与CHAT08源码owner界限明确，CHAT06P01测量入口仍优先。

2026-10-06 07:44 UTC W2结果独审APPROVED0dac，无P1/P2。原raw/manifest保持hash；两项P3观察边界已补，首次PG空application_name连接归unknown，停止阶段一次claim失败与72事件ACK区分。累计44/38与20.925025秒未变，0重跑。claim v1 ACTIVE同scope已复核；后继只记录批准/交main与0调用slot方案，dashboard待本次状态聚合。

2026-10-06 07:44 UTC dashboard确认：权威S01 source live/stale=false、0bd16d4 clean，delivery integration、review approved、implementation unchanged/current、issues=[]；W2 main仍not-contained。见[w2-result-dashboard.json](../../docs/evidence/s01/w2-result-dashboard.json)。metadata交接后不重复轮询或运行。

2026-10-06 07:46 UTC S01-06只读提案已写回原plan：一个admission/recovery owner+有限attempt Map，明确注册/执行/unknown占用、session排他、outbox与FinalProposalJournal、maintenance/host与单attempt失败边界。CHAT08权威status/head/dirty及账本核验，未写其scope、未启动测试/负载。W2交接固定止于5504b16，proposal后继不混作W2结果批准；CHAT06P01已准备APPROVED，实际矩阵等SVC操作结束条件。

2026-10-06 07:48 UTC W2 MAIN_ACCEPTED：Lead明确main/origin6426已接收5504；owner核5504为祖先、三scope对main零diff，见[w2-main-receipt.json](../../docs/evidence/s01/w2-main-receipt.json)。不重跑、不把cc741只读提案混入批准。GO已认可提案总体方向但要求补claim丢失回执的真实接口缺口；完成CHAT06结果审查后补，后继实现未授权/未领取。

2026-10-06 07:51 UTC GO只读review修正已落实原plan：当前claim空body/无requestId、丢失回执无可靠公开恢复接口，原“现有恢复协议核实”撤回。首片建议未知claim停admission且保留占用、已知attempt继续；真正自动恢复需事务绑定稳定requestId与原结果的窄接口，未领取产品写权/未预设新表。CHAT06实际结果已独审APPROVED160b，0新增运行；此提案修正待GO接收，不与W2结果或main事实混淆。

2026-10-06 07:55 UTC proposal边界复核：worker只读fc5351未见P1/P2；非阻断补充已纳入：claim发送前持久化in-flight意图，确定响应才清除，重启遗留意图保守unknown，防止提交后/记unknown前崩溃漏记。没有中心回执身份仍不能自动恢复。此建议未实现、不覆盖CHAT08写权。CHAT06P02已由Lead正式解锁给原worker新WT/take，S01后继产品实现仍未领取。

2026-10-06 07:56 UTC main聚合核验：单次snapshot显示S01权威834ffb6 clean/source live/stale=false、delivered/approved/unchanged/current、issues=[]；main当前84fdece仍ancestor包含已审2ab且scopeEqual=true，见[w2-main-dashboard.json](../../docs/evidence/s01/w2-main-dashboard.json)。后继slot提案仍独立metadata，不能冒称生产实现；不再重复聚合或运行。
