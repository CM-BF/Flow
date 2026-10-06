# CHAT05P01 接口对照与交接边界

2026-10-06 22:21:49 UTC，status_read / gpt-6-astra。本次仅记录只读接口对照；开始时本树 `codex/runner-claim-recovery` 的 HEAD 为 `f880d9742e9e8ee076531e9f27c27a7e7d72bf4a`，工作树 clean。

Mika 于 22:18:06 UTC fresh 核实本 claim `9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac` v2 ACTIVE / 18 literal。CHAT05P01 的 assignment_review 在独立 native-activity-body 树持有 `b447f2ce` v1 / 12 scope；该次协调观察未与 runtime、client、contracts exports、server factory 当前范围重叠。本次未更改任何 claim，未完成 writer 移交。

- 最小 publish port 由 runtime 与既有 AttemptControl/EventOutbox 持有，沿用它们的所有权、持久化与取消边界；缺少 port 时保持 legacy 64KiB。
- 新 wire 需要本地显式 opt-in 和中心明确 ACK。能力声明与已协商能力分开；现 `runner-claim.v2` 为严格 schema，不能向旧 decoder 无协商追加 ACK。
- ACK 未知时，已持久化事件 payload 保持不变，不改写后降级重发。
- 后续精确范围移交必须先由原 owner 停写，再以当前 version 原子 amend 移除，接收方成功 take 后才写。本记录不授权提前使用另一 writer 的范围。

固定产品仍为 `83a0799293057f7472f0329c61e566708b2a2381`；PG 准备源码仍为 `ac3b8532fb23a9c8549c0b32e225a31327bc85f9`。`pg-prepared-manifest.json` SHA256 仍为 `db1364e042fee29978785f93d260504ac12e8f1e7477bcbd7e17107a445fc65f`。Mika 20:53:17 UTC 对准备包的 APPROVED 仅覆盖准备；新 8 组 PG 仍 NOT_OPEN / NOT_RUN，原 4 组 capacity PG 独立 NOT_RUN，main 仍 NOT_INTEGRATED。

沿既有本地 find-skills、clean-code、codebase-design 基线，本段只核职责归属、严格接口、未知 ACK 和移交流程的表述一致性。产品、PG 输入、raw 与 manifest 均不改；0 测试、0 PG、0 provider、0 新运行窗口。

## 后继聚合资源验收 / 未实现未测

2026-10-06 22:33:32 UTC，依据 Lead 22:31 的后继验收输入登记，未扩大 S01P07 本片实现范围或原计划验收。CHAT05P01 仅引用固定 source `bbd6df6e0b60ca7276c1938060848a0b97eb2bfc`；据 Mika 对该固定源的只读核对，port 为 `HarnessContext.activityBodies`，输入 `{activity, content}`，单 body 8MiB、单 attempt 累计16MiB / 256材料，chunk 64KiB、batchChunks 8 / page 4，缺 host port 保持 legacy。其 WT 未提交内容不作为本记录的结论输入。Mika 22:33:01 UTC 核实本 claim v2/18 与 CHAT claim v1/12 均 active、不重叠；本轮未移交或更改领取。

- runner 聚合账须分别呈现在途、已预留、未 ACK / 历史保留 bytes，以及恢复扫描的工作与资源界限，并明确各集合关系避免双计。`capacity 16 × attempt 16MiB = 256MiB` 不是 runner 内存或磁盘峰值；stage 与 planBody 的 `Buffer.from`、分块 base64、eventBatchSchema / JSON 临时副本、manifest、outbox、staging/tmp 和旧 attempt 目录均是待测组成，不能由此推算精确 RSS 峰值。
- 确认后 acknowledge 先写 ack / fsync，再 unlink content.bin，manifest / ack 仍作为 quota 与幂等证据保留。因此累计 `job.bytes` 不等于实际留存 content bytes，不能与活动字节重复相加。现 `jobs()` 仅按单 attempt 读 manifest，不代表已实现 runner 全历史扫描。
- 空间不足或计量 unknown 时停止新 admission，同时保留已有恢复、重报、心跳和取消所需预算。历史扫描必须有界；缺失、未扫完或读取失败标记 unknown，不按 0 处理。
- 清理必须同时核精确 owner 身份、中心确认语义、明确保留策略及无在用 reader。unknown 不能仅因 timeout 丢弃，也不能篡改 durable payload 以求确认或释放空间。
- 后继验收才覆盖跨并发、历史重启、ACK 丢失、低空间下仍可心跳与恢复，以及清理门禁；本轮未实现、未测试这些能力，未新增负载。现有新 8 组 PG NOT_OPEN / NOT_RUN 与原 4 组 capacity PG NOT_RUN 仍分开保留。

资源历史来源：Lead 报告 2026-10-06 22:31:37 UTC free 为 1,011,576,832B，因而类型检查 NOT_RUN、NO_HOLDER。这是该时点的来源事实，本轮没有自行采样，也不复用它作为未来准入值。沿既有 find-skills / clean-code / codebase-design 基线，仅核职责、计量边界、未知语义和后继范围，0 工程检查、0 运行。
