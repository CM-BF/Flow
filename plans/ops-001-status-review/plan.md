# 计划状态与独立审查规范

| 字段 | 内容 |
| --- | --- |
| 计划编号 | OPS-001 |
| 状态 | `completed` |
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

资源预检以实时可用空间和本片物理峰值为准，不以逻辑文件上限或一次小检查通过代替。大型准备须保留数据库/证据/其他队伍收尾余量；不足只暂停该大型操作，小范围工作按其实际预算继续。清理限定已结束、自有、身份明确且可重建的临时资源，不删除用户数据、其他owner资源、active/unknown或原始审查证据。当前数值与解除条件见唯一[status](status.md)及SVC06状态，不另设资源状态权威。

- [ ] **OPS-001-11** 共享资源可逆回收：复用已验证的每worktree sparse方法，限定本队已交付/released/无消费者目录，保护所有源码与权威证据；按实际卷变化判断局部验证是否恢复。每批数量与停止线按当前明确授权；next12b 已12/12到限停止，历史8棵/2.75GiB不是可反复使用的授权。实际回执见status，不替代SVC06准备门槛。

- [x] **OPS-001-12** 将真实运行入口的动态资源/浏览器定位预检收进既有[局部验证方法](../../docs/quality/local-validation.md)，避免准备遗漏消耗独占窗口；不新增工具框架或重复通过检查，原失败、独审和累计预算保留。

- [ ] **OPS-001-13** 提取最小test-only有限连接观察：先核TUI既有observeConnections，再以两个真实消费者验证zero/busy/unknown，不拥有DB删除或资源归属；沿[局部验证后继](../../docs/quality/local-validation.md)。
- [ ] **OPS-001-14** ready（当前发布/F04短片收口后下一工程改进）：消除重复的operator/测试进程期限实现。先比较O16与SVC05H的两个真实消费者，结合SVC07的EPERM收尾覆盖原失败事实，固定受监督PID/自有组、独立期限、输出上限及primary failure/cleanup unknown接口；detached个人服务永不由其停止。独立scope与至少两个实际消费者验证，不合并DB删除、资源归属、源码绑定或连接观察职责；当前已固定恢复/F04候选不为迁移重开或重跑。
