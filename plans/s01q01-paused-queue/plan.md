# S01Q01 暂停队列扫描

所属大task：[FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)；co-lead：mika。来源：[S01 后继](../s01-runner-capacity/plan.md)。

## 用户结果与边界

暂停的聊天队列不占自动扫描批次，让可运行会话及时进入既有受理检查。当前扫描只筛 waiting，先推进公平扫描时间，再在第二事务发现 paused；暂停会话超过默认 20 名额时会挤占本轮。最小修改是在 candidate SQL 加 `NOT c.queue_paused`。生产调用仍顺序进行；本片不承诺吞吐/时延或 goal 扫描整体提速。

仍由 conversation 行锁下的 promoteReady 复核 pause，保留暂停与提升竞争、显式 resume、失败/unknown 冻结、幂等/CAS、FIFO、公平轮转、每会话错误隔离和 limit 1..100。无新增 Interface、migration、scheduler、索引、UI 或状态权威。源变更只两叶；测试通过公开 HTTP 与真实 PG 状态，不用 SQL 字符串 mock 作行为证据。

## 稳定 TODO

- [x] S01Q01-01 固定合法隔离工作树、源输入和最小设计。
- [x] S01Q01-02 完成单 predicate 与真实行为测试源码，固定源片。
- [x] S01Q01-03 在后继明确窗口运行隔离 PG 定向用例及必要直接消费者/类型检查；记录实际结果和资源归还。
- [x] S01Q01-04 独立审查、修复、受控主线接收；源码准备不代表产品交付。

## 验收与后继入口

新增场景为 21 个 paused waiting 会话 + 1 个 ready：默认首 scan 只 inspected/promoted ready，paused 时间和 revision 不变、无 turn/task；取消某暂停项、显式空 resume 后再 enqueue，该会话重新被 scan 发现。另有真实并发 pause 与 scan 的 CAS/任务数量断言。原错误回滚/fair rotation、pause/completion/promote、resume/ACK、limit 用例全部保留。

本段 2026-10-07 16:23:07 UTC 至 16:38:07 UTC，只源码；工程/PG/HTTP/浏览器/模型均 NOT_RUN。未来最小专库方案和继承 fixture 缺口见[证据入口](../../docs/evidence/s01q01-paused-queue/README.md)。没有未运行的 red/green 证据。

2026-10-07后继fixture准备段17:13:13–17:28:13，资源要求17:17:38停新launch，实际0工程child。业务源predicate不变；marked专库夹具、单一证据路径和focused ES2023配置已准备，源供给/字节/未运行事实见fixture-preparation.json。S01Q01-03/04仍开放，不将本段准备当PG验收。

2026-10-07后继实际验证：执行46912的两个新增真实PG用例passed，32历史用例未选；caller报告选择器误计skipped导致原FAIL，修复d78ffd7的19pure及独审通过，原FAIL不改不重跑PG。03最小定向验证已完成，04仍待主线接收；历史源码阶段NOT_RUN仅保留当时事实。

2026-10-07T21:55:40.275Z owner核验：中央21:47:25.413Z受控接收至main `62b76a0ef87faf7f74781f7f95a8d4870b52960d`，04完成；上述各NOT_RUN/待接收为当时历史记录。当前本片全部验收已完成；无新测试、无个人部署承诺，原结果边界不变。
