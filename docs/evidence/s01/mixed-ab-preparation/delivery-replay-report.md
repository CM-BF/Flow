# S01：固定观察轨迹的交付策略成本

2026-10-07T15:20:55.102Z。唯一窗口 `s01-observer-delivery-replay-once:replay` 已消费、未重试。执行32796520b07d4eed9f34c7c1db757740b7e20452 / source d28166e81bcdbb9fb537b40144f7be07a2539130；单记录[delivery-replay-actual.json](delivery-replay-actual.json)，原五份receipt/raw保持。**两侧计量完整性PASS；不证明性能优化通过。**

本次同一2048条固定输入下，buffered的完整双向应用JSON编码量少528017B（80.318%），但parent fork至资源关闭的wall多47.394ms。它减少SQL事件粒度并推迟到finish聚合/发送，不是相同信息量的纯IPC比较；不能由字节减少推出更快。

| 口径（每策略仅一次） | per-query | buffered |
| --- | ---: | ---: |
| 输入记录 | 2048 | 2048 |
| 保留逐项sample / SQL聚合group | 2048 / 0 | 506 / 4 |
| delivery receipt消息数（含phase/summary，不含ready/result/control） | 2050 | 4 |
| 完整双向JSON envelope B（含ready/result/control） | 657405 | 129388 |
| 仅delivery receipt JSON B | 656662 | 128658 |
| parent fork前→close wall ms | 153.705 | 201.099 |
| parent发送start→close wall ms | 104.705 | 154.090 |
| worker record阶段wall ms（含等待/调度） | 98.066 | 86.758 |
| worker同步record调用累计 ms | 10.981 | 2.052 |
| 观测batch等待累计 ms | 86.470 | 84.188 |
| 同步finish ms | 0.188 | 61.396 |
| finish→首次callbacks drain ms | 1.342 | 1.445 |
| worker起点→首次drain ms | 99.855 | 149.849 |
| worker CPU user+system μs（至首次drain） | 24098 | 72800 |

所有完整精度值在原raw。record同步成本下降、finish明显增加是这次运行观测；没有重复样本、随机顺序、隔离单因素或归因profile，不猜finish具体成本来源。接收首消息→summary是98.963/149.599ms，仅接收区间，不替代共同parent起点wall。JSON字节来自应用JSON.stringify UTF8，不是IPC管道、TCP、内核字节、RSS或内存峰值。

固定trace SHA b65bdc168a504b5d7f301e17cdb184fa90695752bebc137ffdedb59adc6bc6f2 /491756B，1542 SQL+374 acquisition+132 transaction；从原O1 local-measure按ordinal选首2048，属于前缀样本而非全轨迹。原startedMs/elapsedMs仅输入数值，**本次没有新PG计时**。两侧新epoch/ordinal、64批×32记录，每批同setImmediate+1ms等待；顺序固定per-query→buffered，新Node进程，OS/JIT/个人自然负载混杂，后者状态UNKNOWN未探测。完整两策略含不同聚合和输出时序，不能解释原pool等待、4秒ACK失败、取消传播或128容量，不报SLO/稳定提速。

## 完整性与资源

两侧均known=true/无fault，固定receiver逐nonSQL字段和ordinal映射、SQL各phase/pool/role/category/outcome count/elapsed聚合及单summary/no-extra成立；reporter pending0/dropped0，parent control各1条57B且pending0/dropped0，结果消息之后另drain。process.send callback只表示Node IPC发送完成；parent实际校验收齐、worker close/EOF再返回，未把本地emit true当业务远端确认。

checkpoint15:18:36.341Z PID/PGID16786 same-PID exec Node；两serial worker16847/16948均close0/nullsignal、各stdout/stderr EOF、输出0B。OPS14 coordinator exit0/finalownedabsent/MERGED EOF、first/secondary/signals空，完整raw2655B；历史初始EPERM观察仍在receipt。观察到3个Node身份；Python caller与外部time/tool分别存在，不把它们藏成3个总OS进程。0PG/HTTP/Chrome/provider/install/个人操作。

自有TMP `/tmp/flow-s01-delivery-replay-6qq5l7ia` dev16777234/ino124268234：同identity空样本0B后删除，owner15:18:44.466Z仅精确lstat ENOENT，实际RETURN已回报。旧KEEP不读取/删除。five receipt/raw11950B；末TMP样本不是峰值，heap/OS物理峰值UNKNOWN。此前已固定trace/JS未重新写入，archive/source/meta原512KiB及trace2MiB分账保持，actual32MiB预算不是OS硬quota。

## 外层时间与授权

CLI caller持久化前671.476ms；Node coordinator输出前362.151ms；time-p real0.91s，exec tool wall0.807161334s、exit0；clock before15:18:35/after15:18:36为秒精度，保守外工具包围<2s。这些时钟不拼接成同一精确wholewall，人工封存另计。输入62bindings及编译manifest cf4fba750a7ea148398efe95c392d8cbf66154b9668eabbe45d0b345b7bcfdfb/full6JS realpaths紧前核符、五输出原ENOENT；外部紧前free20381409280B、operator准入free20380585984B，均≥floor14338424832B。manager声明无其他holder，未自行扫描/停止个人用户负载。旧KEEP/单reserve按经理完整sum保持。

本次whole60/work45+TERM2/reap3与32MiB已消费；无重试、第二窗口或后续launch授权。结果待独立忠实性审；原O1 FAIL/O2 NOT_RUN与严格4秒ACK/最终取消/unknown KEEP要求不因本诊断通过改变。后续若要找原原因，应依已知限制另定有意义最小片，不能直接加pool或扩大benchmark换绿。
