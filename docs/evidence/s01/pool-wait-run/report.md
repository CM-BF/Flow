# S01 queue-delivery：O1 FAIL，O2 未运行

唯一窗口 `s01-pool-wait-delivery-once` 已消费，未自动重试。执行固定 `67d0c84d3e8a629d78335b8866173e04d7249e36`，caller source `375ecccc427acf59d687153903bd032fb6e684bc`，生产输入 `4fdd856293a502209d7509ea37da901bbfd89f72`；input-v2 SHA `970f071eb7eb275145c81a6b6d0f6193ed5737c6e0a2b48051ada414f3819512`。本次不是最新 main 或真实 SDK/provider 容量验收。

O1/per-query 返回 `insufficient_window_ack_span`，随后保守收尾记录 `admission_or_outbox_retained`；O2/buffered 按“上一侧成功且资源完整关闭”门禁保持 NOT_RUN。外层 tool exit1、自动 verdict FAIL_OR_UNKNOWN、resources UNKNOWN_RETAIN 原样保留。不存在可比较的两侧结果，也不支持 IPC 优化收益、纯 pool 排队归因或 SLO 结论。

## 已观察结果与未完成证明

- 专库总计 129 task/attempt/session：一个已完成合成聊天与 128 fixture 负载；不是 129 provider 调用。128 个负载 task/attempt 身份唯一，门禁有 128 行。六秒 window-end 已到、settlement 在期限内；但是 37/128 attempt 的符合窗内过滤条件的首末 ACK 跨度小于 4000ms，最小 3821.433ms。完整持续负载证明失败，不能因 activeAdapters=128 或所有 adapter 已结束而改为通过。
- 窗内每 attempt 有 5–6 个符合过滤条件的 emit ACK；观测到全部 adapter 活动区间交集 8784.564ms，只是同 runner 单调时钟的活动区间。window-end 存在 228 个在途 HTTP、128 个 pending emit，不能把这些当已完成吞吐。
- 真实合成聊天轻读 issued20/settled20/succeeded20，另 38 次因并发上限未发。driver send→校验完成 p50 617.540ms、p95 955.609ms、max974.251ms；分母20，不是所有请求或无负载基线。
- 四个取消命令均有 ACK，driver send→ACK 494.700–495.553ms；runner signal→adapter-end 352.586–429.629ms，同身份、signal 后未观察到新 emit-start。不得跨 driver/runner 时钟计算 ACK→signal。原 `validateWindow` 先失败，所以最终 task/event/final-state/cancellation 完整验证链没有执行；completion ACK 中 124 succeeded/4 cancelled 与最终数据库 129 completed_at 非空、0 active session 只是分列的部分事实，不能代替被中止的正式断言。
- 全过程 runner HTTP issued4493/settled4493，4387 response records 与106 abort error records全部保留，缺失结果0；不把 abort 从分母删除。center delivery 记录71690条、dropped0、known=true；每 query 的 IPC/序列化观察开销仍在本侧实际路径。

详细 nearest-rank 分布和分母在 [analysis.json](analysis.json)，原始89167条观测在 O1/observations.json。center 本地 measure 的 acquisition n2983/p50 329.417/p95 807.264ms，transaction n1425/p50 33.131/p95 64.793ms。acquisition 是 connect→settle，含可能的新建连接；waiting/total 是 settle 时采样，不是 arrival queue 或完整峰值。transaction 是 BEGIN→COMMIT/ROLLBACK，不是 checkout hold。local measure 与 IPC driver phase 不是校准后的共同六秒；不能相减 quantile，也不能与旧 A/B 不同 source/方法/背景样本直接认因。

## 收尾、保留资源与时钟

同 PID checkpoint 实际 START 为 2026-10-07T14:05:05.778649Z，PID/PGID100；center108、runner173。原 outer endedAt14:05:30.030995Z，两个子进程均正常 close0，外层 group absent、双 EOF、1926B完整捕获，signals/secondary=[]。外壳 `processClosed=false` 是其 first_failure 非空时的保守汇总，原字段没有改写；实际 first_failure 为 CHILD_EXIT_NONZERO，不能把业务 FAIL 当活跃进程。

专库 `flow_s01_mixed_100_4187789a46fc413f88394a2b387a88e1`，OID1321954，marker66316f87-5c8a-47a9-8875-08b1d1759534：CREATE 前 reservation 和 ACK 原件保留，原普通 DROP/absence 成立。独立 exact 后查14:08:08.536Z pg_database0/pg_stat_activity0，后查 pool已关闭。14:07:56.949Z exact PID100/108/173均ESRCH、59253端口connectEx61。没有停止他人服务或再次DROP。

两个目录继续 KEEP，仅 fresh lstat、不读children或清理：`/tmp/flow-s01-mixed-Zwn2dy` dev16777234/ino124181018；`/tmp/flow-s01-ab-input-9145b45f-55c9-40a7-be03-74f58dd8c739` dev16777234/ino124180211，均真实目录无symlink。原 journals.json 的八份 v2 journal assignments=[]，但原 unresolved=true 仍保留。静态控制流说明：持续证明失败使 queueVerified 尚为false，finally 不启用只在完整验证后可用的 v2 清空判定，因此保守 KEEP。这不是原未知 journal 可安全删除或未知副作用已解除的结论。任何后继清理/修复需独立范围与许可。

活动资源于14:08:08.536Z核对后 RETURN（root已确认转manager），保留文件不冒已删除。所有新后查均仅本窗口 exact identity，未访问历史 unknown 根。

时间分列：time-p real24.56s；entry final24.130684s/beforeCLI24.130689s；outer持久化后24.466051s。工具前秒级clock14:05:05Z、完成观察14:05:58Z给保守≤54s观察包围，工具分段poll wall不相加作wholewall。离线归档/后查不回填自动300s运行时间；原 snapshot、stdout、exit均保留。

## 预算与背景

原自动累计139378995B=O1 124007054B+common15371941B，包含原共同4MiB final reserve、侧1MiB archive reserve，低于512MiB；不是RSS/磁盘物理峰值。observations43858197B已在侧账本计入，不因封包再次加原raw。source export新写4,931,265B与其他传输/证据逻辑量按原类别分别记账。手工封存仅用原4MiB final reserve，独立清单在结果manifest。

准入floor9296871424B；caller freshfree21529296896B。PG/WAL同文件系统前置available17977740KiB，WAL起始67108864B；end/peak未测，另1GiB headroom是调度预留而非硬cap。675固定源/33SQL、121local/external绑定与clean67d0已在预检核对；原runtime源码/输入/历史raw未改。

已声明个人3个常驻服务/15连接以及此前running用户任务后续UNKNOWN，未读取个人状态；Web普通节点段当时仅potential，未获实际START信息，实际重叠UNKNOWN。共享机器背景与观察负担不是受控常量；不将更短elapsed或部分轻读通过称性能优化。0provider/native/Chrome/安装/个人操作。

本次复用既有find-skills/codebase-design/固定clean-code方法核对单一监督、身份/错误、有限计量与状态权威；只离线分析真实原件，没有修源、重跑工程检查或创建新测量框架。当前结果待独立忠实性与最小根因审查，整体S01原开放TODO保持。
