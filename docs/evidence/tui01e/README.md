# TUI01E 队列控制证据

固定实现 `d4478653918144377696ce83ace128fcf4213961`，base `aae1eb1054d75e78273e7c91ed048aeac80195da`。本片复用同一 conversation controller / durable journal，把公开队列轻读、暂停与恢复接入真实 Ink 和 JSONL；中心仍唯一拥有 queue revision / task / promotion。0 provider、没有个人服务操作。独立 review 尚未开始，main 未集成。

## 已验证

- `controller-consumers.txt`：37/37，2.28 s；9 新队列行为 + 原15 controller / 9恢复 / 4终端直接消费者。原三个测试文件逐字未改。
- `journey-final.txt`：4/4，15.68 s，真实生产 factory / 随机 PG / 两公开客户端 / 私有日志重开 / 实际 Node JSONL / owned Python PTY。两轮为 **41 个不同检查**，不是同一次41/41。早期1、5与第一次4为子集/重复，不累加。
- `types-final.txt` 为成功时正常空 stdout；相邻 `types-final-exit.json` 由同一 shell 在进程返回后保存 exitCode 0。工具 exec/session 55779 完成回执也为 exit_code 0。作者没有以空 stdout 本身推断通过。
- 旧版本冲突后：未提交草稿保持、刷新队列、`/recover` 只读观察、不自动改版本重发。随后新的显式操作可使用新观察。
- 原中心暂停已 commit 后代理丢 ACK，磁盘 journal 重开默认0 POST；显式 recover 的两次真实 POST key/body 逐字相等，返回旧 receipt 后读取第二客户端的新 queueRevision，而不是用旧 receipt 覆盖当前状态。
- PTY实际看见 paused → not paused、中文emoji多行草稿、60×20 resize；Ctrl-C exit0/raw mode恢复，草稿没有提交。退出时后台 task queued/running，之后真实中心记录 succeeded，0 cancel调用路径。
- 每次 PG 文件结束均停止自有 runner、关闭自有 HTTP、DROP 随机库、remaining=[]，删除自有临时目录。两次实际数据库不同，详情保留原 stdout。未操作任何既有服务/PID/库。

## 性能与内容边界

`journey-measurements.json` 仅从 final stdout 原 JSON 提取，不是另跑 benchmark。固定合成23项原文总 **110,460 UTF-8 B**。真实子进程 GET 请求4个（conversation、turns、queue第1页、第2页），item正文路径 **0请求**。队列两页20/3项；首个**本地保留投影序列化**15,530 B；整个四行JSONL输出22,483 B。它们不是压缩线速/HTTP头计量，也不是token或吞吐指标。第一次 raw 的originalMaterialBytes=110400只算正文重复部分，final补入实际序号前缀60 B；原raw未改。

队列仅保留20项×512 UTF-8 B preview及固定元字段/版本；可选完整item/context字段不会进入本地投影。沿原 ObservationReads 2实际并发/4等待和 epoch/AbortSignal；仅显式进入queue后刷新对应页。不是持久分页快照，也不是所有HTTP响应、旧turn正文或总snapshot的统一字节上限。

## 失败与修复

1. `controller-red.txt`：首个命令不支持，1 red→`controller-first-green.txt` 1 green。
2. `ack-boundary-red.txt`：2 red/7未选，发现不可能的版本增量和无promotion却换task的回执被错误接受。私有mapper现在严格核请求身份，保留 UNKNOWN + 原意图。最终9新行为含该2项。
3. `types-next.txt`：2条仅新增PG测试的 DTO 默认字段缺失；runtime schema确实补默认但TS输出类型要求显式字段。补同样默认值后最终 types0，不修改生产schema。
4. 首次offline installer成功输出后，shell包装误用zsh只读 `status` 名导致wrapper exit1；原installer stdout、工具错误转录和已up-to-date确认保留。没有新版本/下载/脚本/整store复制。共享磁盘同期有其他队伍，space-before/after不能归因成这次安装的精确回收或分配量。

## 复跑

在本权威 worktree、既有Node24/pnpm9.15.4/Vitest4.0.18依赖下：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run packages/interaction/src/queue-control/controller.test.ts packages/interaction/src/controller.test.ts apps/tui/src/recovery.test.ts apps/tui/src/terminal.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/tui/src/queue-controls/journey.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

PG测试只使用本机55432创建自己随机 `flow_tui01e_*` 库；动态HTTP端口、合成凭据、fixture adapter无SDK/provider。PTY只操纵其自有子进程。初始化/库失败应报告而不是改用共享库。没有浏览器/用户tab操作。

## 限制与后继

真实 TUI→Web→TUI、provider、队列enqueue/edit/cancel、当前任务cancel/decision、附件仍留父 TUI-001；两公开客户端不是浏览器证明。暂停只挡后续promotion，不停止当前执行。恢复可能启动已配置的真实工作。ACK受理不证明停止或完成。普通草稿是内存状态，不被本片承诺跨进程持久化；只有immutable request落盘。OS hardkill/掉电耐久性不在本次重开检查范围。

接口与职责见 [interface.md](interface.md)，实际技能与clean-code见 [quality.md](quality.md)。manifest绑定11源码/直接输入/原始日志，作者未自签独立批准。
