# S01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 12:38:35 UTC；唯一128结果已独审，main接收另计 |
| Plan | [plan.md](plan.md) |
| 所属大task | [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | mika |
| 单一status owner / model | status_read / gpt-6-astra；历史 owner mika 保留于下文 |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe |
| Branch | codex/runner-capacity-probe |
| 工作基线 / HEAD | base main1c496835；source 6de928d8092ba8c22ac2222ac7c16af3660be48a；execution 70c92414d3f0fc90b256e857acf64ba3dba35b30；result 64911a3c88488dfdebaa3a678bad659211e29209 |
| 工作树dirty状态 | source/raw冻结；本次仅审批/ready与owner metadata，提交后clean |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED：准备41distinct/strict0；实际128tasks/attempts/sessions，2304events/ACK，8空journal，CLI0/外层14.64s；结果待独审 |
| 已集成main状态 / HEAD | W1/W2与后继计划metadata已集成main/origin32c371d389a913f8dd71c3bd8b98dd0697411256，c86cab三scope零diff；S01P01核心及ES2023兼容修复已独审并集成main d7e1e64e7792f4d1ad4933db042f10f266ad0cca |
| 实现目标 | 64911a3c88488dfdebaa3a678bad659211e29209 |
| 实现范围 | experiments/runner-capacity, docs/evidence/s01, plans/s01-runner-capacity；旧raw/manifest不改，无产品实现写权 |
| 阶段 | M2 |
| 本片段交付阶段 | delivered |
| 优先级 | 4 |
| 当前产出 | 固定64911a3c结果经Mika 2026-10-06 12:37:14 UTC APPROVED，128fixture执行/持久session/ACK/cleanup通过；share耗时UNKNOWN |
| 下一可用交付 | Lead受控接收已审S01小片；events三次UPDATE合并候选先只读，等待独立WT/路径移交 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | APPROVED：result 64911a3c88488dfdebaa3a678bad659211e29209，Mika/gpt-6-astra，2026-10-06 12:37:14 UTC，0P1/P2；限定128fixture结果 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| S01-01 | completed | mika | [research](../../docs/evidence/s01/research.md)：权威来源/head/dirty核验及差距 |
| S01-02 | completed | mika | [合同](../../experiments/runner-capacity/README.md)、[参数](../../experiments/runner-capacity/contract.json) |
| S01-03 | completed | mika | 实验入口/计量/清理已固定9da，smoke及6unit检查通过；W1结果见manifest |
| S01-04 | in-progress | status_read / mika | 旧W1/W2冻结；mixed唯一窗口A16实测部分有效、整体FAIL/B未启动，无补跑。ACK/browser仍未执行 |
| S01-05 | in-progress | architecture_read / Lead | W1/W2结果历史APPROVED；mixed结果6a5961a独审APPROVED仅如实失败；新窗口准备/结果另审 |
| S01-06 | in-progress | 后继独立owner / Mika / Lead | [独立后继status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-attempt-pool/plans/s01-attempt-pool/status.md)：核心已独审并集成main d7e1e64，根检查通过；启动参数及真实provider另计 |

## 历史权限、优先级与事实边界（当前接收见末节）

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

2026-10-06 08:11 UTC 后继已开工：GO/Lead授权S01P01保守并发核心，worker独立WT `runner-attempt-pool` / branch `codex/runner-attempt-pool`、base9c6、现场155494b clean，canonical plan/status/review已就绪。fresh账本08:10:53 available，S01原claim v1 ACTIVE、原三scope不变，S01P01独立claim599454b1 v1 ACTIVE、六scope无重叠。S01-06保持未完成并转in-progress；实际进度只读后继status，不复制其TODO。已桥接Lead登记权威聚合源及全局索引，等待新源聚合展示；本S01沿用07:56已核聚合事实。W1/W2冻结证据、累计预算及原ACK/browser未验收范围不变，0新增运行/模型。架构影响只登记后继runtime调度与持久恢复边界待Lead按实现target更新，本树仍无产品变化。

2026-10-06 08:21 UTC 父计划main接收：Lead明确接收c86cab，owner独立核其为main32c371祖先且原三scope零diff，见[后继链接接收回执](../../docs/evidence/s01/successor-main-receipt.json)。Lead报告registry95已登记S01P01、部署紧随；本人没有再采同一dashboard或重测。本claim v1 ACTIVE/三scope与唯一owner未变。此main事实只覆盖父计划及原实验，不覆盖S01P01尚待固定的实现/独审。

2026-10-06 08:43 UTC 后继独审与下一片段：Mika于08:30批准S01P01主体d655，Lead实际根检查发现测试采用ES2024方法；原owner保留失败、移除局部lib覆盖并改void deferred，Mika于08:39:29独审批准固定48b73544c0e9e66a7061ddb54e003a03b9234bde。末端66fdb0d8d0cecfb996707de7da7ca0a1a3d881ff clean且已push，主线接收和完整根检查仍归Lead；唯一检查/审查事实详见后继status及manifest-es2023，不复制其矩阵。原实验没有新运行，44 tasks/38 attempts/20.925025秒保持不变。

Root已确认S01P02最小入口方向：省略并发参数为1，显式整数1..16；注册容量独立，A2A显式非1须明确拒绝，无效输入在网络之前拒绝。独立树/claim与主线精确基线由Lead协调，尚未领取或实施，不由方案冒称已开工。ACK2仍要求真实loopback代理的到中心前/提交后丢响应边界；browser2必须关闭独有浏览器进程。旧child的lastClaim单变量不能用于新pool并发计量，后继需稳定attempt映射；历史结果不改写。fresh账本08:43:40 available确认本claim v1 ACTIVE且三scope不变。本次仅父状态/质量metadata，等待既有聚合器展示，不重复dashboard采样或工程测试。

2026-10-06 08:51 UTC 后继主线与资源交接：S01P01固定48b73544已进入main/origin d7e1e64e7792f4d1ad4933db042f10f266ad0cca，Lead完整root noEmit0；Mika只读核7source与固定target相等。原owner停写后受runtime thread limit影响无法唤醒，Root指定Mika管理接收；按Lead正式handoff v2→accept v3→status单文件amend v4完成最终metadata，1c438be2d152a7b6b3b2f5a6883852dd4b2d7a7d clean/已push，08:49:27 claim v5 RELEASED，无产品/测试/raw修改。父实验原预算不变，启动入口和个人服务部署未由核心接收推断。08:50:11 fresh账本确认main.ts/configuration.ts已由R05 claim3f2622a4 v1占用，S01P02只读候选等待跨lead范围安排，未take或开工；已发一次接口/范围协调，不抢写。父claim08:50:56复核仍v1 ACTIVE。进度以唯一status供dashboard聚合，不为普通metadata重复发消息或测试。

## 2026-10-06 09:01 UTC 安全停点与后继归属

S01P01独立owner管理收口已完成：唯一分支HEAD `1c438be2d152a7b6b3b2f5a6883852dd4b2d7a7d` 已push/clean；其claim于08:49:27.075Z正式release v5，原树停止写入。父S01自己的3scope仍由本owner合法保留，冻结实验与已用44 tasks/38 attempts、20.925025秒不变；没有新负载/工程测试/provider调用。

GO新大task的用户目标优先：WPF-MATURE-02唯一source为 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/status.md`，owner chatui01_owner；WPF-MATURE-04为 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency/plans/wpf-mature-04-context-transparency/status.md`，owner architecture_read；co-lead均mika。两项是独立大task，S01不是其父级，不在本文件复制其TODO或进度。

S01P02仍未take/实现；所需main入口由R05 owner持有，后继应通过独立配置module及其main接线合同协调，不争夺路径。ACK/browser各2的窗口和方法仍保持未执行。此停点只更新合法owner的事实与大task关联，main集成不等于个人服务或provider并发验收。

## 2026-10-06 09:46 UTC 新阶段接收与准备

status_read / gpt-6-astra 接收 S01 唯一 owner，co-lead mika，所属 FLOW-001、阶段 M2。writer claim `8e4660a6-625f-4ada-8558-20c19b9e23e0` accept v3 已于09:45:53.842Z COMMITTED；独立 scope=[] integration claim 已完成受控 main4391 合入并 release v2。未手工解决冲突，未纳入更新的 main253 F01。回执见[准备证据](../../docs/evidence/s01/mixed-preparation/accept.json)。

新 GO 阶段独立上限40 tasks、60秒含清理、传输加证据64MiB、0provider；本方案固定32 tasks不补跑。旧44 tasks/38 attempts/20.925025秒及W1/W2源码、raw/hash冻结，不续耗旧额度。Mika已批准私有center进程透明Pool观测设计与1×16/4×4两组混合负载；只授权driver实施及纯unit/类型检查，未授权实际PG/HTTP/runner负载。实验仅在`experiments/runner-capacity/mixed/`新增；无产品pool/锁/schema/contract变化，无架构图更新需求。S01P02配置入口另有owner，本实验消费runRunner公开参数，不声称CLI已经部署。

技能：本地find-skills发现并应用clean-code/codebase-design；brainstorming按现有实验的bounded后继给短设计，mika明确批准。命名区分acquisition、transaction elapsed和runner-row query elapsed；观测器独立、保持this/callback/返回值/错误透传，资源与证据有界。尚无新工程测试或真实负载。状态通过唯一status等待现有dashboard聚合。

2026-10-06 10:00 UTC：新driver准备完成，固定前仅10纯unit/strict noEmit验证；最初8观测/预算/stream用例，加2项DB权属/lease/心跳/ACK门禁反例，共10不同用例，不能相加为18。初次类型检查暴露HarnessContext.task类型不声明实际运行时id，现显式guard后绑定claim map；原失败日志保留。center在dynamic import createServer前透明观测Pool，固定pg8.23.1源码hash并核pg-boss同一pg；Node流计数缺失/减少/超对象上界即UNKNOWN失败。窗口6秒与其后最多1500ms settlement分开，均在45+15秒内。

旧W1/W2源/raw及所有既有experiments/runner-capacity、docs/evidence/s01路径相对接收98098354保持逐字节一致；只新增mixed与mixed-preparation。0新tasks/attempts/负载/provider。architecture_read进行固定源码独审，Mika安排后继运行；writer claim v3保留，不部署CLI/个人服务。架构影响仅实验观测，无产品Interface/schema/锁/pool配置变化。

2026-10-06 10:03 UTC固定前：预审所提cleanup阶段预算与CREATE丢ACK已修，新增3个截止行为用例及1个自有流清理用例，现14个不同纯测试/strict noEmit0，旧8/10日志保留不累加。phase截止与UNKNOWN/retained语义见混合合同及quality；没有新负载，真实接线仍未验。10:02:58 fresh账本available确认本owner claim v3 ACTIVE/三scope不变。

2026-10-06 10:04 UTC：mixed准备实现固定 `634926238f749fb1547a5973b521bc6dc5498574`，5文件14纯tests/strict noEmit0绑定当前source；[manifest](../../docs/evidence/s01/mixed-preparation/manifest.json)固定source/raw/readonly字节，当前待architecture_read及Mika独审。未执行真实窗口，状态来源等待现有dashboard聚合；不重复工程验证。

2026-10-06T10:06:36.107948+00:00：mixed准备634获architecture_read独立APPROVED，无P1/P2；Mika独核51项hash/bytes及14/14/strict0一致。只记录metadata，不重测，writer claim v3保留。实际0新增负载/task/attempt/provider，未消费新窗口；下一步必须Mika给唯一windowId及精确execution HEAD。源634冻结，后续metadata不改变其source/raw绑定。

## 2026-10-06 10:15 UTC mixed 唯一窗口结果封存

Mika在准备独审后批准唯一window `mika-s01-mixed-20261006-100634`，执行HEAD在运行前明确修正为clean12154；只执行一次。实际PG/HTTP/fixture runner/outbox运行10,673.1145ms含清理，最终CLI计18,660,992B完整计量、exit1、provider0。固定32任务reservation，实际16个task/attempt；A有16个live/fenced gate与真实adapter重叠、533事件digest/ACK、12 succeeded/4 cancelled、windowComplete/settledByDeadline true，但stop后admission.inFlight保留，整体FAIL，B未启动。原14纯unit/strict0仅准备证据，不是本次实测通过数。

两个自有child正常exit0，自有DB确认无连接后DROP；唯一保留FKye9L工作目录中的未知journal，未删除、未重放。最后claim只有aborted:true错误记录，无确定HTTP响应；raw没有requestId或独立send/stop时刻，不把空assignments或16个已完成DB行冒充assignment:null。根已接收清理与失败事实。无重跑、不补B、不改driver门禁、不消费预留余任务。

[结果报告](../../docs/evidence/s01/mixed-run/report.md)、[最终CLI回执](../../docs/evidence/s01/mixed-run/cli-receipt.json)、[原始冻结hash](../../docs/evidence/s01/mixed-run/raw-freeze.json)、[逐attempt与A窗口分析](../../docs/evidence/s01/mixed-run/analysis.json)。只读复核A中心pool acquisition/transaction/runner-row层级与60样本中31次Lock或blocker正证据，B缺失不能比较拓扑、推纯锁时间或SLO。旧78文件/44tasks/38attempts/20.925025秒完全不变。

本地clean-code结果封存检查完成，质量记录在mixed-run/quality.md。结果待architecture_read独立只读审定，main未接收mixed；唯一status供既有dashboard聚合，待新状态展示，不另写聚合JSON。Mika将另派正常停止领取并有界排空claim的S01P03独立WT/scope，尚未开工，原S01保留writer claim v3做结果收口。

2026-10-06 10:15 UTC：结果target `6a5961a0d815113bba7cea149bc08ca07fdd128a` 固定并核clean；[结果manifest](../../docs/evidence/s01/mixed-run/manifest.json)绑定19source/16readonly/8raw/7support，旧78文件不变。整体FAIL、未知journal保留，交architecture_read独审。追加metadata不改变执行12154或原raw；本次归档保守重复计量上界25,625,526B，含64KiB metadata预留。没有再运行负载或工程测试。

2026-10-06 10:16 UTC：architecture_read于10:15:58Z只读APPROVED结果target6a5961a，0 P1/P2，仅批准如实失败证据；runVerdict仍FAIL。19/16/8/7绑定、78legacy、实际80B journal与A层级统计均独核。见[独审回执](../../docs/evidence/s01/mixed-run/independent-review.json)。本片待Lead集成，原始raw/source不变、0重测；之前封存metadata的10:18手填时间已校正为10:15，无运行时间或raw变更。后继S01P03已由Mika明确派工，独立runner-graceful-stop WT/claim，不继承本树scope。

2026-10-06T10:42:12.735Z：GO授权P03已main后的独立一次零模型混合窗口，Mika只派当前准备，未点名执行。fresh claim8e4660a6 v3 active；scope=[] integration已take/release，受控合main0cee→86297277，无冲突且原S01三scope零diff。新增[合同](../../docs/evidence/s01/mixed-after-drain-preparation/README.md)，132旧文件逐字固定；原FKye9L journal未读取/操作。原33/62等工程与14纯检查不是本次运行计数，新窗口0tasks/0PG/0HTTP/0provider。架构影响仅实验输入身份及证据目录，生产pool/锁/contract不改；共享架构图无需新产品更新。原独审结果等待Lead历史接收与本次新准备分开。

2026-10-06T10:44:15.659Z：Mika批准最窄run identity适配，driver/main小diff与新identity/test完成；10不同纯检查+strict0，原14不重跑，0实际窗口。130旧文件当前仍逐字一致，仅两份driver输入源码按新target适配，旧固定634/121/6a596可重现。新manifest将绑定21实验source、新raw及固定main/client/P03输入；source/raw固定后交Mika独审，不沿用旧准备批准。

2026-10-06T10:45:02.650Z：新窗口实现target `51541b0cad73dcad32c7374dc87d631f0b9a8432` 已固定，[manifest](../../docs/evidence/s01/mixed-after-drain-preparation/manifest.json)绑定21source/21readonly/8raw/9support（SHA 32965654f0e3960302ec66ed9492ec20ba00abaa2a2ffa19f27fe50ced305b11）。readonly逐字=固定main0cee，P03两源=a677；旧17实验源未改、2源输入适配+2新源，原raw/manifest冻结。源码/检查不再改动，提交后交Mika正式独审；没有已授权windowId、没有新真实调用。

2026-10-06T10:51:09.061Z：Mika点名唯一新窗口mika-s01-after-drain-20261006-104557，执行前fresh claim8e4660a6 v3 active/HEAD5ea clean；仅一次已完成，CLI exit0。32真实task/attempt，两组各12成功4取消；1027事件逐项seq/digest/fence/accepted绑定，5journal全null/[]。耗时19271.849875ms含清理/最后证据写入，完整计量36092931B；两个自有child自然0、唯一新DB dropped、新workdir removed、无本次retained。保留1次A settlement heartbeat错误：无status/错误类/attemptId，原因unknown，不能写零HTTP错误。实际正常adapter重叠最小6000.02025/6000.055792ms；timer标记略早单独记录。见[报告](../../docs/evidence/s01/mixed-after-drain-run/report.md)和[归档预算](../../docs/evidence/s01/mixed-after-drain-run/archive-budget.json)。旧FAIL/raw/FKye9L不动，无重跑/补跑，C串行占用已交还Mika。结果待独审，不作>100执行/SLO或严格speedup。

2026-10-06T10:51:52.971Z：固定新PASS结果target `339147cb015fdd40ed1cedbc66aca26e736b3ee7`；[result manifest](../../docs/evidence/s01/mixed-after-drain-run/manifest.json)绑定21source/21readonly/8raw/7support，SHA d2e7debddc741a69ad940315cd5b52d39d3e35b8c20078e162fad65a6baa2d2a，旧515准备/5ea执行与新339结果明确分开。源/raw已冻结，待独立只读结果review，不重跑。

2026-10-06 10:54:25 UTC：Mika独立只读APPROVED固定339147cb，57项Git/WT/hash/bytes一致；实际计量与归档保守上界成立，1heartbeat未知错误及timer/actual overlap区别保留。见[独审回执](../../docs/evidence/s01/mixed-after-drain-run/independent-review.json)。本片交付delivered，原S01其他验收TODO、>100实际容量/ACK/browser/真实provider及完整未知恢复不勾完。下一产品片S01P04按FLOW-001两层在独立worktree/claim开展，不在本树改产品；本source/raw停止修改，writer v3仍保留到Lead明确交接。当前main c450c2d未作为新实验result已集成的证明。

## 2026-10-06 12:08:19 UTC REQ-18 后继准备

GO授权唯一128task/attempt窗口 `s01-128-after-light-reads-once`，当前仅设计/实现准备，实际调用0；须独立固定source/profile/budget/cleanup review和Mika具体运行门禁。fresh writer8e4660a6-625f-4ada-8558-20c19b9e23e0 v3 ACTIVE，三scope不变；integration bb7d2d35 v1 take后无冲突合main1c496835至07c8a0b，旧三scope零diff，并已v2 release。详见[Interface](../../docs/evidence/s01/mixed-128-preparation/interface.md)与[领取观察](../../docs/evidence/s01/mixed-128-preparation/owner-observation.json)。

本地find-skills/brainstorming/clean-code/codebase-design应用于固定profile复用和资源责任，路径/hash见skills.json；不安装、0工程测试/PG负载/provider。一个runner child内8 runtime×16，独立OS进程数另报；128真实fixture session须逐项持久绑定，不代表nativeSDK/model或conversation对象。旧172 Git文件已冻结，旧unknown journal未操作；架构影响仅实验私有输入/观测，无产品API/池/锁/调度改变。后续检查证据等待固定实现，当前无新通过声明。

## 2026-10-06 12:28:43 UTC 128准备固定交审

实现 `6de928d8092ba8c22ac2222ac7c16af3660be48a`，生产输入固定main `1c4968354dabce1e6748f3301a2e6eecd33e77d4`（含P04与B01），当前claim8e4660a6 v3 ACTIVE、三scope未变；[manifest](../../docs/evidence/s01/mixed-128-preparation/manifest.json) SHA `30264126da6460d25fda946944062efa78779f3ac164f3aa064020fe66181f35`。绑定26source/27readonly/42raw/10support，readonly逐字=base，另6runtime与172历史Git绑定核符；旧raw/support/manifest及保留journal不变。

最终9文件41/41不同纯checks（原直接24+新17）及局部strict0，初始4red/类型失败和40项中间记录保留，不重复累计；[raw](../../docs/evidence/s01/mixed-128-preparation/review-candidate.stdout)与[类型回执](../../docs/evidence/s01/mixed-128-preparation/review-types-receipt.json)。保守样本跨度用末query开始减首query结束，慢查询包络反例已测。工程检查只有fake与readonly Git，无真实PG/HTTP/center/runner/SDK/provider容量调用。

新window仍NOT_OPEN；预算180秒含最终CLI/256MiB/128task与attempt硬上限不变。实际运行时外层time独立记录spawn/import到exit，超180即FAIL；不把driver内部elapsed冒充完整外层时长。源码/raw冻结等待Mika独审，不追main、不重测；dashboard只更新此唯一status，等待既有聚合。未完成原ACK/browser/真实provider/完整unknown恢复验收。

2026-10-06 12:30:27 UTC：Mika正式独审APPROVED source6de928d/packetffee77ca，105绑定/6runtime/172历史及41distinct/strict0证据核符，0P1/P2，无review重测。两个预读样本证明问题已在固定源码和反例关闭。fresh claim v3 ACTIVE且新output absent；当前仅审批metadata，不代表执行OPEN。源码/raw不动，待明确executionHEAD门禁。

2026-10-06 12:34:48 UTC：唯一128窗口已于12:31:13.682022Z→12:31:28.419308Z结束，CLI0/real14.64s/完整88,323,950B；全库128task/attempt/session、2304逐项ACK事件、128成功、8空journal、两个自有child自然0/DB absent/新root删除，无本次retained。实际6秒覆盖、30保守DB样本、1536窗内messageACK和独立外层时长已离线核；见[报告](../../docs/evidence/s01/mixed-128-run/report.md)。FOR SHARE实际SQL与classifier精确列不匹配，row elapsed为UNKNOWN，0分类不作无锁；不改原driver、不补测。旧raw/journal不动，结果正在固定，只做封存/独审，无第二window。

2026-10-06 12:35:33 UTC：结果target `64911a3c88488dfdebaa3a678bad659211e29209` 固定，[manifest](../../docs/evidence/s01/mixed-128-run/manifest.json) SHA `3c66deb37fbcc3163093cb70857b651c6275346be5b82788d825fb90ae92328e`，26source/27readonly/9raw/6support/2preparation绑定，source=6de=70c=target=WT，27readonly=固定main1c，另6runtime/172历史Git核符。独立结果review待Mika；原运行5raw/外壳CLI/time与receipt不可改写，report明确共享锁分类缺失而不影响独立容量证明边界。完整保守归档上界118,431,893B<256MiB。

2026-10-06 12:38:35 UTC：结果独审APPROVED `64911a3c88488dfdebaa3a678bad659211e29209`，Mika/Astra精确12:37:14 UTC，70绑定与128身份/1536窗内ACK/2304事件/30样本/8journal/完整cleanup及外层时间独立核符。见[审批](../../docs/evidence/s01/mixed-128-run/independent-review.json)与[接收入口](../../docs/evidence/s01/mixed-128-run/integration-ready.md)。原archive-budget是早期快照并预留尾部，独审另核118,449,471B保守总上界，不重写原snapshot。原S01其他验收保持开放；新性能候选仅只读，F01仍占events.ts，当前未claim/开工/实际运行。
