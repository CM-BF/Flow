# K01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-07 16:10 UTC |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [K01](plan.md) |
| 需求来源 | [REQ-10 §9：版本化知识与授权一致的混合检索](../flow-001-architecture/full-plan-matrix.md) |
| co-lead | mika |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 原K01首次开工缺精确事件证据，不用commit/领取时间猜测；文档段开始2026-10-07T14:53:11Z，旧实现/修复段已封存；当前预算修复段16:02:16Z–16:14:16Z；前段metadata已交付；来源clock与Mika派工 |
| 当前claim / scope | 30965e7d-6f0d-42bc-8eb8-cfc99b80ecca v2 ACTIVE，15:01:40.433Z COMMITTED amend；原两metadata scope+experiments/knowledge-search |
| 单一status owner / model | b01_bounded_reads / gpt-6-astra ultra；lead mika |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/knowledge-source-store |
| Branch | codex/knowledge-source-store |
| 原实现工作基线 / HEAD | base 1f59f8261d191ba65edb27ce53fe7ef32c20fc5f；接口 fe014a118fa92abb7403ce9e67218995533644f9；实现HEAD ea0c4cba1792dbb498487fb5b6ae47393340b77e |
| 工作树dirty状态 | 最终delta metadata待commit/push；起点ea99edf907=origin clean，旧e1a原件/KEEP不改；提交后STOP |
| 工作分支状态 | review（入口/局部结果已审；future runtime绑定候选待核，历史与开放验收不变） |
| 检查状态 | PASSED a913d425bab74ad5fc8aa27ff746cbb01ef19d40；13 pure/caller + focused noEmit0；最终URL拒绝/错误净化窄差异仅静态核对、未重跑，PG NOT_OPEN |
| 已集成main状态 / HEAD | 历史留存规划已接收cd6938fdd50f297cdb4d652d3b38464d1de0b311；本段入口准备未集成；仅纯检查已运行，PG未运行 |
| 实现目标 | 8020d0ba7df93e9131cdb1e334e3141faf8091a5 |
| 历史产品目标 | ea0c4cba1792dbb498487fb5b6ae47393340b77e；APPROVED，原31检查/main事实保留 |
| 当前规划基线 / HEAD | 文档起点88bee460c5e0caf762157b3b0934c16093293fe3；本段target c2ed3bb76387ce3e4c22ab8e8adf82b4a0791bd5；不merge/rebase |
| 本次只读产品输入 | 3c9345df4aec85a37e8a2a155e079db260d515b1；2026-10-07 14:53 UTC固定main，Git只读 |
| 实现范围 | experiments/knowledge-search |
| 阶段 | M2 |
| 本片段交付阶段 | review |
| 优先级 | 2 |
| 当前产出 | 检索诊断已增加合计字节门槛、清理回执预留和本地地址保护 |
| 下一可用交付 | 完成预算保护差异独审，再排真实诊断窗口；当前未运行数据库 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)；e1a历史入口/局部结果APPROVED；当前预算delta待审，PG NOT_OPEN |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| K01-01 | completed | b01_bounded_reads | [Interface](../../docs/evidence/k01/interface.md) |
| K01-02 | completed | b01_bounded_reads | matrix-first 28绿 + capacity-fixed 1绿；首红/清理已保留 |
| K01-03 | completed | b01_bounded_reads | 12词法样本/实际JSON预算；boundary-extra 2绿 |
| K01-04 | completed | b01_bounded_reads / Mika | Mika 05:24:35 UTC APPROVED；31 distinct/noEmit/8库remaining[] |
| K01-05 | completed | b01_bounded_reads / Lead | [main receipt](../../docs/evidence/k01/main-receipt.json)，fb906cb完整9文件零diff |
| K01-06 | in-progress | b01_bounded_reads / 后继合法owner | 本段只补查询计划诊断准备；[唯一入口](../../docs/evidence/k01/query-plan-diagnostic.md)，产品/PG检查NOT_RUN；hybrid/vector、grant/消费/失效验收仍开放 |
| K01-07 | completed | b01_bounded_reads / Mika | 文档独审APPROVED，规划已接收cd6938；[唯一规划main receipt](../../docs/evidence/k01/retention-planning-main-receipt.json) |
| K01-08 | pending | 后续合法product owner | 身份/留存/保护实现，当前没有产品scope |
| K01-09 | pending | 后续合法consumer owners | 新旧协议/冻结/ACK/history兼容，需协调现owner |
| K01-10 | pending | 后续owner / Mika / Lead | K01-R01～R12全部NOT_RUN，独审/集成待后继 |

历史claim 76b6ae1a-f414-49bb-a93d-d80cead6bd61 v1于05:10:36.101Z COMMITTED，后已v2 RELEASED（2026-10-06T05:38:41.221Z）；[receipt](../../docs/evidence/k01/claim-receipt.json)。B03 已停止写入并由 Root release v2。本 worker 只写本 WT。本片新增 knowledge 模块/3表与 migrate/register 接口，架构 target ea0c4cba1792dbb498487fb5b6ae47393340b77e 已交 Lead 同步；共享 client/export/mount 已随 F01 集成，生产接线与CLI验证由 Lead 的独立证据承担，本owner未重跑。

2026-10-06 05:18 UTC：source-red 实际501预期失败；首次green import zod缺直接依赖导致0tests，不计通过，已把schema留contracts修正。source-green-fixed 1/1通过，独立DB remaining[]。搜索首红501已保留。source标题首片固定、类型为manual text，publish仅正文。resolve新增同快照currentVersion，不替换旧引用。

2026-10-06 05:21:27 UTC：matrix-first 28/29，唯一容量夹具过多重复词FTS填充触发10s statement_timeout，已回滚清理；capacity-fixed保持255真实版本/17595 chunks/64MiB目标，改合法换行内容后定向1/1绿；不用于证明最大词向量成本。boundary-extra仅2新边界绿，共31不同用例。noEmit首次因复用旧依赖目录缺新基线SDK/zod失败，补既有安装链接后通过，无lock/source跨范围改动。完整原日志及限定样本留 evidence；metadata不重测。

2026-10-06 05:23:46 UTC：固定实现 ea0c4cba1792dbb498487fb5b6ae47393340b77e。Mika预审发现CAS回执条件断言可跳过，已改为无条件重放赢家原input/key，cas-replay-fixed 1/1（30 skipped）通过；31 distinct仍不重复计数。最后fixture加hasRoute仅防未来生产重复注册，noEmit过；本base手工路径行为未变，未执行生产自动mount。Mika独立技术review后由Goal Owner验收接收范围。报告/manifest已固，架构target ea0c4cba1792dbb498487fb5b6ae47393340b77e 交Lead后续同步。

2026-10-06 05:25:05 UTC：Mika独立技术review APPROVED ea0c4cba1792dbb498487fb5b6ae47393340b77e，核9源码/5只读基线/47raw hash、31 distinct与所有8库清理，未重跑；无blocking finding。Goal Owner接收产品范围随后进行，不再重复技术review。当前本片段integration，K01-05待Lead实际main回执；metadata提交后明确停止领域写入，保留claim76b6ae1a v1用于集成修复。

2026-10-06 05:25:20 UTC：dashboard 2026-10-06T05:25:10.384Z 实采clean c95d6c9、approved/passed/unchanged/current/issues[]，delivery=integration，[回执](../../docs/evidence/k01/dashboard-receipt.json)。本metadata提交后停止K01领域写入；保留claim76b6ae1a-f414-49bb-a93d-d80cead6bd61 v1待明确main接收或授权修复。

2026-10-06 05:38:05 UTC：MAIN_RECEIPT fb906cb42391971a8b315dbd813f7633927d7265，已实核main=origin/main clean、target祖先和完整9实现文件零diff；[回执](../../docs/evidence/k01/main-receipt.json)。Mika/Lead固定范围接收证据为main docs/evidence/i02/knowledge-maintenance-fixed-scopes.json。当前delivered仅指K01本片段；后继K01-06保持pending，不据此宣称hybrid/vector或全部下游接入完成。本轮仅metadata，无测试/服务重启；最终提交后停止所有K01写入，由Mika release当前claim v1。

2026-10-06 05:38:21 UTC：dashboard 2026-10-06T05:38:12.500Z 实采clean1917b91、approved/passed/unchanged/current/main.current=true/issues[]；delivery=delivered，下一可用交付“本片段已交付”，[main dashboard回执](../../docs/evidence/k01/main-dashboard-receipt.json)。当前metadata提交后明确停止所有K01写入，请Mika核claim76b6ae1a v1并release；不自行回填release。

2026-10-07 00:11 UTC：原claim76b6ae1a v2已于2026-10-06T05:38:41.221Z RELEASED，原产品交付事实不变。本次以新claim4be228e2-64f8-46e6-94a8-aa7eb867d730 v1于2026-10-07T00:08:35.936Z COMMITTED恢复，仅docs/evidence/k01与plans/k01-knowledge-sources两scope；不恢复产品写权，不merge/rebase旧branch。只读固定main c3ba1adfe9374b80a955d45e20310f000fed0310，采用本地find-skills/brainstorming/codebase-design/clean-code方法；GO已授权自主细化，无重复产品审批。当前仅规划，产品检查NOT_RUN，0工程测试/PG/模型/安装/历史数据变更。新稳定TODO和消费者边界随设计交付。

2026-10-07 00:14 UTC：K01-07规划checkpoint已形成；以managed协商区分preview与固定引用、旧版本legacy全保护、原子pin与受控回收、真实count/bytes容量为推荐。根与chatui01消费者只读输入已统一记录，含head17而citation1、context history v1 codec、未知ACK协议不可变化、source identity不可删。架构影响候选为knowledge留存模块/保护表/FK及freeze seam；待未来合法scope实现与Lead同步，当前无架构实现。K01-08～10均pending、产品NOT_RUN；下一步仅Mika文档review，不启产品或验证。

2026-10-07 00:15 UTC：设计固定 fd02eb63d0e01d51c390dc5dcf5df8078a6f0063，仅文档/输入记录；已按Mika预审去除终身4096 receipt上限，明确flow.commands生命周期属实施前跨模块依赖，本片有界证明不包括整个DB。独立文档review NOT_STARTED，原产品31项及历史main接收不改。本次顶表区分当前规划claim与旧released claim，历史main观察不外推为当前c3ba逐字一致。产品验证全部NOT_RUN，未取得产品scope。

2026-10-07 00:16 UTC：当前固定规划target fd02eb63d0e01d51c390dc5dcf5df8078a6f0063 包含满额安全release、不可复用pin实例ID，以及release掉ACK/迟到重放不得误作用于新pin的R12验收；flow.commands生命周期不在本片有界证明范围。单次dashboard读5秒超时，聚合UNKNOWN（retention-planning-dashboard.json），不重试或服务操作。唯一status已更新；新规划待db_transaction_owner独立只读文档review，不沿原产品批准。提交后停写规划源，claim4be228e2 v1保留。

2026-10-07 00:17 UTC：规划独审DESIGN_REVIEW_APPROVED fd02eb63d0e01d51c390dc5dcf5df8078a6f0063，无P1/P2，回执retention-independent-review.json。批准只覆盖3文档；K01-08～10仍pending、产品检查NOT_RUN，flow.commands生命周期与具体schema/协商由后续合法owner在实施前审定。本次仅review/status记录，无重新读取聚合/工程检查；snapshot仍单次超时UNKNOWN。最终metadata提交/推送后停止本次规划全部写入，claim4be228e2 v1保留待Lead协调。

2026-10-07 00:18 UTC：Mika报告其00:17:59实际snapshot已核本任务source live/current/nonstale、21db1fc2 clean、review approved fd02/unchanged、checks not_run、10个TODO对应、claim v1 matchesSource。聚合发现REQ-10不是独立registry task，本次只将层级改为既有K01大task、REQ-10移到需求来源，co-lead保持mika；不造平行计划，不改已审3文档。此记录为Mika提供的聚合事实，本owner未再次请求dashboard或运行工程检查；提交/push后停止本次全部写入，待Mika实际读回关系字段。

2026-10-07 00:23 UTC：Execution Lead已窄接规划到main/origin cd6938fdd50f297cdb4d652d3b38464d1de0b311，中央intake来源及hash、设计3文件target=main=WT=原manifest校核见唯一[retention-planning-main-receipt.json](../../docs/evidence/k01/retention-planning-main-receipt.json)。本次0产品delta、0新工程checks/PG/模型/dashboard采样。K01-08～10仍pending、R01～R12 NOT_RUN、flow.commands生命周期/具体协议与migration待未来合法范围；旧31及fb906只保留历史事实。原plan已审REQ-10文字作为需求追溯，当前大task层级仍K01，不改3设计文件。最终commit/push后停止本轮全部写入、无待写scope；claim v1为最后观察，待root原子release，结果仅/tmp，不在release后回填项目。

## 2026-10-07 检索诊断规划工作段

2026-10-07T14:53:11Z实际开始，预算至15:03:11Z（≤10分钟）；只读main与官方方法、仅文档metadata。旧claim4be228e2已v2 RELEASED于00:24:07.059Z，本次fresh ledger14:53:31.415Z确认available后以新claim恢复两scope，[领取回执](../../docs/evidence/k01/query-plan-claim-receipt.json)。不恢复产品权、不安装/调整SQL/pool/扩展、不运行产品PG/测试。原retention设计/输入/manifest/旧31检查原样保留；K01-08～10与flow.commands依赖及R01～12仍NOT_RUN。

架构影响：本段没有产品Interface/运行/DB边界变化，未来查询形状比较仍须合法产品scope和直接语义验证；当前无架构图更新。

2026-10-07T14:57:04Z：分支文档片段交付target c2ed3bb76387ce3e4c22ab8e8adf82b4a0791bd5（clock读取与实际commit后确认），独立文档审查NOT_STARTED；本段main集成/部署/完整完成均NOT_DONE。内容、相对链接与范围核对：6个修改/新增文档42551B≤128KiB、链接errors[]、git diff --check通过；仅文档一致性检查，不计工程测试。产品及retention-design/inputs/manifest零diff，旧31项和R01～12未重跑。最终push后STOP，无待写产品范围；claim保留由Mika协调独审/收口。

## 等待记录

| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| K01-QP-REVIEW | 2026-10-07T14:57:04Z | 2026-10-07T14:58:07Z | 审查 | Mika已批准固定诊断设计；真实PG仍NOT_OPEN | Mika独立review消息、review.md |

2026-10-07T14:57:42.144976Z：本段唯一dashboard读取（generatedAt14:57:28.669Z）返回live/current、实际Git4c235e8c clean、claim v1 matchesSource、10TODO及checks not_run/review not_started；但其status内容仍是14:55启动版本（target UNKNOWN），与已提交14:57交付status不同，implementationProof为unknown。该次聚合不是最终target同步成功；原读取保存在/tmp/flow-k01-query-plan-dashboard.json，交Mika后续读取，不在本段轮询/改parser/重启服务。唯一owner文件现已声明完整c2ed3bb target；本次metadata push完成后STOP，独审与main未完成。

2026-10-07T14:59:12Z：按Mika≤5分钟metadata收口授权恢复，fresh ledger确认30965 v1及两scope未变，起点a6a2ecab=origin clean。已归档14:58:07Z独立DESIGN_REVIEW_APPROVED c2ed3bb、0P1/P2；9 bindings/58979B与12金样本、1856chunks/5.5MiB已由review者核验。未来入口必须核aux pool6与center/pg-boss/admin总量、统一绝对deadline/marked DB identity/UNKNOWN保留、实际seed及完整动态迁移闭包（详见review.md）；现fixture不能原样视为运行获准。原设计源/留存/全部开放验收不变，工程/PG检查NOT_RUN、主线接收未完成。未再读取dashboard；最终commit/push后STOP，claim保留、不release。

2026-10-07T15:01:34Z：新20分钟准备段开始，截止15:21:34Z。fresh492a16f=origin clean后amend v2，仅新增experiments/knowledge-search；receipt为docs/evidence/k01/query-entry-amend-receipt.json。S01窗口优先，工程child尚未启动；最多5串行child/各≤30s/累计≤90s。首次静态供给误猜plugin-runtime index被Git拒绝，后按固定package.exports修正；245项/1112251B/33SQL在自有ignored source目录。依赖初次zod顶层缺项，已改精确既有pnpm唯一安装目录链接，无安装/产品改写。实际PG/HTTP/browser/provider均NOT_OPEN。

2026-10-07 15:15 UTC：固定245项/1112251B/33动态SQL输入静态hash一致，17已有依赖metadata及3内部包指向本供给；实验正文/metadata约100KiB、含供给总逻辑约1.22MiB，均在本段预算内。四纯用例与strict noEmit入口已备；0工程child/0产品import/0PG/HTTP/browser。Mika15:09明确SVC09A为唯一离线build owner，S01非active但本工程检查仍排他；仅收到actualRETURN后在本段剩余时间运行，否则固定源STOP。当前无性能/索引/生命周期通过结论，未采dashboard。

2026-10-07T15:17:20Z：入口源checkpoint已提交8c5fa9682ad4551c6dd5f493b7144e6af9fa0ad9并push，apps/packages相对本段492a16f零diff。唯一实验记录experiments/knowledge-search/preparation.json包含静态输入hash/字节和真实准备失败摘要（原tool transcript未伪造为raw文件）。当前4纯用例/noEmit尚NOT_RUN，0工程child，不称准备源已验证；新独审NOT_STARTED，历史c2ed设计批准不外推。未新增dashboard/PG采样，保持本段15:21:34截止。

2026-10-07T15:19:44.372427Z→15:19:45.008488Z：Mika已转SVC09A与S01实际RETURN，fresh可用空间20376842240B≥14338424832B，源/依赖检查后启动唯一pure child。4/4通过/exit0/471ms/EOF，OPS14 PID60763首次group UNKNOWN errno1、后续absent；按原门禁保持HOLD，0 signals，未启动第二child/noEmit/PG。原始started/result/log及许可逐字归档在docs/evidence/k01/query-entry-local，唯一record.json区分测试通过与资源未知；不把后续absence抹去先前unknown，不清理未知process/TMP或新增探针。当前本片未验证完成，原c2ed批准仍仅设计。最终metadata commit/push后STOP，claim v2三scope保留，Mika协调既有OPS14 owner后另授有界段；截止不延长。

2026-10-07T15:28:30Z：新20分钟独立修复段开始、截止15:48:30Z（clock来源），不延长旧段。fresh7155cbdb4a33c7412d14cec8650cdee4fda918f8=origin clean，Mika fresh核30965v2三scope ACTIVE。db_transaction_owner只读核旧PID60763已exit0/finalabsent/明确MERGED EOF321B、无secondary/signals；初始只读EPERM不等于最终ownership未知，原caller全历史sticky是误用。原result=false/HOLD、旧.local KEEP不修改或清理；本段修闭合predicate、显式env allowlist及独立新scratch身份/正常清理。既有4pure不重跑；新增caller unit与focused noEmit等待Mika资源release/freshfloor，最多5串行child/30s各/累计90s、新增总逻辑16MiB。实际PG仍NOT_OPEN。

2026-10-07 15:34 UTC：caller闭合判定/显式env及新scratch正常清理已实施，7个meaningful caller用例待执行；旧corpus源逐字未改，因此不计划重跑旧4项。当前source检查与类型仍NOT_RUN，Web新排他build要求继续source-only。futurePG额外准入项为listen独立settlement，不把createServer已settle当listen保证，尚未运行/批准任何PG。旧raw/.local从未改动或清理；新的逻辑字节计量排除旧KEEP子树，不把读取旧TMP当本段必要动作。

2026-10-07T15:45:17.411812Z：本段4个实际child全部exit0/final absent/完整MERGED EOF，8 caller + 3 synthetic listener通过，focused noEmit两次exit0（末次绑定最终监听修复）。每个新scratch以原dev/ino/marker清理且exact lstat ENOENT；预启动Python3.9 import失败0child及自己的scratch归还原记录保留，不改失败为通过。初始只读EPERM与最终闭合事实分列，旧.local KEEP不动。普通槽已向Mika完整归还，停止新launch。唯一结果入口[manifest](../../docs/evidence/k01/query-entry-repair-20261007T152830/manifest.json)，逐run源hash解释较早caller与末次源差异；旧corpus4未重跑。全部产品路径无修改，真实PG/HTTP/EXPLAIN NOT_OPEN；监听纯Promise行为不冒充Fastify生命周期验收。最终metadata commit/push后本段全部STOP，claim v2保留待独审，未采dashboard。

2026-10-07T15:55:02Z：新12分钟metadata/runtime准备段开始，截止16:07:02Z；fresh HEAD edef5aa70a290b34b2fe749c7be2ea39acfcb394=origin clean，Mika fresh核claim30965v2三scope。k01_query_review于15:50:57Z批准固定e1a785387入口与局部结果、0P1/P2；只读审查15源码/7raw/245固定输入/17aliasmetadata和5runBindings，11不同用例/2noEmit/4child5471ms均吻合。批准不覆盖真实PG/Fastify生命周期或查询计划/性能。当前仅归档一次批准与准备runtime路径/输入/closed默认许可；0工程child/PG/HTTP/DBconnect/模型，不创建actualnamespace、不占窗、不碰旧.local。Original SVC09A soleNEXT及Web后继优先，未来PG候选NOT_OPEN；本prep新增≤4MiB，候选128MiB DB/8MiB local未获运行预算。

2026-10-07 16:01 UTC：future runtime候选固定在[唯一输入manifest](../../docs/evidence/k01/query-pg-runtime-inputs.json)与[候选说明](../../docs/evidence/k01/query-pg-ready.md)，单一closed/expired permit为query-pg-closed-permit.json。静态核245产品文件/33SQL、17外部+3内部alias、Node24.20.0/Python3.13.3_1/TSX4.23.15/esbuild0.28.2 loader/helper输入均一致；未执行二进制/导入运行入口。此段0工程child/PG/HTTP/DBconnect/模型/namespace/资源探针，新增及修改7份metadata合计71132B（收口文字增加后仍远低4MiB）。源码相对已审e1a785387零diff，旧raw/manifest/KEEP不动。现有fixed fixture的FLOW_K01_TEST_ADMIN供给接口已非敏感定位，但合法实际来源待Mika确认；8MiB local/2MiB合计raw与已有16MiB caller/2MiB单result保护不同，未来OPEN前必须落实合计门槛。候选120s/18配置连接/1856chunks/5.5MiB/10EXPLAIN/30计时SELECT保留；30不是全SQL数，DB128MiB是末样本而非峰值硬配额。Original SVC09A/Web优先，本候选无预约；本prep floor不当未来PG准入。最终commit/push后STOP，claim v2保留、无新dashboard采样。

2026-10-07T16:02:16Z：新≤12分钟预算收口段开始，截止16:14:16Z；fresh ea99edf907=origin clean、CLI只读确认claim30965v2三scope ACTIVE。Mika确认可沿fixed fixture FLOW_K01_TEST_ADMIN/本地测试fallback私有映射，不输出值/hash、不用协调DB替代。AV03已直接交16:02:02.838Z FULLRETURN，ordinary lane已可用，fresh floor至少16177627136B。本段只experiment合计8MiB/2MiB raw与清理回执reserve、canonical URL限制及必要pure/types；≤3child/30s各/60s累计、新source/meta/raw/TMP逻辑≤2MiB，真实PG仍NOT_OPEN。旧e1a与原raw不回写，新源待验证/独审。

2026-10-07T16:05:57.909881Z：本段3个actual child共3042ms/raw622B，4预算/URL+9caller通过、focused noEmit exit0，均final absent/完整MERGED EOF/无first-secondary-signal fault，3新TMP按原身份移除并exact lstat ENOENT。ordinary已RETURN并直接让db已授≤5s parser空档，未再launch。新预算将本次record+所有新namespace文件（含结果、identity、ledger、raw、retained PG scratch）计入2MiB raw，再加固定experiment/source基线计8MiB；每次新work含待序列化result并留512KiB，durable写留192KiB parent capture/ledger，耗尽停止新work而不阻已知cleanup。最后URL空fragment拒绝和原生parse错误净化两处窄差异在3child后静态修正，未宣称重跑；[唯一delta证据](../../docs/evidence/k01/query-entry-budget-20261007T160216/manifest.json)保留实际a913源绑定和精确diff。当前final 8020d0ba7df93e9131cdb1e334e3141faf8091a5 待独审；13不冒充最终全部字节运行。Mika配置供给确认已记录，PG permit仍CLOSED/expired/reviewed=false，不创建PG namespace/不占窗；DB128MiB仍末样本非硬峰值。原HOLD/raw/KEEP不改；本段纯fixture最大新增1572864B，源/meta/raw加该峰值小于2MiB，无新供给复制。最终push后STOP，claim v2保留。
