# WPF-RELEASE01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-07T11:45:48.838Z |
| 所属大task | [WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / gpt-6-astra / ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-compatibility |
| Branch | codex/web-release-compatibility |
| 工作基线 / HEAD | 固定后继基线 41276e2ecd154087f66958339d9abfce4d44964c；不 reset/rebase |
| 工作树dirty状态 | 两harness源码9658已固定不变；caller准备已固定，本批仅own records，正常提交后停止四scope写入 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | PASSED 9658a6b763de69038778de1b0c16de64ff824c75：两harness strict/noUnchecked/noEmit实际exit0；首f3d红保留。仅类型检查，browser/PG/compat NOT_RUN |
| 已集成main状态 / HEAD | NOT_INTEGRATED 当前后继；历史7805于c450c2da7e6185b88db9f46e0299ee504ee6f3e8接收 |
| 实现目标 | 9658a6b763de69038778de1b0c16de64ff824c75 |
| 实现范围 | apps/web/test/web-release-compatibility.fixture.ts, apps/web/test/web-release-compatibility.browser.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 最终后台与公开会话策略已核齐；首次受控验证在沙箱启动前失败，自有资源已清理，三App旅程尚未执行 |
| 下一可用交付 | 修正调用器沙箱网络规则，再在合法窗口完成三份保留App与独立Cookie验证 |
| 当前阻塞 | ACTIVE: 调用器沙箱网络规则被本机拒绝；owner修正并经必要边界核验后解除 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED（两harness源码及固定c2调用器准备范围）；c2两finding关闭、3局部checks独立接受，实际compat未验 |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 历史完整任务开工未重建；本次后继实际开工 2026-10-07T10:01:18.415296+00:00，见 [segment-start](../../docs/evidence/wpf-release01/fixed-origin/segment-start.json) |
| 领取 | 新 claim38b9a7ff-c9be-4b56-af50-e076afb603bc v1 exact4 COMMITTED；旧20a6529a v2 released不复用 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| RELEASE01-01 | completed | w01_owner | [历史固定构建/清理](../../docs/evidence/wpf-release01/source-manifest.json) |
| RELEASE01-02 | completed | w01_owner | [历史两App真实兼容](../../docs/evidence/wpf-release01/README.md) |
| RELEASE01-03 | completed | w01_owner | [历史7805主线接收](../../docs/evidence/wpf-release01/main-source-observation.json) |
| RELEASE01-04 | completed | w01_owner | [固定origin设计及边界](../../docs/evidence/wpf-release01/fixed-origin/report.md)，[两harness固定实现](../../docs/evidence/wpf-release01/fixed-origin/source-manifest.json)，f3d源审及9658类型delta独立接受，strict复验PASS |
| RELEASE01-05 | pending | w01_owner | [受控caller/完整输入准备](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/README.md)已固定，[c2修复与三场景actual](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/README.md)已固定；native固定边界已独立接受；[c2首次actual](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/README.md)启动前FAILED/410ms且资源归还，三App四项compat仍NOT_RUN，全部首红保留 |
| RELEASE01-06 | pending | w01_owner | 后继最终delta独审/主线接收；个人发布仍由原发布operator执行 |

## 等待记录

| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| RELEASE01-W01 | UNKNOWN | 2026-10-07T11:15:10.520Z | 接口 | 原发布负责人供应最终后台source/artifact与公开会话策略；本次已核齐解除，历史起点未知 | [后台tuple](../../docs/evidence/wpf-release01/fixed-origin/final-backend-tuple-root.json)、[公开设置](../../docs/evidence/wpf-release01/fixed-origin/public-settings-supply-root.json) |

## 边界与交接

仅当前原四scope唯一writer，其他Quick/DPERF/RELEASE03保持停止写入。不启动PG/Chrome/HTTP/build/install，不访问个人61228。61228只允许后继受控Chrome页面流量经精确代理；page.request/context.request/route.fetch/Node fetch不可用于该origin。三旧App原生Bearer与独立Cookie/CSRF补证分开，format1不补releaseId。

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

## 当前 c2 首次实际与归还

2026-10-07T11:45:48.838Z：[21原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/index.json)固定输入1e5f/9658，唯一actual outer1/worker sandbox-exec65；本机错误明确remote ip中host只能为`*`或`localhost`，因此Node/fixture/Chrome/DB未进入。三App/Cookie原验收0，不归产品失败。原parent fixtureCleanup UNKNOWN不改；[外层与补充清理](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/cleanup-accounting.json)确认双EOF/drop0、唯一terminal/三hash、31447/31807 PID+PGID全ESRCH、exact scratch/admin输入删除。新180s一次段410ms FAILED/CLOSED，179590ms未用不触发第二run；旧types/helper预算独立。c2源码/native审批及3helper通过仅保持原限定范围，不转actual PASS。后继规则修复仍待明确同边界处理；本批正常seal后原四scopeSTOP保claim，不切Plugin、不自启新检查。
