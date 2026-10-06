# R03 租期可靠性片段

固定实现 `9c59740fd45575c7ca5cccbdfdbd5772e5cf1d2a`；基线 `3773db5d014a6d38d09553acd0a5fe8df900b7c4`。2026-10-06 03:32 UTC，作者局部检查通过，独立review进行中，尚未集成main。

ClaimResponse新增顶层remainingLeaseMs（无任务=0），中心在授予租期时固定时长。generic runner用请求发送前的单调时钟起点加授予时长，扣除往返、解析与本地准备；不使用中心时间戳减本机墙钟。heartbeat同样计时，并先核对旧租期仍有效。同步deadline gate保证event loop延迟timer时也不续活；过期或关闭的控制器不接受晚回包。目录无法准备明确停止，事件落盘失败清理心跳。

合同、兼容与保守性说明见 [设计](../../architecture/r03-runtime.md)。新runner对缺失/非法时长fail-closed，升级需先中心后runner；ClaimedTask与P02恢复合同不变，中心ownership fence仍是写入权威。

## 实际检查

- 先红：旧实现4项中3失败，复现慢5分钟误停、延迟claim仍启动、快5分钟挂心跳不按实际授予停止；[原始stdout](lease-red.txt)。目录失败会误归网络重试，单条回归先红；[原始stdout](storage-red.txt)。
- 修复后：lease23 + 原runner25 + client4 + contracts2 = **54/54**，4.36s；[原始stdout](checks.txt)。[typecheck](typecheck.txt)通过。frozen安装通过，未修改根锁或新增依赖。
- 23项包含±5分钟、延迟claim/heartbeat、主动忽略AbortSignal后的过期/关闭晚回包、一次100ms event loop阻塞、12个缺失/非法时长、目录/事件存储故障，以及真实createServer与专库flow_r03。
- 真实中心验证空claim=0、grant=120ms、heartbeat=120ms；到期后stop=0、任务uncertain且不重派。已有runner测试保留实际main SIGTERM退出与注入adapter行为，不调用真实模型。
- flow_r03由用例独占创建并删除，既有同名库会拒绝覆盖；原生PG advisory lock防止本用例重入。已核验库删除、本人runner进程为0；本地HTTP用动态端口，不停止4320或其他服务。

[manifest](manifest.json)固定6个源码和4份stdout的SHA256，以及Node24.20.0、Apple M3 Max、PostgreSQL16.13环境。clean-code与技能实际应用见 [quality](quality.md)。

## 复跑

在此worktree使用已有Node24、pnpm9.15.4和Vitest4.0.18。测试需本机55432开发PostgreSQL可用，且不存在flow_r03；测试自行创建/删除该专库。不要在他人使用同名库时运行。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/runner/src/lease.test.ts apps/runner/src/runner.test.ts packages/contracts/src/contracts.test.ts packages/client/src/client.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

时序测试用loopback与宽容窗口检验停机行为，不是延迟性能benchmark。目标机器繁忙时可能暴露时序抖动，应保留失败证据后排查，不能跳过断言。

## 结论边界

0模型/0云；未验证跨机器部署或真实模型行为。没有更改并发、outbox索引、FS/process/PTY或answer轮询，没有宣称可强杀无视abort的adapter。P02运行时suite固定使用另一独占数据库，本次未重跑；其ClaimedTask未变，公共类型和generic直接消费者已核验。完整R03的BR-01/S01后继保持open，当前独立审查与main接收分开记录。
