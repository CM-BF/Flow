# S01 独立审查

状态：APPROVED
Review target commit：65d7a57f807a5fdcbf379ec2b8d19b4f2d9bc90a

批准边界：仅固定target65d7a57的合同方法和四任务功能smoke片段。正式容量/超领/故障/浏览器后继未覆盖。

范围：首先只审实验合同与来源研究；实现入口与正式结果尚未产生。基线 `115b0dbdfa02db5483f9e9699852682ce699633c`；target `a553f3f71db29243b698f4bb953408f28a1529b9`，范围 `experiments/runner-capacity,docs/evidence/s01/research.md`。不沿用其他任务approval。唯一owner Mika，review者只读，将修复要求交回owner。

## 可复制审查说明

读取仓库AGENTS、plans/AGENTS及本任务plan/status，按find-skills本地优先方法检查。核对runner-capacity-probe worktree、branch、dirty及精确target。检查实验合同是否区分持久会话、原生session、声明槽、实际attempt、工具及观察连接；逐项核对测量起止点、n/分位数、丢ACK重放去重、浏览器关闭后执行、预算与独有资源清理。对照B01/LAB01/LAB02/R03原证据，不将旧读性能或observer当执行容量。本阶段无正式负载结果，无需运行压测；给出具体severity/阻塞性/位置/修复条件。只审当前固定片段，不批准未实现后继。

## 检查与结论

Execution Lead 与 Goal Owner 已独立读取合同 target `a553f3f71db29243b698f4bb953408f28a1529b9`（metadata `215398a289747175c5ae46231ca8d23bae2c5301`），接受方法并允许最多4任务功能smoke。反馈要求：100ms轻读循环single-flight；180秒总预算包含清理并预留时间；正式只先做4进程×16任务，仍须协调具体窗口。不是实现/容量结果approval。

独立worker `/root/b01_bounded_reads` 对215398a基线未提交草稿做只读review，未运行负载或改文件。首次smoke前提出：最终DB完成不能代替ACK/outbox清空；IPC发送失败不能跳过子进程回收；启动和关闭须共享截止时间；响应体应边读边限界。非阻断建议：清理失效race计时器、逐task核工具摘要、运行前后source hash一致。

Mika回应（2026-10-06 06:38 UTC）：补终态ACK等待、待发文件为空、runner退出IPC flush；IPC失败仍走kill/reap，清理runner并行且为center/DB留预算；readiness/HTTP使用共同work deadline，响应流1MiB上限；工具按task唯一性和摘要检查，开跑前后源码hash比对。修复后TypeScript noEmit0。首次功能smoke尚未运行，正式review须绑定后继实现commit与真实结果。

首次功能smoke暴露P2：attempt表无created_at或claimed_at，静态审查遗漏；原bfe49a4整体FAIL保留。Mika修复为首次claim不可变租期观测与实际completed_at/task.created_at同clock推导，worker已只读确认runners.ts计算来源，要求逐attempt唯一初次记录及量化边界保守判定，避免误称精确时间。正式复审待后继固定target及一次获准复核结果。

2026-10-06 06:43 UTC：功能实现复审target `53c8713cb8e6a3c9b7d869c896656dad4e7a086d`，[smoke-manifest](../../docs/evidence/s01/smoke-manifest.json)绑定首轮失败及修复复核。修复复核PASS，不将一次功能测试耗时作为容量结果；独立worker正在核源码、原始event/ACK/清理与哈希。正式review结论未收到前不标APPROVED。

## 最终独立结论

2026-10-06T06:43:50Z，独立只读reviewer `/root/b01_bounded_reads` / gpt-6-astra：**APPROVED**，target `65d7a57f807a5fdcbf379ec2b8d19b4f2d9bc90a`，scope `experiments/runner-capacity`。无未解决P1/P2；逐项核12源码配置hash/24事件/4终ACK/4工具/3正常进程退出/专库及outbox清空，首轮FAIL保留。首次租期推导的两个runner保守间隔62.542/62.374ms，量化限制已明确。运行2.821s是功能记录。非阻塞P3 typecheck时间已按真实log mtime补入manifest，不重跑。review者未运行测试/服务。详见[独审回执](../../docs/evidence/s01/independent-review.json)。
