# S01 停止修复后唯一混合窗口结果

**运行PASS，结果待独审。** window mika-s01-after-drain-20261006-104557；已审实现51541b0cad73dcad32c7374dc87d631f0b9a8432，实际clean HEAD5ea1b26f23fd7f24d1b89199a10b553dcab7fc18，固定main0cee7556。只运行1次，0provider/0nativeSDK；32tasks无补跑。旧一次窗口仍FAIL，原raw与FKye9L journal没有修改或操作。

| 原始证据 | A 1×16 | B 4×4 |
| --- | --- | --- |
| 唯一真实task/attempt | 16/16 | 16/16 |
| gate内runner数 | 1 | 4 |
| 前3秒实际重叠 | 16 | 16 |
| 终态 | 12成功、4取消 | 12成功、4取消 |
| 持久事件、逐项ACK绑定 | 505 | 522 |
| 正常adapter最短实际窗口重叠(ms) | 6000.02 | 6000.056 |
| 取消adapter最短实际重叠(ms) | 3433.247 | 3154.391 |
| 最后completed ACK晚于window标记(ms) | 448.455 | 124.766 |
| 轻读请求/跳过 | 57/1 | 58/0 |

32个唯一claim/adapter身份与DB task/attempt/ownerVersion/live lease相符；1027个事件ID唯一，每attempt sequence连续1..lastSequence，id/sequence/digest/fence与ACK逐项匹配。每个attempt有窗口内emit和heartbeat。4取消均具备受理→cancel heartbeat→adapter停止→cancelled completed ACK证据，余12成功ACK均在固定1500ms settlement内。5份admission journal均inFlight=null/assignments=[]，没有保留本次unknown/outbox资源。见[独立原始数据复算](analysis.json)。

child timer window-end标记为A 5999.585417ms、B 5999.990541999998ms，略早于6000；严格重叠依据是同runner child时钟上每个adapter-end相对window-start的实际区间（正常最小值如表），不是timer标记，也不混用跨进程时钟证明重叠。

CLI最终耗时19271.849875ms，包含driver开始的输入预核、两组、settlement、资源清理和最终证据写入；不包含随后离线分析/归档。自有runner96467和center96466均自然exit0，无TERM/KILL强制；唯一数据库已DROP、新workdir3K9lpJ已删除，现场存在性false。本次retained=[]。最终Node流/IPC/证据保守计量36092931B，完整性true；额外归档逻辑字节与metadata余量见[归档上界](archive-budget.json)，不声称系统网卡/TCP重传字节。

**保留一次HTTP错误：** A settlement的/api/runner/heartbeat，elapsed26.223792ms、aborted=false。原观测没有status、错误类别或attemptId，原因未知，不能归因abort或已完成竞态。它没有破坏最终ACK/journal/cleanup门禁；本结果不是零HTTP错误。

下列只按父进程接收时phase筛选center观测，数值为n / median / nearest-rank p95 / max，单位ms：

| 指标 | A | B |
| --- | --- | --- |
| pool acquisition（含建立连接） | 1085 / 0.289 / 135.981 / 365.371 | 1175 / 0.2 / 23.34 / 66.811 |
| transaction elapsed | 567 / 35.698 / 132.614 / 259.71 | 615 / 14.513 / 42.098 / 87.336 |
| runner-row query elapsed | 495 / 34.17 / 159.195 / 230.603 | 541 / 5.635 / 27.818 / 53.718 |
| Lock或blocker正采样/总样本 | 32/61 | 5/60 |

正采样表示观察到等待/阻塞，miss不表示零等待；query elapsed含执行/往返，transaction含锁，不能HTTP相减得到纯lock时间。A→B固定顺序、warm-up、父接收phase边界与背景负载都有混杂，不作严格speedup、因果改善、容量SLO或>100agent执行结论。loadavg从[12.505859375,13.45263671875,12.74755859375]到[11.1572265625,13.0693359375,12.625]；30061条观测，IPC in 6626635B/out 2850B，345个driver查询。没有未观测对照，精确额外观测开销unknown。

本片仅证明固定本机0模型混合负载的A/B门禁及正常停止收束；完整未知claim恢复、真实provider容量、其他拓扑与旧journal恢复仍未验证。
