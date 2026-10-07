# WPF-RELEASE01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-07T16:13:46.213Z |
| 所属大task | [WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / gpt-6-astra / ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-recovery |
| Branch | codex/web-release-recovery |
| 工作基线 / HEAD | 固定7272151bb1e3e59e08937dca44949dcdeb42f009；source供给300386e2babce408b85ad5b9732d616782b78097；旧树9fde已释放停写 |
| 工作树dirty状态 | 本批browser场景窄修d032已固定；仅own records收口，两已交回产品持续STOP |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | FAILED 2f6792ca3f19fcd1d54563531c302937f607c892 新pair首次兼容，reports=null/0正式报告；原源码/旧consumer/固定artifact通过仍限历史范围 |
| 已集成main状态 / HEAD | NOT_INTEGRATED 当前新pair harness/compat；两产品窄修已随MSG进入main729d3383635b565aa4131078f80a682cac437526，session保留独立MSG接线 |
| 实现目标 | d032a53a62017cc41a3ddf19b316ad1047398fa6 |
| 实现范围 | apps/web/test/web-release-compatibility.browser.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 已保留首次兼容失败证据，未知回执恢复后再检查登出的测试顺序已修正 |
| 下一可用交付 | 完成本次场景差量审查，按新独立窗口验证固定新网页与后台组合 |
| 当前阻塞 | ACTIVE: 修正后的兼容场景尚未实际验证，四份正式报告仍未生成 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：NOT_STARTED d032a53a62017cc41a3ddf19b316ad1047398fa6 场景窄修独审；首actual FAILED及完整RETURN已独立接受 |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 整体开工UNKNOWN；历史片段完成12:17:59.709Z保前状态；后继领取13:09:33.224Z仅为领取事实，编辑固定来源8964dc1；不以领取或编辑时刻倒填全任务开工 |
| 领取 | 7d60cb91-7537-4052-8ba7-0c0aac8eb722 v2 exact4，amend COMMITTED 2026-10-07T15:10:52.444Z；两产品STOP/移出，旧27c v2已released |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| RELEASE01-01 | completed | w01_owner | [历史固定构建/清理](../../docs/evidence/wpf-release01/source-manifest.json) |
| RELEASE01-02 | completed | w01_owner | [历史两App真实兼容](../../docs/evidence/wpf-release01/README.md) |
| RELEASE01-03 | completed | w01_owner | [历史7805主线接收](../../docs/evidence/wpf-release01/main-source-observation.json) |
| RELEASE01-04 | completed | w01_owner | [固定origin设计及边界](../../docs/evidence/wpf-release01/fixed-origin/report.md)，[两harness固定实现](../../docs/evidence/wpf-release01/fixed-origin/source-manifest.json)，f3d源审及9658类型delta独立接受，strict复验PASS |
| RELEASE01-05 | completed | w01_owner | [受控caller/完整输入准备](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/README.md)已固定，[c2修复与三场景actual](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/README.md)已固定；native固定边界已独立接受；[c2首次actual](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/README.md)启动前FAILED/410ms且资源归还，[c3单点修正及语法检查](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/README.md)47ms PASS，集中delta/native已接受；[c3唯一actual](../../docs/evidence/wpf-release01/fixed-origin/caller-c3-actual/README.md)三App各4项与独立Cookie PASS/完整cleanup，全部首红保留 |
| RELEASE01-06 | completed | w01_owner | [限定实际独审与主线接收](../../docs/evidence/wpf-release01/fixed-origin/main-close/README.md)；个人更新未执行，属于独立发布交付 |
| RELEASE01-07 | completed | w01_owner | [Cookie后继固定源码](../../docs/evidence/wpf-release01/recovery-cookie/source-manifest.json)与[局部检查提案](../../docs/evidence/wpf-release01/recovery-cookie/local-check-proposal.json)；SOURCE_FIXED；[strict实际PASS](../../docs/evidence/wpf-release01/recovery-cookie/strict-actual/README.md)与[root限定批准](../../docs/evidence/wpf-release01/recovery-cookie/root-source-local-review.json) |
| RELEASE01-08 | pending | w01_owner | [同任务唯一新Web生产接权](../../docs/evidence/wpf-release01/recovery-cookie/source-switch/README.md)；[新Web产物已实际生成](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/README.md)；[产物实际独审通过](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/root-actual-review.json)，[首实际FAILED/完整RETURN](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-first/README.md)，reports=null/0正式报告；新pair兼容/发布未完成 |
| RELEASE01-09 | completed | w01_owner | [两file固定与必要旧consumer检查](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/README.md)：noEmit0/精确1direct0，[集中独审已批准](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/root-source-local-review.json)；非mounted/compat通过 |
| RELEASE01-10 | pending | w01_owner | 本组合收口后的稳定executor/可信输入分责后继，尚未实施；见[plan.md](plan.md) |

## 等待记录

| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| RELEASE01-W01 | UNKNOWN | 2026-10-07T11:15:10.520Z | 接口 | 原发布负责人供应最终后台source/artifact与公开会话策略；本次已核齐解除，历史起点未知 | [后台tuple](../../docs/evidence/wpf-release01/fixed-origin/final-backend-tuple-root.json)、[公开设置](../../docs/evidence/wpf-release01/fixed-origin/public-settings-supply-root.json) |
| RELEASE01-W04 | 2026-10-07T16:02:58.550Z | OPEN | 验证失败 | 场景缺少Cookie流前置；固定顺序修复与实际验证后解除 | [首实际原件](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-first/README.md) |
| RELEASE01-W02 | UNKNOWN | 2026-10-07T14:54:01.259Z | 产物供给 | 外部等待结束：管理正式将唯一新Web生产交本组，已合法切树接权；产物尚未生成但为当前实施工作 | [接权](../../docs/evidence/wpf-release01/recovery-cookie/source-switch/source-switch-intake.json) |
| RELEASE01-W03 | UNKNOWN | 2026-10-07T14:47:33.469Z | 后台供给 | 本次核对已到04da/cd27 descriptor及固定产物限定批准；这里只记录核齐时间，历史等待起点未知 | [后台供给](../../docs/evidence/wpf-release01/recovery-cookie/backend-cd27-supply/README.md) |

## 边界与交接

当前新树exact4唯一writer（两harness+本任务records），两产品已STOP并原子移出；旧Release四scope已释放停写；其他Quick/DPERF/RELEASE03保持停止写入。本次有界artifact构建已实际完成并归还；当前不启动PG/Chrome/HTTP或第二build/install，不访问个人61228。61228只允许后继受控Chrome页面流量经精确代理；page.request/context.request/route.fetch/Node fetch不可用于该origin。三旧App原生Bearer与独立Cookie/CSRF补证分开，format1不补releaseId。

唯一status仍供原source登记读取；未自行请求dashboard服务。架构影响仅受控验证接口/owned proxy，不改产品或共享契约；最终固定target交co-lead独审后由原Lead判断是否更新固定架构视图。历史状态原件见[previous-status](../../docs/evidence/wpf-release01/fixed-origin/previous-status.md)。

## 历史 2026-10-07 首次局部检查安全点

[唯一strict首红](../../docs/evidence/wpf-release01/fixed-origin/types-first/result.json)：父实际exit1、compiler exit2，stdout852B/双EOF/drop0，owned PGID16208和scratch已清；晚terminal1169.181ms按1170ms记账，原20s段CLOSED、未用18830ms不转credit。[f3d限定独审](../../docs/evidence/wpf-release01/fixed-origin/f3d-source-review.json)与9658 type-only修正分开；后者复用公共配置类型，不硬编码版本/不cast，尚未复验。已授权后继独立10s段按管理顺序在DPERF收口后再fresh，不自动运行。当前四scope停止写入，claim38b9v1保留；不等于释放。

## 历史：必要复验与停写

[type-only修正独审](../../docs/evidence/wpf-release01/fixed-origin/types-first-root-review.json)已接受。原20s首红1170ms CLOSED；新独立10s段actual parent0/compiler0，晚903.769ms按904ms记，双EOF/drop0/groupAbsent/scratchAbsent。[必要复验独审](../../docs/evidence/wpf-release01/fixed-origin/types-second-root-review.json)、[原始结果](../../docs/evidence/wpf-release01/fixed-origin/types-second/result.json)与[外层退出](../../docs/evidence/wpf-release01/fixed-origin/types-second/outer-observation.json)固定；未用9096ms不触发再测。仅严格类型范围PASS，无产品import/PG/Chrome/HTTP/build/provider。该时点四scope停止写入、claim38b9v1保留；当时tuple与caller尚缺。公开设置与tuple现已供应，见当前入口准备。

## 历史 c1 入口准备（当前c2结论见下）

2026-10-07T11:15:10.520Z fresh 确认原38b9 v1 exact4 / owner / branch / 无overlap，接续原Release树0482 clean。最终后台6c0fdcda / artifact7d1a3928 / Snq8cV已只读定位，公开cookieOrigin与trustedOrigins固定http://127.0.0.1:61228，authEpoch=svc09-b2b-20261007，规范化policy SHA81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638核同。共享供应不再阻塞。

owned Chrome/HTTP proxy/backend生命周期caller与完整输入现已形成固定准备稿；[入口/资源/网络/清理合同](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/README.md)及[精确pins](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/source-pins.json)供一次集中独审。最终SVC r2正式限定接收[原件](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/final-backend-result-review.json)已纳入输入。没有runtime grant/预约，compat仍NOT_RUN。不重编三App/backend，不复测旧types。总任务开工UNKNOWN不以本段10:01时间替代，总完成NOT_COMPLETED。

本批安全点：caller PREPARED/native approval=null；新180s含30s清理只是proposal，64MiB scratch/8MiB retained/1MiB metadata与PG128MiB规划估算均待真实组合准入。未运行Node/Chrome/PG/HTTP、未采空间。四scope正常seal后STOP、claim38b9v1保留；TMP最终HEAD绑定不触发重复项目提交。

## 历史 c2 调用器修复安全点（独审前）

2026-10-07T11:36:43.807Z：独立c1审查指出preexisting scratch误删路径及pg-boss额外3连接；原c1完整保留。[原审](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c1-root-review.json)与[c2精确源/实际](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/source-pins.json)分开。仅TMP父新增exclusive创建/dev+ino+uid身份守卫，旧目录或替换目录KEEP；真实helpers三场景一次3/3 PASS，outer0/charge244ms/精确TMP清理。新15s局部段关闭，未用14756ms不转重验证信用。池配置上限校准12=app8+boss3+fixture1、notifyfalse；不是实际并发峰值。候选floor按管理新组合6190268416B，actual仍须更高完整sum；180s/64MiB/8MiB为未授运行proposal。产品两harness/type/raw不改，c2 native复审待完成；本批seal后STOP原四scope保claim。

## 历史 c2 集中独审与停写（首次actual前）

2026-10-07T11:40:37.791Z：[c2集中独审](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c2-root-review.json)关闭两finding、0blocking；[固定native边界](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c2-native-boundary.json)仅接受parent3a9d/worker5800源设计。真实helper 3/3、outer0、244ms与精确TMP清理已独立核验，无新检查。原生Chrome保内建sandbox，但无自定义外层OS写入/egress限制，应用代理/canary不冒OS强隔离。三App、独立Cookie补证、完整PG/Chrome生命周期仍NOT_RUN；6c后台不含后继lateLogout修复。TMP仅reviewed/source/native/最终HEAD与manifest重绑，无gate、无运行预约。唯一管理d01按完整fresh组合安排180s含30s清理，12连接为配置上限、非实测。正常push/clean后全四scope STOP，claim38b9v1保留。

## 历史 c2 首次实际与归还（失败原件不改）

2026-10-07T11:45:48.838Z：[21原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/index.json)固定输入1e5f/9658，唯一actual outer1/worker sandbox-exec65；本机错误明确remote ip中host只能为`*`或`localhost`，因此Node/fixture/Chrome/DB未进入。三App/Cookie原验收0，不归产品失败。原parent fixtureCleanup UNKNOWN不改；[外层与补充清理](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/cleanup-accounting.json)确认双EOF/drop0、唯一terminal/三hash、31447/31807 PID+PGID全ESRCH、exact scratch/admin输入删除。新180s一次段410ms FAILED/CLOSED，179590ms未用不触发第二run；旧types/helper预算独立。c2源码/native审批及3helper通过仅保持原限定范围，不转actual PASS。后继规则修复仍待明确同边界处理；本批正常seal后原四scopeSTOP保claim，不切Plugin、不自启新检查。

## 历史 c3 准备安全点（集中审前）

2026-10-07T11:50:39.071Z：仅TMP父将deny remote host改localhost:61228，其他规则/worker/产品/输入不动。[c3 index](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/index.json)固定真实生成profile和唯一sandbox-exec true实际；outer0/47ms/双EOF/drop0/childPID及PGID ESRCH，两exact测试目录删除。仅语法编译通过，不证明网络阻断或三App兼容。[c2首红独审](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/c2-first-root-review.json)接受失败及完整归还；旧410ms与179590未用原样，新10s语法段独立CLOSED。c3集中delta/native待审，无gate/运行预约。正常push/clean后原四scopeSTOP保38b9v1，不切Plugin。

## 历史 c3 已审准备（actual前）

2026-10-07T11:52:25.563Z：[c3集中独审](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/c3-root-review.json)和[精确native接受](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/c3-native-boundary.json)已固定，parent2500/worker5800及其他规则无变化；只routine数据绑定。语法47ms通过不替代网络或compat。管理新独立一次180s含30s清理已授权NEXT，真实起跑仍由owner紧前核claim/pins/完整资源与唯一gate；本状态尚NOT_RUN，无占用声明。旧c2 FAILED410/179590未用及所有原件不改、不转credit。

## 历史 c3 实际与完整归还（独审前）

2026-10-07T11:55:28.219Z：[65原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c3-actual/index.json)固定input5df2/source9658，actual outer0/worker0/Chrome0、三App各四项compat PASS与独立Cookie/CSRF通过。唯一terminal/3hash/全部原raw核同；[cleanup](../../docs/evidence/wpf-release01/fixed-origin/caller-c3-actual/cleanup-accounting.json)记录marker正常DROP、HTTP双服务closed、四inner流和双outer EOF/drop0、三PID/PGID全部ESRCH、exact scratch/admin输入删。新180s CLOSED23495/未用156505不触发重跑，旧c2 FAILED410独立保留。actual独立证据审与主线接收尚待，不冒个人部署或lateLogout race覆盖。正常seal后全四scopeSTOP保claim38b9v1，资源已归还，无后台待launch。

## 历史：上一片段主线接收与停止写入

[主线接收与独审](../../docs/evidence/wpf-release01/fixed-origin/main-close/README.md)已核齐。固定9658两harness与backend6c/artifact7d1/policy81a8限定兼容证据获独立APPROVED；个人部署及新lateLogout不据此宣称完成。全四scope在本批push/clean后STOP，释放后禁止回写。

## 历史：当前后继源码安全点

[8964dc1 两harness接口与边界](../../docs/evidence/wpf-release01/recovery-cookie/README.md)已固定。旧三App/Bearer与四check保留，固定8964入口目前仍只接显式7272新Web/backend；这是待新pair供齐后窄改的既有断言，不是当前供给必须共源的约束。缺供给仍在fixture启动前拒绝，不fallback未修正6c/7d1。新增真实Cookie刷新恢复、持久原key重试及延迟原logout响应headers后重连链，strict/noEmit单次已通过，浏览器尚未运行，不能据源码或类型检查宣称compat通过。领取原件、来源pins、clean-code记录及20s局部提案在同目录；新增strict-only局部实际1125ms已清理封账；无heavy预约或旧预算迁移。

## 历史：当前独立源码与局部实际审查收口

Root 对固定8964两harness与唯一strict实际作正式限定APPROVED、0 findings，原件已逐字归档。类型检查1,125ms/20s CLOSED、双EOF与owned清理已独立接受；未用18,875ms不转credit。四App对最终审定新后台的真实兼容仍NOT_RUN，main/用户可见发布未完成；旧3App各4项报告必须重绑同一新backend/context，不能复用旧6c报告填新结论。新Web+修正backend的最小明确供给请求交d01/Original；后台现已供齐，仅newWeb descriptor为空，不fallback。正常metadata push/clean后全四scope STOP，claim27c36v1保留；无heavy预约。

## 历史14:16供给请求校准：允许独立审定的最小后台组合

2026-10-07T14:16:15.530Z：Original 已明确授权 SVC06B / 6c 基底的 `04da80692e79e2b7c3f6341c7fa76515a3f719a3` 候选；正式源审与新artifact仍未到。必需的是已审 lateLogout 公共合同，不再硬绑 Web/backend 同源7272。[校准请求](../../docs/evidence/wpf-release01/recovery-cookie/supply-request.json)保留两个 descriptor=NULL，并明确8964输入断言待真实pair到齐后才改。MSG共享draft必要小修仍待root审，不宣称b924获批，也不捆绑全MSG/Plugin。原8964源码/strict批准、旧报告及失败不变；本批仅metadata/text/link核对，无工程运行或资源预约。正常push/clean后原四scope STOP，claim27c v1保留。

## 历史14:24最小Web移植准备（当时独审与后台尚未到）

2026-10-07T14:24:19.223Z：[两file移植报告](../../docs/evidence/wpf-release01/recovery-cookie/held-transplant-preparation/report.md)与[精确pins](../../docs/evidence/wpf-release01/recovery-cookie/held-transplant-preparation/manifest.json)固定。b924 shared source+controlled local已[root批准](../../docs/evidence/wpf-release01/recovery-cookie/held-transplant-preparation/msg-b924-source-local-review.json)；在私有TMP把唯一最小patch应用到7272，两结果与供给hash完全相符，session仅一处投影替换。旧base consumer/type/mounted、真实artifact及compat均未运行；此准备未获Release组合审批。attachments/session仍MSG v3权内，Release未越scope写。8964两harness不动，拆精确Web/backend guard方案待真实pair；04da正式源审/artifact仍待、两个descriptor=NULL。仅正常metadata seal后全四scope STOP保claim，无运行预约。

## 历史：当前后台供给与静态移植批准

2026-10-07T14:47:33.469Z：[275B后台descriptor](../../docs/evidence/wpf-release01/recovery-cookie/backend-cd27-supply/result-descriptor.json)已逐字核SHA27fdb3…，固定04da/CD27；[Original限定独审](../../docs/evidence/wpf-release01/recovery-cookie/backend-cd27-supply/independent-result-review.json)批准target a6adfd5970aa77c2440f8eeb89b285ed90bae565 的固定产物生成/内部加载，0 findings。IhwFGS保留；factoryCalls=0，不是PROCESS T7或真实host验证，cd27不含SVC09A hostmain246ed。[Root静态移植审](../../docs/evidence/wpf-release01/recovery-cookie/backend-cd27-supply/minimal-transplant-root-review.json)批准精确7272两file准备；old consumer执行/新Web产物/新pair兼容仍NOT_RUN。

仅新Web descriptor尚缺，Original assignment_review soleproducer已派工但接受/唯一WT回执待到；Release不创建第二producer、不写MSG产品。8964两个harness/guard保持原字节，本批只更新owner记录，未运行产品检查/资源采样/构建。正常pushclean后全四scope STOP，claim27c36v1保留等待实际pair。

## 历史：同任务唯一来源切换

2026-10-07T14:54:01.259Z：[source-switch intake](../../docs/evidence/wpf-release01/recovery-cookie/source-switch/source-switch-intake.json)记录新树/固定base/供给/新claim；旧27c四scope与MSG20均实际释放后才take exact6。当前可独立推进最小两file源码，不再等待Original接单。完整任务开工仍UNKNOWN/完成NOT_COMPLETED；本时间仅source段实际开工。生产patch尚待本段应用，当前无工程运行。

## 历史：最小产品落地与普通检查安全点

2026-10-07T15:01:36.362Z：[固定source/证据](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/README.md)。产品source1cea/验证target d736；只有attachments/session两file12+/4-，值802e/728a逐字已审准备，8964harness不改。新90s本地段CLOSED6165ms：noEmit通过，首direct0selected的resolver失败保留，补本树activity映射后单真实旧consumer场景通过。所有owned进程组/scratch清理、regular日志完整，无PG/Chrome/HTTP/build/provider。

本组唯一newWeb producer，descriptor尚NULL，但现为实施任务而非等待外部接单；已供后台cd27/04da不包含SVC09A host修复且factoryCalls0，非PROCESS T7。独审/新Web构建/新pair兼容/发布分别待完成，不迁移任何旧绿。当前六scope正常seal后STOP保claim；两产品将先交回供主线集成，后继harness/ownerrecords按fresh amend保留。

## 历史：源码批准与产品停写交回

2026-10-07T15:10:42.258Z：Root [d736集中审原件](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/root-source-local-review.json)已核两产品/定向用例/35原始记录，APPROVED、0blocking。产品1cea保持802e/728a，两literal自本安全点明确STOP，后继仅保留两harness及本任务records写权；[账本actual amend回执](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/product-handback-receipt.json)确认15:10:52.444Z v2仅保exact4。原90s段CLOSED6165/未用83835不转credit，首resolverFAIL不改。新Web产物仍NULL，build/compat/主线与用户可见部署均未完成；既有prepareWebArtifact只做固定输入和有界调用准备，没有运行预约。

## 历史：新Web产物实际生成与归还

2026-10-07T15:40:07.837Z：[构建原件](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/README.md)固定source c231、Web artifact779a（10files/1700569B），actual outer0/child0/唯一terminal及完整owned清理。资源15:34:52.365620Z已归还，artifact KEEP；父3756ms与late3756.269ms原样，观察上界25241ms保守CLOSED，未用额度不转移。两descriptors已齐，不再声明缺Web。Root实际结果独审APPROVED/0blocking；新pair四App兼容与个人部署仍未完成。两harness仍8964原字节，下一只在合法exact4内做必要pair guard/source准备，不恢复已交回产品写权。

固定main729d的[两产品窄修核对](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/product-main-observation.json)：attachments逐字同d736；session仅新增已审MSG设置接线，membership修复不变。此事实不改变artifactc231，不重建、不把新pair/部署标成完成。

## 当前：精确新pair源码准备

2026-10-07T15:47:12.247Z：[source2f679与固定caller](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27/README.md)仅独立descriptor守卫及四App入口适配；browser行为原字节不变。PREPARED/无gate，new native/source集中审尚待。新180s/30cleanup只是未授提案，0运行/资源采样；已闭build25241与旧兼容23495均不转信用。全exact4正常seal后STOP保claim，集中审安全点可交后继独立源码，但真实发布优先。

## 当前新 pair 首次实际失败与有界诊断

2026-10-07T16:09:01.937Z：[38原件](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-first/README.md)固定outer1/末terminal一致/完整RETURN16:03:25.267185Z。新180s独立段CLOSED56504ms、未用123496ms不转信用；不是artifact150s余额。旧三App旅程完成但正式reports=null，不能将部分成功导入发布报告。

Root准备源/native批准与失败实际/清理独审已原样归档。newApp原始Error:OPERATION_FAILED未保细节；24条wire无Cookie SSE/stream GET/logout POST。固定源码先在UNKNOWN状态等待SSE，后才显式retry原key/body，说明fixture前置尚未建立；后台04da lateLogout行为NOT_REACHED，未判回归或安全。原parent fixtureCleanup UNKNOWN短路文字不改，fixture原始DB/HTTP清理与full-return independently证实资源已归还。后继仅原两harness窄修获授源码准备，尚无新runtime。

## 当前窄修固定 / 未运行

2026-10-07T16:13:46.213Z：[c2 source准备](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-c2/README.md)固定d032a53a62017cc41a3ddf19b316ad1047398fa6，UNKNOWN实际reload后显式原key恢复先于Cookie SSE与迟到logout。未删旧三App/Cookie/草稿/原key/stream关闭断言，未改backend/App/已交回产品。未运行types或browser；新180s仅提案，原56504账关闭不借。源码集中审待完成；全部prepared5文件逐字沿c1。
