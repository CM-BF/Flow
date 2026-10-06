# CHAT05P01 接口对照与交接边界

2026-10-06 22:21:49 UTC，status_read / gpt-6-astra。本次仅记录只读接口对照；开始时本树 `codex/runner-claim-recovery` 的 HEAD 为 `f880d9742e9e8ee076531e9f27c27a7e7d72bf4a`，工作树 clean。

Mika 于 22:18:06 UTC fresh 核实本 claim `9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac` v2 ACTIVE / 18 literal。CHAT05P01 的 assignment_review 在独立 native-activity-body 树持有 `b447f2ce` v1 / 12 scope；该次协调观察未与 runtime、client、contracts exports、server factory 当前范围重叠。本次未更改任何 claim，未完成 writer 移交。

- 最小 publish port 由 runtime 与既有 AttemptControl/EventOutbox 持有，沿用它们的所有权、持久化与取消边界；缺少 port 时保持 legacy 64KiB。
- 新 wire 需要本地显式 opt-in 和中心明确 ACK。能力声明与已协商能力分开；现 `runner-claim.v2` 为严格 schema，不能向旧 decoder 无协商追加 ACK。
- ACK 未知时，已持久化事件 payload 保持不变，不改写后降级重发。
- 后续精确范围移交必须先由原 owner 停写，再以当前 version 原子 amend 移除，接收方成功 take 后才写。本记录不授权提前使用另一 writer 的范围。

固定产品仍为 `83a0799293057f7472f0329c61e566708b2a2381`；PG 准备源码仍为 `ac3b8532fb23a9c8549c0b32e225a31327bc85f9`。`pg-prepared-manifest.json` SHA256 仍为 `db1364e042fee29978785f93d260504ac12e8f1e7477bcbd7e17107a445fc65f`。Mika 20:53:17 UTC 对准备包的 APPROVED 仅覆盖准备；新 8 组 PG 仍 NOT_OPEN / NOT_RUN，原 4 组 capacity PG 独立 NOT_RUN，main 仍 NOT_INTEGRATED。

沿既有本地 find-skills、clean-code、codebase-design 基线，本段只核职责归属、严格接口、未知 ACK 和移交流程的表述一致性。产品、PG 输入、raw 与 manifest 均不改；0 测试、0 PG、0 provider、0 新运行窗口。
