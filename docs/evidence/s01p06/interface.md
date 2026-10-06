# S01P06 有界等待 Interface

Owner status_read / gpt-6-astra；co-lead mika。WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-wait-bounds` / `codex/runner-wait-bounds`。Base `cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd`；claim见 [receipt](claim-receipt.json)。Mika已授权本设计实施。状态权威 [status](../../../plans/s01p06-runner-wait/status.md)，待Lead登记。

`AttemptWakeup(signal, pollIntervalMs)`：`track(completion)` 每个attempt仅调用一次；`wait()` 只供现单admission loop串行调用；`close()` 幂等清理。完成的fulfilled/rejected仅发送唤醒，不改变原错误处理。内部最多一个待消费通知、一个waiter、一个timer和一个abort listener；每个completion只有一个完成订阅。close后通知无效。

runtime仍拥有active Map。start在set后track已包含journal/fatal及delete的completion；所有原wait点改调用Module；finally close后保留shutdown与allSettled。无新scheduler、队列或active状态副本。

验证：2个pending Promise×32虚拟ticks，用各promise自身then计数的原race等价复现展示增长；这不是旧整runtime负载。新真实Module检查同样输入的常量订阅、timer/listener上界、完成/拒绝/合并/abort/close。真实runRunner私有HTTP+3fixture attempt确认槽位完成时立即补槽，不等长poll；这是旧行为兼容检查，不虚称旧race补槽失败。另按最小接线TDD记录任何真实红结果。

直接消费者：runner.test、runtime-shutdown.test、runtime-capacity.test（排除4项 real PG/HTTP）。readonly不删断言。没有PG、SDK/provider、真实容量或RSS实验。

职责/架构影响：仅runner进程内wait Module；无公共合同、中心DB、adapter或调度策略变化。待Lead在main接收时更新固定架构基线（如其图含内部wait）；不改共享registry。
