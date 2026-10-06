# WPF-DPERF03 单次看板 Git 观察预算

状态：in-progress；2026-10-06；owner workspace_panels_owner / gpt-6-astra ultra。
直接父 [D01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard/plans/d01-execution-dashboard/plan.md)，co-lead Web /root。遵守[统一模块规则](../../AGENTS.md#modular-design)。

目标：降低同次工程看板聚合的重复 Git 读取，并限制实际并发子进程，保持来源、实现证明、dirty 与 unknown 语义。固定基线 eb95fba43b0305db0dd40dfe85ccc0d58eb9a6ea；唯一分支 codex/dashboard-git-snapshot。首六scope见[原receipt](../../docs/evidence/wpf-dperf03/take-receipt.json)，不改 registry/server/UI 或其他owner状态，不操作4320/个人服务。

## Interface 与验收

见[小Interface](../../docs/evidence/wpf-dperf03/interface.md)。每次 aggregate 建立独立 context，以两个方法隐藏调度/同snapshot main观察复用；原独立 observeGit/proof 调用仍可用。所有真实 Git child 入口包括 git show fallback、ls-tree serial bisect 共用每context并发4。原stdout、5秒child timeout、2MiB maxBuffer、literal范围、错误代码与unknown保留。

主线dirty对照captured SHA；dirty/untracked完成后核一次实际HEAD，不符unknown。没有跨snapshot TTL，不缓存proof/tree，不声称原子快照。既有DPERF01同target证明复用、DPERF02批量tree保留。

## TODO

- [x] **WPF-DPERF03-01** 核固定输入、规则技能、领取与最小Interface
- [x] **WPF-DPERF03-02** 实现共享执行预算与主线观察复用并保持所有入口兼容
- [x] **WPF-DPERF03-03** 直接行为/消费者回归与有界临时Git实验、原日志和hash
- [ ] **WPF-DPERF03-04** 固定实现独审、提交交接与main事实收口

实验累计≤45秒，含≥10秒预留清理，raw≤8MiB；35秒停止新样本，失败安全点评估剩余，超限partial不续跑。临时Git只自有目录，不读真实registry、不访问API/产品PG/provider；领取账本read另列。必要原消费者回归单列，不重做既有benchmark。原研究1/4/8repo启动4/16/32、四proof28starts为输入事实，不是本轮实测或CPU/SLO。新增HEAD核对后四proof最初预计23starts；本轮实际23，来源和限制见validation。所有检查按实际来源记录，不能为数量造绿。

风险：排队延长观察窗口；HEAD末核不能检测A→B→A或工作区各查询间变化。并发4是资源政策，不等全进程/全实例上限。索引/registry与架构图由Lead统一更新；本片不越权写。

12:14:24.927Z 原子amend至7scope：[回执](../../docs/evidence/wpf-dperf03/amend-receipt.json)。新增现proof-snapshot.test只更正committed命令计数识别，原4行为完整保留。固定实现 5609ea719ec400a803bb6036429312b7a212c90f；结果见[validation](../../docs/evidence/wpf-dperf03/validation.md)，root 12:18:07 UTC独审APPROVED，main待接收。
