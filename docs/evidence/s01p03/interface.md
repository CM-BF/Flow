# S01P03 正常停止 claim 排空：已审定接口

这是已有 runner 生命周期上的有界修改，父大 task 为 FLOW-001；S01 的一次 FAIL 是输入证据，不新增第三层任务。候选只改变已发 claim 的取消来源，不增加公共参数、重试、恢复协议或第二调度器。

| Module / Interface | 状态所有者与职责 | 本片改动 |
| --- | --- | --- |
| `runRunner(RunnerOptions)` | runtime 拥有 admission loop、active map、内部 fatal shutdown 与 pending requests | `input.signal` 仍立即停止新领取、唤醒等待并中断已有 attempt；已发 claim 单独排空至原 request deadline 或内部 fatal |
| `AdmissionJournal.begin/accept/complete` | 唯一持久 admission 权威；发送前写意图，确定响应才替换，完成 ACK 才清 assignment | 复用现实现，不改文件/格式，不直接写或删除 journal |
| `FlowClient.claim(signal)` | 一个实际 HTTP request，普通 timeout/断线响应由调用者辨别 | 不改 client；只在 runtime 传入原发送时 timeout 与内部 fatal signal 的组合 |
| `AttemptControl` / outbox / native settlement | 保持已有 attempt 取消、租期、事件持久及 native unknown 规则 | 不改变 signal 行为、不伪造 cancelled/completed，不改文件 |

生命周期：发送前若 normal stop 或 recovery 已发生，只能清除该次尚未发送的意图，0 HTTP request。已经发送时，normal stop 不 abort claim、不重置 timeout、不发下一 claim；原 deadline 内得到明确 `assignment:null`，先持久 `accept(null)` 再返回。得到 non-null assignment 时，先持久 exact task/attempt/runner/version，normal stop 后不 start adapter、不发 heartbeat或completed；留下 assignment 使同目录重启仍 blocked。它是明确已受理的保留 assignment，不能当未知空响应或自动续跑。

timeout、连接中断、丢 ACK、非法响应保持同一 inFlight UUID；不从空 assignments 或 DB 摘要补成 null，不重试。内部 host fatal（401、403 wrong_role、storage）抢占 claim 排空并保持原错误传播；普通 goal/attempt 403 仍局部处理。进程被强制终止不能合作排空，已持久 intent 跨重启保守阻止领取。此片不承诺活动 adapter 在 normal stop 时完成，也不承诺无限阻塞 adapter 的全进程硬截止；原行为是中断并等待本地清理，不能把它改成用户取消或原生已停止。

取舍：新增 `stopSignal`/`forceSignal` 或返回 handle 会扩大调用者接口，当前 main 无接线授权；复用现输入正常 stop 与内部 fatal 取消来源，能修复 S01 已完成全部 attempt 后仍因空轮询中止而锁死的问题。完整未知 claim 的中心 requestId/回执恢复是后续问题，本片不解决。

验收 seam 是公开 `runRunner` + 实际动态 loopback HTTP + fake adapter + 私有目录。用 deferred 明确控制“服务端收到 claim→normal stop→响应”顺序，检查同目录重启行为与实际持久 identity；不模拟内部 AdmissionJournal。首个 red 用例是延迟明确 null 响应跨正常停止、停止后同目录可再次领取。随后分别覆盖 late non-null、原 deadline 不重置、timeout/丢 ACK/非法响应不重试、内部 fatal 抢占、原活动 attempt 清理。停止前未发用 pre-aborted 输入验证 0 claim；若需精确持久化期间的停止门禁，仅在测试的文件系统边界延迟真实 rename 的返回，保留真实磁盘结果，不加产品 test hook。

强停候选验收为一个自有 Node child：服务端已收到 claim 后 SIGKILL，确认 child close，检查原意图后同目录重启拒绝第二 claim；只杀自有 PID，清理所有 socket/child/temp。此测试仍是 loopback，不启动真实 center、PG、provider 或原 mixed driver。Mika已批准这两项，最终10项新回归均通过；证据和局限见checks.json/resource-check.json。

直接消费者：`runner.test.ts` 全量；`runtime-capacity.test.ts` 精确选择非 `real PG/HTTP` 标题用例，四个真实 PG 参数实例明确未运行；strict noEmit。保留原取消、lease loss、native unknown、auth fatal及局部403断言，不删断言或编辑消费者测试。Node24 / pnpm9.15.4 / Vitest4.0.18；不安装或改变依赖版本。新worktree按许可用真实忽略目录内的symlink复用既有依赖，未安装。根级类型检查失败与局部严格通过分别保留，不把后者写成根通过。

实现 scope 仅 runtime.ts、新 runtime-shutdown.test.ts、此证据目录和 plans/s01-graceful-stop。共享 main/server/client/contracts 不改。准备方案通过后才开始逐个 red→green；固定 target 独审后交 Lead 集成，不补原 B 窗口、不启动新容量负载。
