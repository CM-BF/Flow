# S01 W2 最小声明容量对照准备

owner Mika / gpt-6-astra；唯一worktree与claim沿用S01。Goal Owner 2026-10-06明确批准准备；**尚未取得运行窗口**。固定源码与检查摘要见w2-readiness-manifest.json（固定后生成），准备批准不等于运行批准。

## 问题与最小方法

1个真实runner进程注册capacity4，在128空会话背景执行12个固定fixture任务；每task一次64KiB写/读/hash、显式200ms等待，0provider/云/模型。继续固定生产base115b，poll50ms（生产默认500ms）、heartbeat1000ms、request timeout3000ms、lease10000ms、single-flight读循环100ms。12个task先全部受理再放行已ready runner。

声明capacity由API注册后真实DB核验；attempt初始claim身份/租期区间、adapter/tool IPC区间分别计量。按真实注册capacity核每runner峰值上界，**不要求串行，也不要求达到4**；runtime的await execute只构成预期，不预设测量结果。12个任务成功/verification passed、72runner events、60timeline、72workspace含12accepted、12工具摘要/终ACK/outbox、独有资源清理必须完整。保存registeredRunners及perRunnerPeaks；时间来源/精度/IPC限制同W1。若观测无法区分并发，报告未知，不重跑求结论。

此场景不能与W1的16任务整阶段时长求加速比。每端点保留实际n、first/subsequent与activeObserved/queueOnlyObserved，无SLO/100agents/provider能力结论。

## 入口、预算与清理

只新增`experiments/runner-capacity/declared-four.ts`；固定场景解析器只开放原four-processes与declared-four，前者因已有receipt禁止重跑。smoke保持关闭，capacity1/16控制不开放。入口仍要求FLOW_S01_WINDOW_ID；实际运行许可另由GO协调。

申请**最多30秒含清理**，工作20秒/清理10秒；1个center+1个runner，系统动态端口，独有随机DB/目录。至多12tasks/12attempts，原64/64/180秒/64MiB总限额不变；W1后已用32tasks/26actual attempts/13.135276166秒，本次完成最多44tasks/38attempts。保留剩余control16、ACK2、browser2预算；不新增smoke或重跑。任何失败保留原始证据并停止自动后继，正常退出/零DB残留/outbox完整必须如实报告。

预算守卫：claim-grant与report-start及已保留DB身份取并集去重；失败或计数不完整按reservation保守扣额，known observations与budget charged分开。无完成receipt继续failclosed；未知历史缺可靠reservation拒绝。仅两个已独审smoke按原始SHA兼容各4tasks/4attempts，不修改raw。所有当前32/26历史事实保持不变。

准备阶段只执行纯unit与noEmit，不创建新PG/runner/浏览器负载。代码固定后由独立合格reviewer审查，取得批准才申请时间窗口。
