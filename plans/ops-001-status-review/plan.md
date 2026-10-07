# 计划状态与独立审查规范

| 字段 | 内容 |
| --- | --- |
| 计划编号 | OPS-001 |
| 状态 | `in-progress`；最初规则片已完成，资源/验证后继保留 |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-06 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | Execution Lead / gpt-6-astra（至少Sol） |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review` / `codex/plan-status-review` |
| 基线 | F00 `542f70b`，公共client补丁 `3995ec1` |

目标：交付计划状态与独立审查规范对应M1公共契约与可核对证据，遵守[公共契约](../../docs/architecture/m1-contract.md)。写入范围以派工单为准，其他feature目录不修改。先按find-skills读取并应用相关技能；每工作段、约30分钟安全停点、交付与合并前应用clean-code。

## TODO

- [x] **OPS-001-01** 迁移三个既有plan并保留跳转stub
- [x] **OPS-001-02** 统一plan/status/review模板与稳定TODO ID
- [x] **OPS-001-03** 创建活跃feature自己的状态和审查记录
- [x] **OPS-001-04** 相对链接、TODO映射和原实验hash检查后提交

## 验证和交付

通过公共Interface验证可观察行为，模型模拟和真实模型证据分开记录。检查和证据必须附对应commit；未经验证不勾选。Owner在启动、实质进展、阻塞、交付和review修复后更新[status.md](status.md)，交付后由独立reviewer按[review.md](review.md)只读审查，修复交回owner。分支通过不代表已经集成main。

- [x] **OPS-001-05** 用户完整目标滚动规则、22项原要求验收追溯与C02/P01/M02来源登记；2026-10-06新增，工程检查见status。

- [x] **OPS-001-06** 三队并发预算与直接技术路由（2026-10-06）：用户最新覆盖（2026-10-06 08:45 UTC）：每个Lead任务最多1+3；本队4、Web4、Mika4，授权总上限12。任何队增人先协调，不反复探测或通过新用户task绕过实际cap。

以下为OPS-001-06历史路由记录；GO方向的全部消息严格受OPS-001-09每大task的blocker/Done预算约束，不存在其他类别例外。历史路由只保留技术可达性：Execution Lead可直投两外部co-lead；其本身没有独立用户task，工具不支持的回程不能假装存在。普通进度不再经GO桥接。内部worker→本组lead必要交接正常，co-lead间依赖协调不抄送GO。所有跨层GO消息均按OPS-001-09最终预算；本段不另开例外。

- [x] **OPS-001-07** 历史短交接格式保留给worker→本组lead及co-lead间必要执行协作：taskId、事件、固定实现SHA/clean HEAD、canonical证据、下一动作、claimId/version。完整hash和测试细节放唯一证据。普通消息不逐层转GO，OPS-001-09覆盖原即时桥接。


2026-10-06 07:18 UTC维护：本片当前摘要与实际main对齐，历史实验/TODO证据保留；详见唯一status。无新产品或模型验证。

- [x] **OPS-001-08** 用户及时交付与Lead职责（2026-10-06 08:37:23 UTC）：有界功能或修复达到可审停点即提交并推送独立分支；独立审查通过后，只完成必要直接消费者验证便受控合入main并推送，不积压等待无关片段。不得为频繁提交把同一不可分验证拆成伪完成，也不得改写已审固定target。各Lead优先负责完整方向、优先级、公共接口、scope移交、验收和集成；新实现、测试driver与服务工具由具备权限和有效独立worktree/claim的workers承担。尽量并行独立任务，slot转移先核真实状态/当前工作，当前授权上限≤12；不以开新用户task或新增隐形agent绕cap。运行窗口明确要求固定source时，候选分支可及时push，main仍遵守窗口冻结。

历史2026-10-06 08:38 UTC容量变更（已被用户后续4/4/4覆盖，不作当前规则）：本队降为3（Goal Owner、Execution Lead、SVC03 worker）；Web保持4；Mika升为3（Lead、S01P01 worker、CHATUI01 worker），全局仍10。assignment_review仅完成O10语义metadata/push后正式idle，Mika新worker在此之前只可准备不得激活。CHATUI01未take/无双writer，唯一新执行源由Mika独立tree/claim建立；F01历史proposal不成为第二driver。后续slot转移同样核实际running状态与任务，禁止推测空位。

2026-10-06 08:45 UTC：授权配额4/4/4不代表12个实际运行agent。Mika新增/复用completed worker遇工具threadlimit时停止重试，不开新用户任务绕过；现有工作照常，实际active仅按工具观察记录。assignment_review在O10收口后由GO复用为只读runner宿主抽象审查；CHATUI01仍由Mika唯一worker执行。

- [x] **OPS-001-09** 用户最终两层规则：GO只规划大task的用户结果/优先级/边界/依赖/验收并负责全局优化；co-lead自主规划管理sub-tasks和workers、局部独审/提交推送/受控集成。每sub-task的status填写唯一所属大task及co-lead，dashboard关联，无第三任务层或改名绕预算。

co-lead→GO每个大task仅允许 **独立blocker数 + Done(1)**。blocker须大task受阻且需要GO介入，同一blocker只一次，无变化不重复；大task满足完整验收才一次Done。片段完成/ready/review/merge/登记/claim/metadata/普通接口确认均只更新status/dashboard，可自行解决的内部问题不是blocker。本规则覆盖此前“重要决策/关键里程碑”泛化例外。worker↔本组lead执行通信正常，co-lead间处理具体依赖不逐条抄送GO。已一次同步两外部lead；本次规则修订按一个大task收口，不把子片当多个Done。

- [x] **OPS-001-10** 用户全局模块化/复用/扩展/性能规则：根AGENTS为唯一权威，plans规则要求风险相称的职责/Interface/依赖/扩展点及行为/性能证据；WPF-MATURE六大task统一引用，不复制六份。实际规则固定1d36a7a4532bbd2f29300c220d5451f755bd756c，经runner_owner独立只读批准；本批随主线发布，原始质量证据与限制保留。

## 共享磁盘资源的当前执行约束

资源预检以实时可用空间和本片物理峰值为准，不以逻辑文件上限或一次小检查通过代替。 后继组合按[尚可能新增空间](../../docs/quality/local-validation.md#future-disk-budget)核算；历史已清scratch与已封存不增长KEEP不重复叠加原cap，未知增长和必要安全下限保持。大型准备须保留数据库/证据/其他队伍收尾余量；不足只暂停该大型操作，小范围工作按其实际预算继续。清理限定已结束、自有、身份明确且可重建的临时资源，不删除用户数据、其他owner资源、active/unknown或原始审查证据。当前数值与解除条件见唯一[status](status.md)及SVC06状态，不另设资源状态权威。

- [ ] **OPS-001-11** 共享资源可逆回收：复用已验证的每worktree sparse方法，限定本队已交付/released/无消费者目录，保护所有源码与权威证据；按实际卷变化判断局部验证是否恢复。每批数量与停止线按当前明确授权；next12b 已12/12到限停止，历史8棵/2.75GiB不是可反复使用的授权。实际回执见status，不替代SVC06准备门槛。

- [x] **OPS-001-12** 将真实运行入口的动态资源/浏览器定位预检收进既有[局部验证方法](../../docs/quality/local-validation.md)，避免准备遗漏消耗独占窗口；同类真实生成器与入口校验先按[唯一输入合同](../../docs/quality/local-validation.md#generated-input-preflight)做轻量直接消费者核对，保留目录归属/拒重放/清理语义；不新增工具框架或重复通过检查，原失败、独审和各已消费工作段预算保留。普通0provider专库/浏览器可由co-lead按实测初始化/收尾成本另开有限段，不将旧90/60秒当feature终身限额；安全/验收语义变化按真实风险审查，详见同一方法。

资源恢复后的当前并行准入只由[局部验证方法](../../docs/quality/local-validation.md#ready-validation)定义：普通专库、浏览器、本地段和完整构建各按真实隔离、合计资源与原packet核验；不在父计划复制另一份可漂移上限。co-leads自治、旧运行不追溯放宽、固定输入/选中数/清理及unknown保持，实际agent上限与工具cap不变。已审产品接收不等待管理文件。

- [ ] **OPS-001-13** 提取最小test-only有限连接观察：先核TUI既有observeConnections，再以两个真实消费者验证zero/busy/unknown，不拥有DB删除或资源归属；沿[局部验证后继](../../docs/quality/local-validation.md)。
- [ ] **OPS-001-14** ready（当前发布/F04短片收口后下一工程改进）：消除重复的operator/测试进程期限实现。先比较O16与SVC05H的两个真实消费者，结合SVC07的EPERM收尾覆盖原失败事实，固定受监督PID/自有组、独立期限、输出上限及primary failure/cleanup unknown接口；detached个人服务永不由其停止。独立scope与至少两个实际消费者验证，不合并DB删除、资源归属、源码绑定或连接观察职责；当前已固定恢复/F04候选不为迁移重开或重跑。

### 临时 fixture 预览的资源生命周期（2026-10-06）

沿 OPS-001 既有资源工作执行，不新增清理平台。已交付/独审不自动意味旧预览应永久驻留，也不直接允许停止；由原服务 owner 核用途、明确用户保留、当前验证/跨任务消费者后，保存固定源、原启动方法、有限日志及 PID/PGID/端口归属，再对确认无消费者的自有临时 preview 有序停止。未知继续保留。停止结果确认后，唯一资源 operator 才能按 fresh 精确目录身份清理可重新生成的 Vite `.vite` 缓存；真实 npm 包、store、源码、锁和原始证据不动。

4320、61227/61228，以及明确保留的49922/55049/61108/55616继续KEEP；当前浏览器tab数不证明其他客户端无人使用。必要保留由owner给用途与解除条件；可重启临时预览记录恢复方式，后续不能把每个子片都默认变成永久服务。缓存逻辑字节不作APFS回收承诺，实际卷前后观察后才分配运行窗口。

### 已交付树的依赖保留与恢复核对（现 OPS-001-11）

已停止临时预览不直接解除真实依赖保护。下一有界候选先核 web-workspace-cache：现存 package/生成布局与平台版本能否从本机固定来源逐项恢复，以及当前、冻结执行输入、跨树链接和 donor 消费者；锁文件存在或“可重新安装”不足以证明。只读核对不安装、不删除。若证明成立，再形成精确单树的可回收/恢复方法并独审；若未知则保留并记录缺项。唯一根/.git、plan/status/review 与自有原始证据保持可读，不删除 worktree 或分支，不引新归档平台。此候选不继承既有仅 `.vite` 缓存清理许可。

2026-10-07 的[三树收尾清单与交付退役条件](../../docs/quality/worktree-retirement-candidates-2026-10-07.md)继续归 OPS-001-11：Connection 尚缺消费者/完整恢复证明，TUI 的 COST donor 尚未解除，R05 文档 claim 仍有效；本轮全部 KEEP、没有回收操作。今后交付同时记录写权、实际消费者/临时预览、唯一状态与完整原始证据去向、精确恢复依据和重新运行条件；authority 迁移必须先保存核验再单次切换 registry，不能删除原树后补证，也不自动继承旧清理权限。已准备工程验证优先。

- [ ] **OPS-001-15** 将既有docs/ci候选收敛成可审核的远程零模型验证片（唯一子任务OPS-CI01）：一个临时Linux job、固定版本、只选2 contracts+1真实PG/Fastify.inject公共handler检查、有界退出/清理。独审后普通docs提交/push，用户最终启用`.github/workflows`后才能运行；不自动扩OAuth权限，不把Linux证据替代本机native/UI/PTY。原本地资源线保持，最多三旧preview收尾后不再新增同类依赖回收批次。

### 2026-10-07 共享执行阻塞收口（原 OPS-001-11/12/15）

采用[固定恢复队列](../../docs/quality/execution-recovery-order-2026-10-07.md)：先 SVC07 必要直接检查与关键用户路径，其他候选维持已有准备/证据。外部条件未改变时停止重复等待/采样，不预占运行窗口；原资源门槛和 CI 唯一用户选择保留。新功能、清理或扩大供给不由本次管理收口授权。

- [ ] **OPS-001-16** 用户任务时间与局部迭代：沿[plans时间契约](../AGENTS.md#task-timing)在当前活跃/后续新status记录可追溯开工、各交付阶段及等待，dashboard实际显示进行中壁钟耗时；历史未知不猜。普通本地修复按[有界连续迭代](../../docs/quality/local-validation.md#bounded-local-iteration)收敛记录/审批开销。规则、Web展示与实际活跃任务接入分别验收，已发布计时不冒充全历史已补齐；续接按[当前事实优先读取](../../docs/quality/local-validation.md#focused-status-reading)，复用原件链接、只追加实质事件。 后续交付采用[单份必要来源记录](../../docs/quality/local-validation.md#fixed-input-provenance)，由一个合适小片验证同等独审与接收并记录实际避免重复的文件/字节；当前冻结原件保持，采用效果待验。

本组新树的纯源码准备采用[常规co-lead自助职责](../../docs/quality/local-validation.md#source-operator)，沿OPS-001-12复用模块闭包；main/共享配置和跨owner范围交接保持原归属，不再以逐片供给许可阻塞ready实现。

## OPS-001-14 的资源计量后继（2026-10-07）

进程监督Module及实际caller已经交付；后续资源计量保持独立职责，不向OPS14加入callback，也不合并DB删除、身份或源码绑定。Quick b2在6.142秒、产品断言前因retained cap退出，其两次先后扫描再相减会受目录增长影响；ACCESS旧live扫描遇Chrome临时目录消失是另一失败方式，不能合并为同一已证根因。沿两个实际caller下一安全变更选最小共用计量Interface：显式排除子树、logical与allocated分列、文件/目录消失与身份变化/越界/真实I/O unknown分开；保原上限和unknown记录。只需目录增长/消失的直接验证与两consumer，不建inventory平台、不迁移全库、不阻原Quick修复、不重跑已绿产品。具体独立scope由原co-lead协调，当前仅登记待实施验收。

2026-10-07资源计量准备增量：DPERF browser-lifecycle-repair仍有先扫描scratch、再扫描父目录相减的第三个真实caller，与Quick同类非原子计量；ACCESS消失语义仍分开。O16本次零模型旅程收口后的原native_center_owner准备OPS-METER01小片，拟独立tools/owned-resource-measurement；具体caller固定源与下一安全变更由Web原owner协调。SVC09发布路径不让位，不修改当前冻结运行输入；至少两个实际仍会使用caller采用后才算复用交付。

2026-10-07T08:57:27.268283+00:00 实施接续：OPS-METER01 已由 native_center_owner 在独立 owned-resource-measurement 树取得694f7894 v1（三范围），唯一[计划](../../../owned-resource-measurement/plans/ops-meter01-resource-measurement/plan.md)。固定base b2b；小模块20项合成目录/故障检查已完成，仍待独审及两个真实caller安全迁移，不能把纯模块通过称复用交付。Web已交DPERF当前排除式计量和Quick两个固定输入；当前冻结浏览器原件不改。

### OPS-001-16：执行前领取核对的有界投影（2026-10-07，待测）

GO只读VISUAL01 `types-actual/index.json` 两轮35文件共713,969逻辑B；各claim-live263条约189KB，含225 released/38 active，同序列化active约28,988B、本claim794B。此为重复传输/保存与手写冲突规则的候选，不解释九分钟壁钟，也不是token或实际回收量。原件保留于web-shared-overlays的固定证据，不复制进本计划。

个人发布后由Execution Lead与D04唯一owner排一个小Interface：复用现领取权威提供本claim身份/version/scope及必要active/handoff冲突投影，完整历史审计仍可查；不能仅取本claim漏冲突。保留review角色、handoff_pending、DB失败unknown和观察时间，不改变take/amend/commit原子性，不新增第二账本。精确scope/独立树尚未领取，NOT_RUN；先由一个真实局部consumer证明输出字节减少且拒绝语义不变，再决定扩用，不先造扫描器或审批层。

### OPS-001-16：慢因样本与交付计时边界（2026-10-07）

沿同一status/既有原件区分任务开工至完整验收、固定产品提交至实际用户部署、用户服务受影响至实际恢复三段；隔离Arc/AV失败不当作用户服务事故，少量样本不算团队失败率或排名。个人恢复须有当前启动/接单及可用观察，候选冷启动/兼容通过不替代现场结果。依据GO已核的[DORA指标](https://dora.dev/guides/dora-metrics/)与[价值流方法](https://dora.dev/guides/value-stream-management/)，不建第二时间账本。

Q01既有事件：16:23:07开工、16:31:06产品source、21:55完整交付；实际PG约2.9秒，仅最后约24分钟共享窗口等待有明确证据。其余壁钟不能都归为资源或代码执行，复盘既有fixture/调用入口准备、报告selector返工及审查交接。下一合适小片在同一有界工作段复用已审生命周期与纯结果解释接口，保留失败/隔离/真实归还，并据实际交接次数与起止比较，不由commit或检查数推效率。TIMING01/02显示已部署；当前尚未完成的是活跃记录采用和真实减等待效果。该后继不增加个人恢复前置，不重跑旧PG或重写原件。

### OPS-001-12/16：未来增长预算的单一计算后继（2026-10-07，待实施）

22:54:56容量检查在0child前停止；原负责人确认封存材料后，23:01:55重新选择同一次未消费恢复，23:03:29实际启动。该案例确认部分历史最大cap被继续当作未来增长，不能据此称必须删磁盘材料；本轮对账没有删除KEEP或降低真实保护余量。对应原件与两旧构建的精确继承映射见本任务status及Web唯一资源账本，不复制整份历史。

个人网页交付后，Execution Lead沿现资源owner安排最小纯计算Interface的实现准备：唯一账本中的条目显式区分仍可能增长、已封存stock和unknown，保存已有原件引用，计算候选完整floor；caller只消费这个当前计算结果及真实单项内在下限，不再手工max历史组合floor。复用现OPS14生命周期事实与已交OPS-METER计量边界，计算不拥有停止/删除权限，不扫描KEEP，不建新scheduler/审批层或第二状态源。

用本次恢复真实输入与一个普通局部工作段作为两个直接消费者，定向覆盖reserve一次、封存stock不重复计、unknown保守、当前候选只加一次、既有已消费运行floor不改变，以及拒绝缺来源/身份混淆的分类。具体精确scope/独立worktree与worker在后继safe slot领取，当前NOT_RUN；不是779发布、当前积压接收的新前置，也不增加模型额度。
