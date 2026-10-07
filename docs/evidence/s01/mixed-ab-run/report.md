# 固定事件写入优化 A/B：执行完成，未证明延迟收益

唯一窗口 `s01-event-state-ab-once` 已消费。execution `b75f1a2e250556265a24c825860e8549705b98cf`，复用 d3ba03a8 已审准备；A=`a3e670b906c1b65d586b7730ca19da83109f1dcc`，B=`aae1eb1054d75e78273e7c91ed048aeac80195da`。原始证据均保留，未重跑。两侧功能/清理门禁 PASS，但这一次固定顺序样本没有显示一致的延迟改善，不能据更短总 elapsed 宣称提速。

每侧8个runtime同处一个runner进程、各capacity16；两侧顺序运行，共4个child实例（两个center、两个runner），不是256个native进程。每侧128 tasks / attempts / fixture持久sessions，2304已持久事件与accepted ACK相符，窗口内1536次emit；全部最终成功，session.active_task_id清空，8份journal为空。没有provider调用或真实SDK容量测试。

## 样本与比较

下表单位毫秒，nearest-rank，分母逐行列出；原始全精度与分析方法见 [comparison.json](comparison.json)、[analyze.py](analyze.py)。HTTP计时包含实验fetch包装读取响应和重建Response的开销。

| 指标 | A | B |
| --- | --- | --- |
| event HTTP全部请求 n | 2304 | 2304 |
| event HTTP全部 p50 / p95 / p99 | 63.808 / 180.111 / 409.721 | 70.901 / 168.720 / 450.200 |
| event HTTP完全处于6s窗口 n | 1536 | 1536 |
| event HTTP窗口 p50 / p95 / p99 | 52.831 / 91.818 / 106.411 | 61.405 / 123.648 / 141.669 |
| center pool acquisition n / p50 / p95 | 7796 / 14.738 / 87.787 | 7788 / 16.074 / 81.887 |
| center transaction n / p50 / p95 | 3994 / 5.661 / 30.935 | 3989 / 6.111 / 33.035 |
| 已观察全部SQL调用 | 53279 | 48601 |
| SQL other / begin / commit | 41531 / 3994 / 3994 | 36867 / 3989 / 3989 |
| 精确runner-row-share调用 | 3624 | 3613 |
| 精确runner-row独占调用 | 136 | 143 |
| 轻读 n / p50 / p95 | 59 / 2.966 / 52.912 | 58 / 3.080 / 77.088 |

两侧均无记录到的runner HTTP错误，全部返回200；HTTP数分别3760/3756，heartbeat1320/1309，claim136/143，因此分母和背景事务并不完全相同。轻读最多2个并发，均0次门限跳过。SQL all计数少4678；`other`聚合多种语句，不能把该差值全归为task UPDATE，也没有对persistEventState单独计时。源码仅把同事务三次task更新合并为一次，其他exported生产源码一致；非runtime测试差异未参与执行。

pool/transaction统计包含setup、任务提交、heartbeat、claim、轻读和收尾，不能称为纯event SQL时间；SQL耗时也不是纯锁等待。每侧56个pg_stat_activity样本中9/7个出现Lock或blocker，采样连接峰值12/11（不含该observer），不是持续连接峰值。当前精确FOR SHARE分类生效，不回填旧128结果的UNKNOWN。

## 真实持续行为与观测开销

两侧logical adapter peak均128；最早adapter end距window start分别6000.200/6000.025ms。每个attempt窗口内12次emit ACK，首末跨度A5437.500–5551.493ms、B5433.124–5555.952ms；128条ACK包络共同跨度5397.234/5413.456ms。各30个完全落在保守窗口内的DB查询验证同一128身份 live/fenced；首query结束→末query开始分离5782.395/5774.477ms。仅证明采样时刻，不是连续锁/租约证明；adapter整体重叠包含barrier等待，ACK包络不表示CPU持续运行。

观察器分别记录78998/74291条，child/center均报告dropped0；SQL、pool、IPC、Node流采样均有开销。两侧同配置、同observer，固定A→B顺序，主机缓存/调度/共享PG背景仍是混杂，未随机化或重复。B的driver沿用A的同PID与内存分配，不能把其更大RSS归因到events.ts。RSS按进程采样：A driver/center/runner最大226689024/283000832/315326464B，B346374144/285114368/284475392B；各13/14/12样本。各自高点不能相加为同时整机峰值；DB/WAL实际增长、结束占用与峰值未测。

## 时间、预算与资源

工具调用开始05:59:51.473Z，工具最终返回在06:00:31.510Z被观察，40037ms是保守工具包围（含轮询/模型间隙）。`/usr/bin/time` real28.02s；内部entry到CLI前27.710442s，均小于300s。A最终13.721410s、B13.598121s，只是各自完整操作耗时，不是吞吐收益。自动result.json保留写入前快照；CLI的finalEvidenceBytes260653比磁盘result内257525多自身最终写入，不能用前者/后者互换。

实时可见预算191067625B / 536870912B，已含共同4MiB最终receipt/CLI/archive预扣和各侧1MiB归档预留。A88044501B、B85081982B，其余为共同输入/导出/证据。输入Git读取与导出、流/IPC有保守重复计量；不称全OS I/O或物理磁盘。后续本报告、分析、manifest、外部tool原文及唯一status/review使用既有4MiB共同预留，不另增额度；最终包记录其实际剩余，不重复把全部runtime raw再当新增支出。

spawn前fresh host可用24539099136B，超过5663621120B门槛（原共享floor+512MiB实验+额外1GiB PG/WAL预留）；准确55432集群PG16.13、非recovery、WAL当前67108864B，data/pg_wal同容器文件系统可用20725996KiB。这里只确认准入，1GiB预留不是硬配额；没有结束/峰值WAL测量。

四个child均正常close exit0、无forced/no signal，stdio随child close结束，两个runtime组均active0、reporter无丢弃。两个专库正常DROP/absence原回执保留；06:00:50.057Z独立只读确认两个名字existsfalse/connections0、确认pool已close。入口及4个child精确PID查询ESRCH，未把PID不在当独立进程组全扫描。两journal工作根与输入导出根精确lstat ENOENT，retainedfalse；没访问旧unknown根。该时点立即向Mika归还实际窗口，之后仅离线封存。

本结果等待独立忠实性审查，未main接收；不是最新main、真实native/token/SLO或完整S01验收。原idle测量、S01P07产品接收和未完成ACK/browser要求独立保留。
