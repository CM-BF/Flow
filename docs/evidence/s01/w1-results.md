# S01 首个团队静默窗口结果（限定 APPROVED）

固定实现9da9de1b6778afec5219e55f39b53b365c8cf900；窗口S01-W1-20261006T070330Z，UTC07:03:30–07:04:30。生产基线115b未修改，常驻服务保留。

本次程序完整校验通过，独立worker于2026-10-06T07:07:22Z限定批准固定结果9e10e0949f3f9977e21cf8aab63e56f5f9231157，无P1/P2；批准范围是本窗口的执行事实与结论边界。8任务协议门禁的8并发claim仅分配2个唯一attempt（capacity2），无adapter执行；门禁清理后进行128空会话背景、16任务、4个runner×capacity1，attempt峰值下/上界均4。IPC观察的adapter峰值4、工具峰值4（接收时间近似，不当精确跨进程计时）。

16 fixture任务成功并verification passed；96runner events、80timeline、96workspace（含16accepted）在固定程序内分别核验，产物逐task字符串/摘要匹配。原始sender事件留存，但清理后未保留DB/public完整rowsets，不能独立重造为原始实测数据。

门禁2.333秒，正式3.648秒；正式总时长包含128会话创建、进程启动和清理，不能当作16任务吞吐窗口。共同放行至观测全部terminal的父进程区间约1565.611ms，仍非逐任务精确执行时长；gate1+formal5自有进程正常exit0，无强杀，两专库remaining=[]，outbox=[]。本窗24tasks/18attempts，累计32tasks/26attempts、约13.135秒阶段用时，0模型/云。

## 有限样本延迟（毫秒，nearest-rank）

| 指标 | n | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
| 任务等待（含人为启动等待） | 16 | 743.000 | 1470.000 | 1470.000 |
| adapter emit→ACK（含outbox） | 80 | 11.827 | 35.549 | 36.594 |
| event HTTP→完整响应 | 96 | 10.059 | 31.510 | 34.600 |

每个轻读端点首次与后续分开；总snapshot4、events4、workspace3、conversations3请求，全部成功；对应activeObserved为3/4/3/2，定义为该请求之前最近一次SQL的running观察数，不能保证整个请求期间一直在执行。setup/verification请求不计入这些延迟。后续样本分别n=3/3/2/2，p95为7.045/5.675/17.772/3.851ms；有的首/后样本最近SQL只观察到queued，原始activeObserved/queueOnlyObserved分组保留。n极小且队列人为预受理，不作吞吐SLO或稳态尾延迟结论；n=16的nearest-rank p99就是最大样本。

中心26次采样观察最大HTTP在途5、TCP10、SSE0，RSS约133.5MiB。PG15次采样：center+scheduler合并最大8连接，observer1；配置pool max8/3不当实际分池使用。42次本人只读/准备查询累计约108.36ms（含setup/verification）；pool等待未测。16个dispatch-ready首次样本均已true，左侧未知，不能推出精确调度延迟。

本实验poll interval为50ms，生产runtime默认500ms；这是明确参数差异，不能把本次调度等待直接当生产默认表现。

Node24.20.0、PG16.13、Apple M3 Max/16逻辑CPU/64GiB；loadavg结束时7.52/10.99/12.71。此为团队测试静默窗口，非隔离机器。128只是空Flow会话对象，真实fixture native sessions为16，不能称128agent容量。

后继建议：W1验收无需补任一可选对照；若Goal Owner决定继续，优先1进程声明capacity4的12任务场景。runtime逐次await execute，下一场景回答声明容量与单进程实际执行并发的差别。1进程capacity1的16任务对照可暂缓；12与16任务整阶段时长不能作加速比。丢ACK/浏览器目标仍独立开放，尚未运行；没有领取新窗口。正式结果不使完整S01或Flow目标完成。

证据：[manifest](w1-result-manifest.json)、[gate raw](w1-protocol-gate/result.json)、[formal raw](w1-four-processes/result.json)、[窗口许可](window-authorization.json)。

独审证据：[结果审查回执](w1-independent-review.json)。原manifest及两份raw原封保留；manifest中的pending是冻结时的历史状态，当前批准以独审回执为准。原保守预算64tasks/64attempts/180秒与实际32tasks/26attempts/13.135秒分别保留，未运行组不算已消耗实测attempt。
