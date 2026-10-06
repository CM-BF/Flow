# S01 W2 声明容量对照结果（待独立结果审查）

本机1个runner注册capacity4，固定12个fixture任务的保守attempt峰值下/上界均为1；adapter/tool IPC观察峰值均1。该负载下仍串行执行，与固定生产base115b中runRunner逐次await execute的源码一致。四slot是中心允许的上限，本次不能把它当单进程已经实现的执行并发。

本次程序校验通过：12tasks/12attempts全部成功且verification passed，12工具摘要/12初始claim/12终ACK/outbox完整；72runner events、60timeline、72workspace在固定代码内分别核验。DB/public完整行集在清理后未留存，认可程序断言与保留的sender/attempt/ACK证据，不能重构成实测原始行集。128仍是空会话对象、零turns，native sessions实际12。

授权S01-W2-LEASE-0734收到三队全槽QUIET_ACK后执行；实际进程墙钟07:36:13.218→07:36:21.191，7.973秒，内部stage 7.790秒含setup/启动/清理；父进程放行到最后terminal观察约4993.256ms，不是精确纯任务时长。两个自有子进程正常exit0、无强杀，专库remaining=[]、outbox=[]、临时目录移除，已立即QUIET_RELEASE。先前两个固定预约和过期租约均0运行，没有重跑。

实现2ab7967f2eb808fecd1205f7552a119eee8e0b36，实际执行HEADa6260adaa96d63941bffef4783891dd51ef5d655；18运行source前后同hash，生产apps/packages仍base115b。Node24.20.0、PG16.13、Apple M3 Max/16逻辑CPU/64GiB，结束loadavg6.11/5.85/8.44；常驻服务保留。poll50ms与生产默认500ms不同；每task一次64KiB工具与显式200ms等待。不是真实模型或100执行agents容量结论。

## 样本与限制

| 指标 | n | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: | ---: |
| 领取前等待（含预受理/启动） | 12 | 2439.000 | 4900.000 | 4900.000 |
| emit→ACK（含outbox） | 60 | 12.523 | 31.907 | 35.816 |
| event HTTP→完整响应 | 72 | 10.391 | 27.605 | 32.771 |

nearest-rank，n12的p99等于最大样本；不能作稳定tail/SLO。snapshot/events/workspace/conversations的load读取n分别12/11/11/11，activeObserved分别10/8/9/10；这是最近SQL的running观察，不保证请求全程active。首次与后续分开，后续n11/10/10/10，p95分别9.199/6.559/18.899/8.472ms。setup/verification不计入这些读延迟。

center 65次采样：HTTP在途最大1、TCP4、SSE0，RSS最大141099008B。PG 46次采样，center+scheduler合并最大6、observer1；不拆分实际pool用量，pool等待未测。105次本人setup/load/verification查询共206.570ms，不混作纯load查询成本。存储计量12724444B，包含最终结果，低于64MiB。

## 已确认差异与后继

W1四个capacity1进程观察峰值4；W2一个capacity4进程观察峰值1。它们回答配置与执行方式的差异，**12与16任务整阶段时长不作加速比**，也不单凭这两点证明scheduler、DB或模型就是瓶颈。独立结果审查完成前不扩大结论。

累计44tasks/38actual attempts/38budget-charged attempts，stage用时20.925025秒，原64/64/180秒/64MiB不变；capacity1/16暂缓，ACK2/browser2仍开放。GO允许先在原S01计划内做0调用只读有界slot方案，涉及runtime/outbox时须与CHAT08 owner协调，不抢共享源码；不先写通用调度框架。

后续少量功能峰值检查优先独有进程/DB与背景记录；严格性能对比再协调团队静默，避免协调成本超过实验。该方法改进不追改W1/W2的实际静默与失败预约记录。

证据：[manifest](w2-result-manifest.json)、[raw](w2-declared-four/result.json)、[许可及全ACK](w2-window-authorization.json)、[执行墙钟](w2-execution-receipt.json)。
