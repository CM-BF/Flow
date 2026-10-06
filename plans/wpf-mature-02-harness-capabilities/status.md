# WPF-MATURE-02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 11:48:27 UTC / 2026-10-06 10:44:29 UTC（main21e0目录接收逐blob已核；本树仍基于受控main41315b） |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-02](plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities |
| Branch | codex/claude-codex-capabilities |
| 工作基线 / HEAD | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7；受控main41315b / 3636614f3850d7eb9ca63a42c01ea0d95df19db2（v3源码；候选packet与metadata HEAD由Git核） |
| 工作树dirty状态 | d8038d3ab4b8e58fbe30a19e7135f457eb4cd958结果提交后clean；本次仅正式结果独审metadata，最终HEAD由Git核。 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | delivered |
| 检查状态 | C_FD_V3_WINDOW_STOPPED（1编译/2目标，control已报告/profile-regular SIGABRT无报告；measurement=false、cleanup/accounting=true、CLI1）； C_FD_V3_LOCAL_PASS（28通过/16未选，9新+19直接；Node24惰性import/3语法0，新增实际compile/target0）； C_FD_V2_WINDOW_STOPPED（1编译/2目标，control已报告/profile SIGABRT/第三NOT_RUN；measurement=false、cleanup/accounting=true、CLI1）；C_FD_V2_LOCAL_PASS（26/26受影响项，9未选；Node24惰性import/3语法通过，历史检查时新增实际运行0）；C_FD_WINDOW_STOPPED（1编译exit0/0目标，cleanup=true，measurement=false/accounting=unknown，CLI1）；C_HOST_LOCAL_PASS（20 distinct零目标检查，分18+1+1，Node24惰性import/5语法通过）；CATALOG_LOCAL_PASS（33 distinct/strict0，分次证据）；DIAGNOSTIC_COMPLETE / CANARY_FAILED：一次batch2子进程，控制40bytes精确；canary SIGABRT/parent stderr0bytes；282.794417ms、清理完成。原工程检查未重跑 |
| 已集成main状态 / HEAD | 目录本片delivered：main21e0a56c4b2b65a04a1e8d510a9d132e77c3894b，4源=c9/测试=a761已逐blob核；未重新merge本树。R06五源/薄consumer仍待Lead集成；不代表个人服务部署 |
| 实现目标 | 3636614f3850d7eb9ca63a42c01ea0d95df19db2 |
| 实现范围 | fd-canary/host.mjs、execute-reviewed.mjs、host.test.ts；自身fd-canary-v3证据；C/profile/schema/command/report/R06冻结 |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 原生配置目录已交付；普通文件stdio对照已执行，父进程确认文件身份，但受限目标仍异常退出且无报告。清理和证据持久化完成，独审确认失败结果记录准确；未证明隔离成功。 |
| 下一可用交付 | 本次失败结果已交付；既有已审R06与薄入口可独立集成。 |
| 当前阻塞 | ACTIVE: socket与普通文件对照的受限目标均异常退出且无报告，原因仍未知；窗口已消费，真实Codex目录仍缺隔离验证。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：v3结果d8038d3a faithful FAIL APPROVED（architecture_read，2026-10-06 11:45:46 UTC，0P1/P2）；v3组合a10b4fae APPROVED（architecture_read，2026-10-06 11:38:34 UTC，0P1/P2）；结果6b397a58 faithful incomplete/FAIL APPROVED（architecture_read，11:30:14 UTC，0P1/P2）；当前v2候选851fd8c7 APPROVED（Mika，2026-10-06 11:20:49 UTC，0P1/P2）；旧结果6d1d9758 faithful FAIL APPROVED（Mika，11:11:14 UTC）；旧组合cf69dddf APPROVED；C三源72203208静态APPROVED；目录c9c6e891 APPROVED；test-only清理delta a761941f APPROVED；既有R06/薄consumer已审，诊断结果仅faithful FAIL evidence APPROVED |
| 已审语义片段 | 0d0524c3439363d1fe60aad63f62817ba51fa2a5，历史27/27且独审APPROVED；旧manifest/raw不变，final算法副本现由薄入口替代 |
| 架构影响 | 目录Module新增versioned reader/严格DTO，既有挂载与存储不变；R06历史private sink已审，process owner不变。最终target架构更新待Mika/ExecutionLead集成。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-02-01 | completed | chatui01_owner | [领取回执](../../docs/evidence/wpf-mature-02/take-receipt.json)，固定基线/计划/来源登记 |
| WPF-MATURE-02-02 | completed | chatui01_owner | [manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)，27/27本地行为检查；status_read独审APPROVED；未集成 |
| WPF-MATURE-02-03 | blocked | chatui01_owner | 唯一新batch已封存：2child、控制成功、原profile SIGABRT/空stderr，cleanup完成；实际catalog仍blocked，不再启动诊断child；02-04目录实现已独立交审 |
| WPF-MATURE-02-04 | in-progress | chatui01_owner | 已接入独审通过的生产投影，薄入口27/27且独审APPROVED，待集成；[原生配置目录设计](../../docs/evidence/wpf-mature-02/native-catalog-seam.md)已实现首个目录合同/reader/routes并局部验证，c9c6e891已独审APPROVED；client/Web与共享能力全链路尚未完成 |
| WPF-MATURE-02-05 | pending | d01（Web子任务owner） | 按本大task接口独立交付，尚未获得本task跨端验收证据 |
| WPF-MATURE-02-06 | pending | chatui01_owner | 真实续接/账号/取消恢复未验收 |
| WPF-MATURE-02-07 | in-progress | chatui01_owner | 纯语义固定target已独审通过，待集成；后继隔离片另审 |
| WPF-MATURE-02-08 | pending | chatui01_owner | 完整目标未验收 |
| WPF-MATURE-02-09 | pending | R05共享owner / d01 | 下一条配置可变与历史/当前/队列冻结分离；CAS/未知ACK/恢复/跨harness，04测量失效，见唯一interface |

## 跨lead接口与handoff

唯一接口请求：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05共享host/main/config/contracts及生产transport/adapter apps/runner/src/codex由ExecutionLead/assignment_review及其runner worker维护；R06 runner_owner独占transport与进程生命周期；本owner仅固定schema/模型事实与已解码实验conformance，Web d01挂本bigplan。初始3个scope之外，现claim v4包含历史5个R06文件与当前4个目录合同/领域文件（store.ts已停写交回）；当前receipt见native-catalog报告，client/index不在范围。

## Dashboard同步与限制

本status是唯一手填事实源。已只读核main1737cd6a5c8bbb1d5793325ee924802bfbe2a2e9 registry将本task映射到此权威树/status；这不证明4320服务已刷新。claim 0dd97484-f0ce-4738-8075-505bd5e2541a v4 ACTIVE（amend 10:39:02.809 UTC，仅移除store.ts）；无真实app-server/auth/模型/外部网络执行；唯一自有loopback合成运行见下段。目录schema不是账号或模型可用证明；首片不替代整体目标。

## 本片验证与后继

[conformance manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)绑定6源码/README文件、29份固定schema及27项raw。原语义检查未运行R06组合、真实Codex、账号、模型或Web检查；后续唯一合成组合失败另列。隔离候选[方案](../../docs/evidence/wpf-mature-02/isolated-run-plan.md)缺canary证据，由Mika审路径后才可能启动。生产架构target归R05/R06，当前仅实验模块，无main运行结构变动。

## 隔离后继片段证据

[静态manifest](../../docs/evidence/wpf-mature-02/isolation/manifest.json)独立于已审语义manifest，绑定profile、2脚本、README、bootstrap/R06输入及静态检查。固定R06 a239b14/main e785a29仅复用其唯一transport；历史静态时点未运行组合；随后唯一失败运行见下段。控制目录保留0700，防止把POSIX只读mode的拒绝误当Seatbelt证据；所有实际macOS边界仍未证。

## 已封存的一次隔离运行结果

[运行报告](../../docs/evidence/wpf-mature-02/isolation/canary-run-report.md)与[run manifest](../../docs/evidence/wpf-mature-02/isolation/canary-run-manifest.json)：09:32:21.310Z–09:32:21.558Z，function/factory各一次；DISCONNECTED/SIGABRT，child confirmed-exited，listenerClosed=true，两个已记录根目录不存在。七canary结果均不可用；没有定位具体被拒规则，没有放宽或再次运行。真实Codex/provider/auth均0。旧静态README/manifest保留原准备时点，不替代本段当前运行事实。

## 共享依赖review回执

[Native profile client review](../../docs/evidence/wpf-mature-02/native-profile-client-review.md)仅保存Mika接收的固定095bdb8独审结论，F01进度仍由其权威status维护。此metadata不改变02实现target/27项结果或隔离许可。限定诊断候选三项匹配均false，未读内容；没有新增探测。

[TUI01A review](../../docs/evidence/wpf-mature-02/tui01a-review.md)记录2 P2交原owner；[production projection review](../../docs/evidence/wpf-mature-02/production-projection-review.md)仅批准纯投影提升。现共享entry已通过固定main进入本树，薄入口消费证据单列；不复制其他任务进度。

## 当前薄入口交付与诊断后继

[生产消费报告](../../docs/evidence/wpf-mature-02/production-import/README.md)与[新manifest](../../docs/evidence/wpf-mature-02/production-import/manifest.json)绑定当前27项及已审生产输入；旧语义manifest只绑定原0d0524c，不冒充当前wrapper。integration claim76920d8a-459d-4800-9c7b-bcf7e626a16a已v2 released，writer0dd97484-f0ce-4738-8075-505bd5e2541a仍v1 active。

WPF-MATURE-02-03新增独立诊断阶段：最多3次自有合成子进程，总60秒含清理，每次须具体假设或诊断能力变化；旧失败与已消费许可封存。[R06最小seam候选](../../docs/evidence/wpf-mature-02/diagnostic-seam-proposal.md)已提交，待Mika审精确scope与driver后实施，尚无scope amend或新子进程。真实Codex/auth/provider/外网保持0，不扫描私人crash历史，不扩profile。该后继不是薄入口检查的一部分。

## 当前诊断准备事实

[诊断报告](../../docs/evidence/wpf-mature-02/diagnostics/README.md)与[manifest-v5](../../docs/evidence/wpf-mature-02/diagnostics/manifest-v5.json)绑定当前source/raw/直接消费者。R06五源已独审通过；driver先前清理不在窗口内的finding已修，根目录和半建sink失败也进入finally，10个真实私有文件/假transport检查通过，待独审。没有真实batch-reservation，没有启动任何新child。受控f181 merge无冲突，integration claim4d035471…已v2 released，writer v2保留。早期v1/v2 manifest及旧许可/失败均为历史，不能重置预算。

当前运行HOLD：S01窗口已结束，本owner仍保持0新child，等待原reviewer复审和Mika单独窗口。driver最终10项包含fsync预算越界回归；文件注明持久化前elapsed，CLI在durableCreate后给最终耗时和withinBudget。

组合review修复：原4e1c989有1 P2（创建根后realpath/lstat失败时漏登记）；当前7297986在创建即登记，未知身份/准备不完整保留。新增6/6故障检查，0listener/0child；旧profile/raw保持固定target，本次仅cleanup变动。

## 唯一新诊断窗口已完成并封存

[运行报告](../../docs/evidence/wpf-mature-02/diagnostics/run-report.md)：10:14:37.579Z起，2factory、第三NOT_RUN，控制40bytes精确，canary SIGABRT/exitCode=null、父stderr收到0bytes。282.794417ms含最终持久化；子进程/listener/三个记录根已关闭或清除。CLI0仅采集/清理成功，隔离仍失败。parent空管道不证明子进程没有错误文字或能写stderr。当前STOPPED，不恢复旧clock/新batch，不重试。旧HOLD/NOT_RUN为历史准备时点，只有本段描述该唯一新运行事实。

## 已审片段独立交付与目录后继

[集成收据](../../docs/evidence/wpf-mature-02/integration-readiness.md)精确区分R06五源0778847、薄入口38516be与失败诊断结果d35c596的approval范围；不复制全局进度，v2写权继续保留。固定f181的versioned native catalog设计属于02-04：复用已发布配置、保留legacy Claude-only和原digest，Codex只configured/not-probed且conversation显式unsupported。无源码amend、工程测试或新child。

只读main41315b相关17目录blob=f181，R05D四源=已审178ef49e；显式配置/可信factory已main，不代表真实启动。目录设计已吸收独立约束，可先实现合同/域reader，client挂载受现writer占用由Lead协调；不是02整task blocker。fd后继候选见interface，当前只读、无额外child/新预算。

目录首片已领取：claim0dd97484…原子amend v3 COMMITTED 2026-10-06T10:25:51.085Z，追加已批五路径；scope[] integration e4f289cf…已v2 released，受控main41315b无冲突merge944780d803ed36deb010d0760f7dd46f75cc3a6f。新合同/reader/routes与局部测试实施中，尚未获得运行通过证据；client/index无写入。

目录首实现已通过33 distinct行为检查与strict0，见[native-catalog报告](../../docs/evidence/wpf-mature-02/native-catalog/README.md)。7合同、9真实PG/HTTP（8先绿+Host修正后1单验）、17旧消费者，所有未选中数/早期setup失败留档。源码交审中，未触client/index、descriptor/runner启动、server/contracts全局index或migration。架构影响为已挂载目录Module新增versioned reader/DTO，待Lead按最终source更新dashboard架构基线；不是实际模型或账户探测。

目录独审接收：status_read/gpt-6-astra，2026-10-06 10:35:37 UTC，固定c9c6e891，0P1/P2，42manifest全部匹配；Mika复核通过。非阻断P3仅测试夹具未知CREATE ACK清理，当前已修并单选1项真实PG/注入丢ACK检查通过、9旧项未选、strict0；旧生产/33证据冻结。见[delta](../../docs/evidence/wpf-mature-02/native-catalog/ack-cleanup/README.md)，后续Lead已收窄为store.ts单路径，已停写并v4原子移除；其余四目录路径继续保留。见[COMMITTED回执](../../docs/evidence/wpf-mature-02/catalog-store-partial-handback.json)，不释放02其他scope。

P3 delta固定a761941fce5b2b6dd12d8c974c6d2c7e51894628已由status_read/gpt-6-astra于2026-10-06 10:39:53 UTC独审APPROVED，原P3关闭，0P1/P2；14manifest条全部匹配、4输入=c9，review未重跑。store.ts交回已COMMITTED v4，其余scope保留。WPF-MATURE-02-03新增最小C诊断候选，独立新额度最多3个合成目标+1次必要编译调用、总60秒含清理/持久化、证据2MiB；当前只准备源码/合同，0编译/0目标启动，固定source独审及Mika串行窗口前禁止执行，旧raw/profile/失败不动。

目录main事实：只读核main21e0a56c4b2b65a04a1e8d510a9d132e77c3894b与其i02/native-catalog-integration receipt，4源码=c9/测试=a761，见[接收证据](../../docs/evidence/wpf-mature-02/native-catalog/main-accepted.json)。目录本片delivered，33+1复用，无重测；完整02的client/Web/真实目录/账号/设置等TODO仍开放。

当前后继为[最小C诊断一页合同](../../docs/evidence/wpf-mature-02/fd-canary/contract.md)与source manifest，静态source准备交审。预算最多3目标/1编译/总60秒/2MiB含自有binary/object等；0编译/0目标，host未实现，无运行窗口。架构不改生产transport，不复制JSONRPC/agent loop；固定source与后继最薄host需整体独审后才执行。

## C fd组合已审；唯一窗口已消费

固定target `cf69dddff65d31a821a6c13b984ea0ef6d5fa648`，[当前README](../../docs/evidence/wpf-mature-02/fd-canary/README.md)、[v2合同](../../docs/evidence/wpf-mature-02/fd-canary/execution-plan-v2.md)、[driver-input](../../docs/evidence/wpf-mature-02/fd-canary/driver-input.json)、[host-manifest](../../docs/evidence/wpf-mature-02/fd-canary/host-manifest.json)。C/profile/schema仍722，R06复用文件仍077；当前host明确save-temps=obj、多编译子命令、fixed hash预检、一次预约、unknown保留、forced unref及所有root最终inventory。准备证据100984字节预扣，32KiB运行收据+128KiB安全归档预留，最终归档仍须实际计量。

20 distinct检查来自18旧集合+两个单独新增；最后4项与4项delta各有重叠，不写成单次20/20。Node24直接惰性import已验证，无compiler/target/provider/auth启动。Mika于2026-10-06 11:07:30 UTC完成组合独审APPROVED（0P1/P2）；architecture_read优先04 DDL/PG。本窗口NOT_OPEN，等待本次clean metadata HEAD对应的明确命名窗口，S01串行占用解除不等于许可。claim v4 fresh active，store.ts交回后未改写。

## 当前唯一C fd窗口结果

[最终报告](../../docs/evidence/wpf-mature-02/fd-canary/run-report.md)绑定mika-c-fd-20261006-110819和执行HEADcdb900d9：开始11:08:42.729Z，1compile正常exit0/groupGone/close，0target，三项NOT_RUN。编译后产物/verbose核验未知，measurement=false/accounting=false；cleanup=true、retainedRoots=[]，结果已持久化，CLI1/1054.934625ms。可见268927B不等于完整计量；CLI和实际尾部归档另有清单，整体withinBudget不声明成功。实际诊断STOPPED，旧阶段的NOT_RUN/窗口待命是历史，不恢复预算，不读取raw或crash。源码/driver-input/host-manifest保持已审固定值；结果待Mika只读接收，不重跑。

## logging/lexer v2候选：0新增实际运行

固定 `851fd8c7a48b6ebec64cbf80ccda4eb6bcfaf845`，[候选README](../../docs/evidence/wpf-mature-02/fd-canary-v2/README.md)、[manifest](../../docs/evidence/wpf-mature-02/fd-canary-v2/manifest.json) 与 [input](../../docs/evidence/wpf-mature-02/fd-canary-v2/driver-input.json)。只为固定C编译保存≤64KiB/stream原始stdout/stderr到0600/wx文件，写前重复计入2MiB预算；先留证再health/parse，失败阶段/检查有限枚举，不透传原文。按固定LLVM18.1.8 printArg实现有界数据lexer，支持quoted exe及bare/quoted args，保留固定exe、owned输出、唯一-o与unknown拒绝；不据此推断旧失败原因。

最终26/26直接受影响检查通过、9项未选，Node24惰性import与3语法通过。源码checkpoint391f67b4；C/profile/command/R06未改。旧fd-canary38份证据保持6d快照，旧archive对当时metadata的hash不伪称当前匹配。[旧结果正式收据](../../docs/evidence/wpf-mature-02/fd-canary-v2/previous-result-review.md)准确保存Mika faithful FAIL批准。当前新编译/目标均0，新运行授权NONE，候选仅交独审。

## v2已审，具体新预算请求待输入

[新窗口请求与独审收据](../../docs/evidence/wpf-mature-02/fd-canary-v2/approval-window-request.md)是当前唯一候选运行请求。Mika于11:20:49 UTC批准851fd8c7源码/证据，未授权实际运行。申请一次1编译/最多3C目标/60秒/2MiB，原授权已消费；本候选新增实际compiler/target仍0。GO预算批准后Mika绑定最终clean metadata HEAD并命名一次窗口，不执行移动HEAD、不自行重试。当前优先转入P04只读独审，没有额外诊断研究或测试。

## v2唯一窗口授权（尚未执行）

GO批准、Mika串行派工 `go-c-fd-v2-851fd8c7-once`，见[运行授权](../../docs/evidence/wpf-mature-02/fd-canary-v2/run-authorization.json)。fresh v4 ACTIVE、元数据前f1139ff clean；仅本授权/status提交后再核clean与一次预约缺失，唯一入口一次调用。1编译/最多3自有目标/60秒含持久化CLI/2MiB，原始编译流只本地0600，失败即停止；当前尚无新增编译/目标。旧窗口及候选README的未授权描述保留其历史固定快照。

## v2窗口最终事实（当前）

[结果](../../docs/evidence/wpf-mature-02/fd-canary-v2/run-report.md)：执行c44189e4，1编译/2目标；控制stdio三个socket且fstat/fcntl成功，profile SIGABRT/report=null，第三NOT_RUN。CLI1、1427.775042ms，measurement=false、cleanup/accounting=true，原始编译流0600本地保留仅归档hash。窗口已消费，无后继运行授权；结果已获上述限定独审，不改变851源码批准，也不代表隔离成功。

## v3独立准备阶段（当前0实际运行）

[候选](../../docs/evidence/wpf-mature-02/fd-canary-v3/README.md)落实已审两case设计：socket控制后直接regular-file profile对照。父fd身份/regular已核才传递，子负errno仍原样；新增自动compiler清单进入同一clock/receipt，关闭未知保留roots。最终28/28选中、16未选，源3636614f；input预扣122648B。只读独审已APPROVED，真实compile/target0，新运行授权NONE；[具体GO请求](../../docs/evidence/wpf-mature-02/fd-canary-v3/approval-window-request.md)。旧v2 archive的6b快照及c32接收仍固定；本段及B01路由属于新准备阶段，不倒改旧窗口hash/时长。

## v3唯一窗口已获GO许可（本记录提交时未运行）

[授权](../../docs/evidence/wpf-mature-02/fd-canary-v3/run-authorization.json)绑定go-c-fd-v3-a10b4fae-once及a10固定组合；fresh11:42:47 UTC v4 ACTIVE/99320aa5 clean。仅本metadata提交后再核固定源/外部/预约，唯一入口一次。B01运行串行等待本窗口结束。

## v3本次运行最终事实

[结果](../../docs/evidence/wpf-mature-02/fd-canary-v3/run-report.md)：执行65bf4503，开始11:43:23.079Z，一编译/两目标；控制socket成功，父核三个regular fd后profile目标SIGABRT无报告。file stdio streams=null，不把0capture说成无输出。997.3055ms、CLI1；measurement=false、机器清单/结果已持久、cleanup/accounting=true、无保留root。B01已通知可解除串行等待。结果d8038d3ab4b8e58fbe30a19e7135f457eb4cd958已获architecture_read/gpt-6-astra于2026-10-06 11:45:46 UTC限定faithful FAIL APPROVED，Mika接收，0P1/P2；未重跑。实际许可已消费，停止fd变体；后继固定上游只读研究由architecture_read负责，本owner尚不实施。归档123508B是d803历史快照，当前metadata尾部另计。
