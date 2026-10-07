# c1 首次实际运行：输入物化缺口

执行 HEAD `60ffa4365abf6185a4138507067fe8c75f97aa3a`；产品目标仍 fe6。外层实际 exit **1**、唯一 FAILED terminal seal 与 binding/result/budget/step hashes 一致。strict noEmit exit **2**（1649ms）；direct **NOT_RUN / 0 tests**，无 Vitest result；browser 未运行。

[node.log](packet/node.log) 的原始失败是 contracts/index.ts 导出既有 goal-plan-confirmation 模块缺失，继而 client 两个类型导出无法解析。该文件在固定 HEAD 已跟踪、index 为 skip-worktree S、磁盘缺失；2388B 固定 blob hash 见 [manifest](archive-manifest.json)。这是 provision 输入缺口；不证明组件业务回归，也不证明其通过。父 result 的 `Structured result validation: vitest-results.json` 是类型失败后未进入 direct 的后续诊断，不替代原始类型错误。原 Lead 才可物化该既有 blob；本 owner 未改公共源或 Git 配置。

计时以更晚唯一 terminal `afterFinalWritesElapsedMs=1875` 为准：累计 **1875ms / 30000ms**、剩余 **28125ms**（含原清理预算）。较早 result/budget 1874/28126 原样保留，不能回增 1ms。PGID 53843 与 scratch absent、cleanup errors=[]；接收依据为原监督终态，未另探测进程。worker 日志397B、EOF true、dropped0；外层 stderr0B。

[root 独立原件](root-actual-review.json)限定接受失败证据与输入阻塞，非产品批准。外层[实际退出](outer/actual-exit.txt)、[完整stdout](outer/stdout.txt)、[步骤](packet/step-results.json)、[结果](packet/result.json)、[预算](packet/budget.json)逐字归档；所有字节/hash与原路径见 manifest。窗口已交还，未重试、不打开 b1；下次须输入修复、重新绑定及新单次准入。

后续供给：[Execution Lead receipt](source-provision-receipt.json)记录02:28:49 UTC仅物化固定HEAD同一缺件、347既有输入不变，owner只读核磁盘2388B/hash相同。本目录原run记录仍按执行当时缺失状态保留；供给不代表检查已通过，后继包需重新绑定，未运行。
