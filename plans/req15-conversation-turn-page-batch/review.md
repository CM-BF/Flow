# REQ15 独立审查

状态：APPROVED（6725dd4b固定main7b6 HTTP结果；此前各层批准范围分别保留）

Review target commit: 6725dd4b06f4a7aa2d16a28e567bfa7e2dddb8f6

历史说明：局部产品与fake/strict在d209已获独立APPROVED；新真实PG source packet **PG_PREPARATION_SOURCE_APPROVED / TYPES_COLLECT_PG_NOT_RUN**。以下按时间保留初始模板及各次固定审查，早期NOT_STARTED不是当前产品结论。

## 本次局部工作段结束后的统一审查范围

起始source为2deb4b865332981fc4a184c04913313b12766ce8，仅run-check增加pg-types/pg-collect固定选项；原95 PG输入、封套、fixture及d209产品不变。按新OPS方法，恢复HOLD归还后普通局部段连续修改/检查/修失败/定向复测，段末绑定最终source和原始结果一次独审；本节不是新增检查前批准门槛。最终核命令选择、PG/admin/OPEN env清除、实际collect file/count、原supervisor复用、输出保真和预算，保留失败原件。旧26/26、strict-v2及5dd源码审不重做；本段新types exit0，collect实际2且非test pass，真实2PG仍未运行。精确段预算见[validation-ready](../../docs/evidence/req15-turn-page-batch/validation-ready.md)。实际PG仍需必要隔离/特殊窗口，不重开任何旧已消费窗口。

## Target / scope / 验收

base为22a0806bc2465e11096949618113833f31766b19，唯一树/分支及拟scope见[status](status.md)。实现提交固定后只按目标中实际存在的产品路径审查；metadata不扩大approval。验收见[plan](plan.md)，fake与真实SQL/并发/性能证据分开。

## 可复制审查任务

请只读审查REQ15。先核真实worktree/branch/base/HEAD/dirty、规则与技能，绑定完整实现commit。核批量与单轮共用逻辑、<=50上界、session/attempt/ownerVersion身份、per-task LIMIT2、typed invalid与legacy差别、Unicode/digest、RR/404/分页顺序及冻结上下文。复核原始selected/pass/exit/wall与未执行项，不因fake推断真实PG能力。回传severity、行证据、阻断影响和修复建议，不修改实现。正式review记录仅由owner归档。

## 检查 / Findings / 结论

全部NOT_RUN；findings未评估；结论NOT_STARTED。独审后按固定commit归档，若修复则记录新commit和复审，空模板不表示通过。

## 本次固定source审查请求

Target `3cd7a6e867bd84ca877e07ea4e6e97f70d685e32`，base22a0806bc2465e11096949618113833f31766b19，scope为[source manifest](../../docs/evidence/req15-turn-page-batch/source-manifest.json)8路径（6产品+2测试）。独立结论PENDING，不视空模板为通过。请核pair绑定/当前attempt-owner-session/每task LIMIT2/known typed错误隔离/legacy fallback/冻结context-settings/UTF8全文digest与UTF16边界/同client与单项复用。

已执行：首红26selected/17failed/9passed、exit1，fake旧mixed50实数214次；新source的green/strict **NOT_RUN_RESOURCE**，此前green准入0child。真实SQL/PG/HTTP/并发snapshot/字节测量/main均未执行。源码静态审与后继测试回执各自绑定，不通过删断言或降低预算收口。

## 固定source独立结论

Reviewer：status_read，2026-10-06 21:36:02UTC；Mika另核六源diff/SQL约束/UTF16等价无blocking。Target `3cd7a6e867bd84ca877e07ea4e6e97f70d685e32`，结论 **SOURCE_REVIEW_APPROVED / VALIDATION_PENDING，0 P1/P2**。8 paths /55175B逐Git(target)=WT=manifest hash；manifest SHA256 `45fcdaee14075d904bb1a170bb7859019e690d1ce31c8c3a0a7fe9194fda6c90`。

本结论仅为source/SQL静态审，不证明运行正确性或main能力。首红26selected/17failed/9passed原件保持；新实现green/strict为NOT_RUN_RESOURCE，0新运行。真实PG后继须覆盖suffix坏但prefix相同的完整digest、每task LIMIT2混合、错误attempt/owner/session及并发RR快照。mixed50部分expected复用新turnView，只提供公开投影的一致性约束，不能代替SQL执行证据。

作者接受，无源码修复请求。本次仅metadata归档，claim保留；空间恢复后按Lead新准入补green/strict，实际PG另行窗口。

## 验证与fixture修复复审请求

Target `d209eb7275777d50f214fd73f66d6b3c1520c459`，产品6源相对3cd不变；仅turn-page-batch.test.ts一行显式row guard修复TS18048。green26/26在修前test/固定产品上执行；strict首错保留，修后focused strict-v2 exit0，26绿组未重跑。不自动扩大上次source approval：结果忠实性/fixture修复复审PENDING。请核[检查记录](../../docs/evidence/req15-turn-page-batch/checks.md)、[来源manifest](../../docs/evidence/req15-turn-page-batch/validation-source-manifest.json)、[原始输出manifest](../../docs/evidence/req15-turn-page-batch/validation-output-manifest.json)。真实PG/HTTP/main仍NOT_RUN。

## 定向验证与fixture修复独立复审

Mika，2026-10-06 21:45UTC，target `d209eb7275777d50f214fd73f66d6b3c1520c459`，**APPROVED /0 P1/P2**（限局部source+fake行为+strict）。Reviewer核5b8eb93 clean、6产品与3cd无diff、唯一row guard不删断言；green26/26、strict-v2实际exit0，108B首次类型错误与own组/TMP清理原件保留。source manifest SHA `2abe118da942b25be4f22c872c015dec123b8597f19a740409c2ba2213e1bfd0`（8/55181B）、output SHA `6f4f40ba876ecca2734a5122e0774f851e5e0151d476e033bdba2da65f04b120`（6/12275B）逐Git(d209)=WT=bytes/hash。非PG/HTTP/main批准。

下一片仅[真实PG准备设计](../../docs/evidence/req15-turn-page-batch/pg-acceptance-plan.md)与两SQL固定供给请求，未执行、未作为本approval范围。产品冻结，准备packet待下一轮审查。

## 真实PG设计只读审查

root/Mika + architecture_read，2026-10-06（reviewer消息回传，未提供独立完成时刻），target `98b60b4b18a4f58e03ec9662f54f6d96feac310f`，**DESIGN_REVIEW_APPROVED /0 P1/P2**。请求SHA `5844c5a2e26099362ec85cd4b5aff89562a988177af8eab0cc1fd59ecefe22e1`与计划SHA `d61760f31aec9b406b56504d8f977f4de14b816a143170d7815dbb30052b4003`已核；007/025两SQL2681B待Lead sole供给，002/009=base。仅设计审，不是fixture source/types/collect/PG执行批准。

作者已静态核pg8.23.1/pg-protocol1.16.1接缝，见[driver观察边界](../../docs/evidence/req15-turn-page-batch/pg-driver-seam.md)。direct error.code与turnPage invalid/邻项健康分别验收，duplicate-session用details重复、legacy用不同identity、第51坏项不提前投影；收到供给后落实，不改已审产品。

## 真实PG准备包源码审查请求

2026-10-06 23:33:15 UTC：两SQL供给回执已核并归档，driver静态接缝另获Mika STATIC_MEASUREMENT_DESIGN_ACCEPTED/0 P1/P2（非执行批准）。本次[固定准备包](../../docs/evidence/req15-turn-page-batch/pg-window.md)新增两case、seed/observer小支持模块和一次性封套；固定target `5ddddd6a7991243b5c42e223b11df879f0fa9498`，manifest `df2cd82a7951b030b90e02c5f84d5ef2ce8150dc72901ab8fd4d11e8fb25439e`（95文件429768B），结论 **REVIEW_PENDING**。

请按[输入manifest](../../docs/evidence/req15-turn-page-batch/pg-prepared-manifest.json)分别审查：（1）公开turnPage/readAssistantFinalPreviews断言与真实SQL/schema/UTF8观察接缝，尤其第51项、每task LIMIT2、paired绑定、RR writer COMMIT ACK；（2）专库CREATE/OID/marker/zero-connections普通DROP、原Promise结算、首失败保留、输出wx、固定supervisor/30s预算与UNKNOWN边界。只读，不运行导入/types/PG。新types/collect/PG全部NOT_RUN；旧26/26与strict-v2不重复，六产品和两fake文件不变。

共享协调PG已由Lead报告不可用；当前合法claim保留，本段固定后停写。后继新工作须待Lead恢复并重新核claim，禁止将读取失败当空闲或重复take/amend。

23:35:31.024Z恢复补充：root fresh ledger已available且原v1claim/10scope不变；没有新的领取。资源与窗口仍不足，types/collect/PG保持NOT_RUN，静态source review不受该运行等待影响。

## 真实PG准备包源码独立结论

Target `5ddddd6a7991243b5c42e223b11df879f0fa9498`。chatui01_owner于2026-10-06 23:38:54 UTC对fixture、SQL、observer和两case给出 **APPROVED /0 P1/P2**；Mika/root补审Python封套、身份清理、首失败保留和输出预算未见P1/P2。合并结论 **PG_PREPARATION_SOURCE_APPROVED / TYPES_COLLECT_PG_NOT_RUN**，非执行准入、非真实PG或HTTP通过、非main集成。

Root独立复核manifest SHA `df2cd82a7951b030b90e02c5f84d5ef2ce8150dc72901ab8fd4d11e8fb25439e`：95文件429768B逐Git=WT=bytes/hash；261相对import edges无缺失；四官方SQL002/007/009/025、9个依赖入口及8个driver文件匹配，supervisor固定SHA982c原字节不变；6个运行输出absent；apps/packages相对d209零diff。该结论不扩大旧26/26与strict-v2的验证范围，也不证明新fixture已collect或通过类型检查。

Owner于23:39:37.392Z重新核原claim v1 ACTIVE、身份/10scope不变，接受无源码修复请求。当前仅归档status/review/质量；已审source/support/manifest保持原字节。最终metadata HEAD由交接消息提供，用于未来exact-head命令重绑；仍须明确窗口及fresh准入，SVC07首次HTTP优先，0新执行。

## 局部工作段结果统一审查请求

2026-10-07 02:54:01 UTC，target `01d798cb7f4666a738375febe7eb8bb74a1594a6`，caller source `2deb4b865332981fc4a184c04913313b12766ce8`。请只读核run-check固定选项/环境清除/collect判断与原95输入未变，及[单份记录](../../docs/evidence/req15-turn-page-batch/local-validation-segment.json)所绑定4个原件6449B。types exit0/1.353235s，collect2/exit0/0.884711s，raw合计536B、2次启动、无修复或重跑。own组absent/EOF与same-inode空TMP清理均有原始回执，后续owner独核TMP absent；没有真实PG/HTTP或旧26/strict复跑。结论PENDING；本次不是重复审核5dd的全部准备输入，也不是检查前批准链。未测SQL、RR、UTF8实际字节与HTTP/main边界保持。

## 局部段独立结论

chatui01_owner，2026-10-07T02:58:41Z，target01d798cb7f4666a738375febe7eb8bb74a1594a6/final8da3ea07e8d567583797fef3dcc42ef91564af92：**APPROVED /0 P1/P2**。独核caller最小delta/PG授权env清除/list只收集；fixture创建在beforeAll，实际collect2/testPasses=null；两child exit0/EOF/raw完整/group absent，signals/secondary空，两TMP精确lstat absent且receipt同inode清理成立。95inputs429768B、原manifest、4outputs6449B/child raw536B及segment SHA5116…19d4全符。批准限类型通过、收集2例和结果忠实性，不是当时的PG执行通过；旧26/strict未复审或重跑。wall排除解释器启动/末次持久化，非工具总wall。作者接受，无修复。

## 实际PG结果独立审查请求

Target `b00a181f38c261d33651368d82a040db3ab0bb18`；已审产品/fixture/封套逐字不变，仅一次实际运行原件与manifest。5原件10612B、manifest SHA `e4e6a60ad448d78efb11c2ac26f53f9f4fa0d9bcc011a84916a444c5aab274fc`。2selected2passed/exit0/1.150494s，原始stdout584B/EOF、PID/PGID72871 absent，fixture已观察专库/三池清理全部CONFIRMED，TMP owner独核absent。只读核绑定/忠实性/已观察cleanup及UTF8字段与queryCalls样本口径，不新连PG或扫描进程；HTTP/main未验。由chatui01_owner直接审查，结论PENDING，不经过root转finding。

## 真实PG结果独立结论

chatui01_owner / gpt-6-astra，2026-10-07T03:08:27Z，target `b00a181f38c261d33651368d82a040db3ab0bb18`，**RESULT_FIDELITY_REVIEW_APPROVED /0 P1/P2**。独核output manifest SHAe4e6a60ad448d78efb11c2ac26f53f9f4fa0d9bcc011a84916a444c5aab274fc及5原件10612B Git=WT/len/hash/0600；原95 inputs429768B/df2cd82…439e跨execution8da=target=WT全符。raw584B实际2选2过，exit/process/fixture互符；PID/PGID72871 exit0/合并EOF/group absent/signals空。专库OID1193363与marker跨3原件一致，三池关闭、零连接普通DROP+absence有源码与receipt支持；reviewer仅对精确TMP lstat absent，未重连DB/扫描进程。

六measurement分项算术全符；mixed50 queryCalls=Ready8含BEGIN/COMMIT，field115722=68123+133+47466、JSON96098B；RR task结果屏障后writer COMMIT ACK、旧pair→下一事务新pair断言与receipt一致。1.150494s为wrapper preflight至cleanup、final persistence前，非解释器/工具完整wall。批准严格限两case真实PG结果/资源/测量忠实性，不批准HTTP/main、吞吐/完整wire/历史样本比较。审者0test/import/PG/cleanup/写。作者接受，无修复；转integration，原REQ15-04继续待HTTP与main。

## 主线Pool mock直接消费者小增量

Target `ae899312a2942c112dfca6cdf5b1cb472daf3488`，source9e6cc60bcd1cbdef538cbce9300f09aace6c8a26，相对25be仅turn-page-batch.test.ts mock变化，无断言/产品改动。只读donor main8c80a710 database7789B/SHA277ab008…5653等于已审SVCe28；窄Vite映射与transform哈希/LOADED marker确保单文件11/11实际使用该字节。原run-check新增固定pages-main，记录8MiB TMP采样，复用原supervisor，无新框架。2原件5332B及完整8源55483B见main-database-validation.json（SHAb96634b0…74933）；PGID87744 absent/EOF/TMP同inode清理与独核absence。待architecture_read只读核此delta/绑定/忠实性，无需重审旧产品或复跑26/PG。

## 主线Pool mock增量独立结论

architecture_read / gpt-6-astra，2026-10-07T03:18:33Z，source `9e6cc60bcd1cbdef538cbce9300f09aace6c8a26` / target `ae899312a2942c112dfca6cdf5b1cb472daf3488`：**SOURCE_AND_RESULT_REVIEW_APPROVED /0 P1/P2**。只按fixedGit审查；现场dirty仅owner三份收口metadata。唯一test delta EventEmitter+callback/Promise connect未删断言，六产品及productiondatabase相对25be无diff。donor7789B/SHA277ab…5653逐字=main8c80=已审SVCe28；窄resolve与transform LOADED marker证明本轮加载，14bindings全Git=WT/hash/bytes，validation SHAb966…4933。

单文件11/11 exit0/raw1908B完整、observed=retained/最终group absent、无signals/secondary，TMP当前精确lstat absent。审者0tests/import/PG/write。批准仅mock兼容与本局部消费者，不重发旧26/PG2批准或扩大到真实HTTP/main。作者接受，无修复；恢复integration队列，不再运行检查。

## 公开HTTP直接消费者准备与局部段统一审查

Target `bc4cdf5d9b4daa9bd6f1a95433e823fd33c0d148`，2026-10-07 03:47:30 UTC，SOURCE_REVIEW_PENDING。入口[http-window](../../docs/evidence/req15-turn-page-batch/http-window.md)；227输入1098267B/manifest SHA5616e4c61111a87e6586cf513ad41fd16dc77aa7626531ff24725a5f46789a5e。请status_read只读核固定main7b6 snapshot的实际source/30SQL、原单例断言与page401/403、专库/port0/池关闭和OID-marker普通DROP/unknown保留、旧supervisor公共接口和有限资源；再核两个local child实际types0/collect1（非pass）、4原件7454B/raw271B及资源闭合。0 reviewer import/type/test/PG/browser/write。产品原6源及旧26/PG2/11原件不变，旧批准不重发；main已接收，但本次实际HTTP仍NOT_OPEN。

## HTTP准备首次独审与窄修

status_read，2026-10-07T03:49:40Z，sourcebc4cdf5d9b4daa9bd6f1a95433e823fd33c0d148/packet9df8d4f8b76e9dea9e5ed345a249d81a6e97340a：CHANGES_REQUESTED。唯一P2为execute-http-once.py:148–154在未知child生命周期仍可能rmdir空TMP；其余无P1/P2。227bindings1098267B全符，215snapshot886512B逐main7b6/0444、30SQL/16links/2@flow、4localoutputs7454B/raw271B均核；原2110字符断言正文保留、两auth新增合理；types0/collect1非pass，末态/EOF/TMP原receipt可信。0审者运行或写，外部whole-clock须actual另记，不以内部wall充当全部。

Owner接受；e09978682ec573bacd3d79e7c08e915c16368d49仅修terminal known process守卫并共享该判断，unknown/缺事实保留TMPidentity；manifest3bcbdfc…08d16（227/1098695B）只重绑caller row。fixture/snapshot/原输出/旧supervisor不动，未新增运行。待status_read仅delta复审。

## HTTP准备窄修最终独立结论

status_read / gpt-6-astra，2026-10-07T03:53:34Z，source `e09978682ec573bacd3d79e7c08e915c16368d49` / packet `e3a2db4afacdbcba740c8985c314433485a2384e` fresh clean：**SOURCE_AND_LOCAL_RESULT_REVIEW_APPROVED /0 P1/P2**。唯一P2 CLOSED：execute-http-once.py:35–38统一exit/groupAbsent/EOF/无secondary及历史unknown；:141和:156–158复用，未知/缺process保留inode/retainedReason，:159–162保留原same-identity empty-only门禁。manifest SHA3bcbdfc8176461ae5a1d9ac256fd3647646e7f7fd69f248f380db6cd97008d16，227/1098695B，仅caller row改变，Git=WT/bytes/hash，errors[]。

此前fixed-main215snapshot/30SQL/16links、原2110字符case正文与401/403、types0+collect1非pass及4原件7454B/raw271B结论保持；原fixture/snapshot/supervisor未改。沿本地find-skills/clean-code/codebase-design，审者0执行/import/tests/PG/写。批准仅准备与已发生local结果，非实际HTTP/PG OPEN。Owner接受，无未解决P1/P2；只归档，不重测。

## 实际HTTP结果忠实性独审请求

Target `6725dd4b06f4a7aa2d16a28e567bfa7e2dddb8f6`，执行c83526f9724c7b9a751e4fd859d9fd3d00750a2e；source e099及227固定输入逐字保持。请architecture_read只读核[结果manifest](../../docs/evidence/req15-turn-page-batch/http-output-manifest.json) SHA89fa60ef99d5741232fa7b4caeed50453a451fc71654f1e9c1bcc4a42964d5fa与7原件6745B、1/1/exit0/raw427、25HTTP、身份与已观察资源closure。wrapper3.012804s、外部time3.05s、秒级UTC分列，原始末尾空行保留。0审者重测/import/PG/写，不新连DB或扫描进程，只可lstat精确http-tmp。批准应只覆盖本fixed-main7b6单例及已观察事实，不扩大为最新main全集或部署。源码准备已独审，不重审旧26/PG2/11。当前RESULT_REVIEW_PENDING，重窗口已归还。

## 实际HTTP结果最终独立结论

architecture_read / gpt-6-astra，2026-10-07T04:04:06Z，result `6725dd4b06f4a7aa2d16a28e567bfa7e2dddb8f6` / packet `6a3e9be45ec2a0891e57f866fb93c947485d5c1f`：**RESULT_FIDELITY_REVIEW_APPROVED /0 P1/P2**。fresh clean，7 raw/outer6745B逐targetGit=HEAD=WT/bytes/SHA/regular0600，manifest89fa60ef…d5fa；227 inputs1098695B逐execution c835=target=WT，manifest3bcbdfc…08d16未变。原单case+page401/403实际1/1、25HTTP，Unicode不切surrogate、owned lazy全文、错conversation/turn404、分页上限/游标及immutable user由源码/raw支持；通过HTTP register/claim/report合成事件，非真实runner/provider。

PID/PGID27708 exit0/groupabsent/合并EOF/observed=retained427B、无signals/secondary；OID1205057/marker跨原件一致，app/fixture/admin关闭、0conn ordinaryDROP/absence、port55163closed由代码/收据支持；审者只对精确TMP lstat ENOENT，未连PG或扫进程。外部time3.05s/内部3.012804s/秒级UTC分别保留，empty TMP不冒全时峰。批准仅fixed-main7b6此消费者，不重发旧26/PG2/11或扩大latestmain/native/部署。审者0执行/import/tests/PG/写/清理。Owner接受，无未完成必需修复；原log尾空行保真，原manifest历史待审状态不改。
