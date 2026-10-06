# S01 mixed 唯一窗口：FAIL，保留 A 组有效观测

窗口 `mika-s01-mixed-20261006-100634`，2026-10-06T10:08:27.888Z 开始。执行 HEAD `12154f16f6a5e480bc3de64f96d1019102d56c0d`；已审实现 `634926238f749fb1547a5973b521bc6dc5498574`、生产基线 main4391。一次执行，exit 1，含清理 **10,673.1145 ms**，保守计量 **18,660,992 B**，计量完整标记 true，provider 调用 0。这是部分实测的如实失败交付，不是两组合同通过或容量 SLO。

原始结果见 [result.json](result.json)、15,510 条 [observations.json](observations.json)；最终 CLI 原文 [stdout](cli.stdout.txt)、空 [stderr](cli.stderr.txt) 及 [回执](cli-receipt.json)。六份 driver 原始文件的字节/hash 在新增归档文件前固定于 [raw-freeze.json](raw-freeze.json)，从未重写。授权记录是 parent 消息转录，见 [window-authorization.json](window-authorization.json)，不冒充原子账本回执。

## 实际运行与停止

只运行 A：单 runner、单 runner child、16 个实际 task/attempt。16 个 task POST 均返回 202；16 个互不重复的 claim 身份与 DB task/current attempt/runner/ownerVersion=1 匹配。gate 的 16 行均 running、live=true、completed_at=null；gate 快照在全部 adapter-ready 后、window-start 前。每个 attempt 都有窗口内消息 ACK、心跳和真实 adapter 活动区间，首个 adapter-end 在窗口开始后 3,729.492083 ms，支持前 3 秒实际重叠 16，不由 fixture 对象数代替执行。

A 的 windowComplete=true，实际同一 runner 时钟窗口 6,002.126375 ms；settledByDeadline=true，最后 completed ACK 在窗口结束后 148.7775 ms（同一 parent 接收时钟，低于独立 1,500 ms 收束限）。正常 12 个 succeeded，预定 4 个 cancel 均有 owner 接受、heartbeat cancel、adapter-end 及 cancelled completed ACK。16 个 verification_status 均 passed。437 个窗口消息 emit ACK、144 个全阶段 heartbeat、59 个轻读 HTTP 200（无 skipped）。这不是每个消息严格按 5 Hz 到达的时延保证。

DB 保存 533 个 runner_events；每个 attempt 的序列连续至 last_sequence，每条 event 的 attempt/sequence/event ID/digest 均对应发送端观测的 ACK，ACK ownerVersion=1。摘要 digest 来自运行时完整事件计算；没有归档全文，因此只读复核比较两端已保存 digest，不声称从缺失全文再次计算。每 attempt 的检查与时间见 [analysis.json](analysis.json)。

固定停止门禁发现 admission.inFlight 非空、assignments=[]，因此 A 组整体失败，**B 组未启动**。原错误 `case_admission_or_outbox_retained`、`admission_or_outbox_retained`、`both_cases_not_completed` 全部保留。预留 32 tasks 不回收复用；实际仅发送 16 tasks。没有补 B、重试或修改超时/driver。准备阶段 14 个纯 unit 和 strict noEmit0 是先前证据，本次没有新增工程测试，不计为实际负载通过数。

## 最后 claim 的证据边界

同一 runner child 时钟：最后一次成功观察到的 claim HTTP 200 于 7,948.200708 ms 记录，耗时 9.918667 ms；最后一个 claim 记录是 8,535.383417 ms 的 runner-http-error，耗时 117.283167 ms、aborted=true，无 HTTP 状态或可确认响应。两者之间最后一次正常 completed ACK 在 8,529.018917 ms，runtime active=0 在 8,540.042125 ms。

`childMs - elapsedMs = 8,418.100250 ms` 只近似 fetch wrapper 入口，不是独立采集的网络发送时刻。原记录未采 stop-case 发送/接收或精确 abort 时间；aborted=true 只证明 catch 时 case signal 已中止。HTTP 请求没有 requestId，观察记录没有 journal UUID，不能严格将某个 HTTP call 与 inFlight `e71367ed-18b4-4222-9dd6-6f4811095366` 对号。

源码支持的有限解释：runtime.ts:84 在发送 claim 前持久化意图，:88 等待请求，:91 只有确定响应才 accept；admission-journal.ts:64–69 明确同一持久更新清意图。driver.ts:197–204 等 16 个完成 ACK 后发送 stop-case，child.ts:26 中止 case signal。单路 claim 生命周期与末尾中止后留下意图一致，但不补造缺失的 ACK 或时间记录。精确源码绑定沿用 preparation manifest 的 readonly 与 source 项。

保存的 final SQL 对这 16 个 task JOIN **全部** attempts，恰好 16 行、每 task 一个；当前 attempt 快照及 claim/adapter 观测也没有额外身份。全库其他 task inventory 未归档。不能从无观测到的 extra attempt、空 assignments 或 DB 终态推导最后响应为 assignment:null，不能清除意图或重新领取。未知状态正确保留。

## A 窗口数据库观测

筛选 parent 接收时 phase=`one-by-sixteen:window`、poolRole=`center`。median 为偶数两中项均值，p95 为 nearest-rank ceil(0.95×n)。

| 层级 | n | median ms | p95 ms | max ms |
| --- | ---: | ---: | ---: | ---: |
| pool acquisition | 1162 | 0.055021 | 40.781833 | 159.048500 |
| transaction elapsed | 609 | 34.071959 | 89.356000 | 165.953792 |
| runner-row query elapsed | 534 | 31.811980 | 81.491875 | 156.929375 |

pool waitingCount 最大观察值 14，是排队数而非等待时长。60 个 activity samples 中 31 个有 Lock 或 blocker 正证据，合计 153 条可重复 backend 行；Lock wait_event 有 tuple / transactionid。这个合计不是独立锁事件数，也不能凭没有采到 Lock 判零等待。

acquisition 含建立连接；transaction 与 runner-row query elapsed 含执行、等待和往返，不是纯锁时间。phase 是 parent 收到 IPC 时归属，跨进程边界非精确同步。没有 B 对照，且固定 A→B 顺序、同进程暖机、机器负载和观察开销存在混杂；不能声称锁优化因果、拓扑优劣、provider 容量或任何 SLO。

## 清理及预算

runner PID 39879 与 center PID 39843 均正常 exit 0、forced=false、ipcFailed=false。自有 DB `flow_s01_mixed_39779_f8dba4e33bbd445ebe27114c00627cd6` 确认无连接后 DROP，retained=false；未操作共享 55432 服务。唯一保留资源为 `/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/flow-s01-mixed-FKye9L` 及其未知 admission journal，原样保留且不重启/重放。journal 80 B，SHA256 `f11cf1330d5babb3c91d10f449e9eb1171ffaa39a2d20e0168e752788e395296`，完整相对 identity 在 [journals.json](journals.json)。

18,660,992 B 是自有 HTTP/PG Node stream 双向字节，加保守重复 HTTP/SQL/row payload、IPC、准备及实际证据；非 TCP 重传或网卡总流量。归档后额外逻辑文件以 [archive-budget.json](archive-budget.json) 保守重复计入，仍受 64 MiB 上限。后处理不重计为运行时间，不运行数据库或负载。旧 W1/W2 的 44 tasks / 38 attempts / 20.925025 秒及 78 个冻结文件不变。

本次结果待 architecture_read 固定提交只读复审；结果批准只表示失败证据可信，不能变更 runVerdict=FAIL。正常停止领取并有界排空已发 claim 的后继由 Mika 另派独立 S01P03 scope；本树不实现产品修复，也不消费新窗口。
