# B01 分层读取与传输有界性

创建 / 最近更新：2026-10-06。状态：in-progress。当前Owner：status_read（mika lead），模型gpt-6-astra；原b01_bounded_reads完成史保留。

目标：在真实 center/PostgreSQL HTTP 上用 1/16/128 个合成任务测量 snapshot、events、workspace feed 的分层与传输上限，提供可重复的低成本基线和有证据的局部修复候选。任务数不是 agent 执行容量；0 模型、0 用户文件、0 新云。

已确认范围：experiments/bounded-reads、docs/evidence/b01、plans/b01-bounded-reads。经2026-10-06T03:38:42.747Z原子amend v2已追加 apps/server/src/m2-workspace.ts 和 apps/server/src/m2-workspace.test.ts 的局部修复范围。只测 API 消费者，未展开详情的 0 请求结论不外推为真实 UI。禁止改 shared index/contracts/client/Web/lock；额外范围先协调并原子 amend。使用本机开发 PG 的唯一临时 DB、动态 HTTP 端口，独占数据生命周期，不操作 4320/49922/55049。

方法：真实公开 HTTP 测读取；大历史由合成 SQL 装载（注明绕过写入口），另用真实 runner HTTP 验证 batch/UTF-8 边界。首次请求与 50 次预热样本分开；不清 OS/PG cache，不将首次请求叫物理冷缓存。记录原始时延、p50/p95/p99（nearest rank）、样本数、响应 UTF-8 JSON 字节、行/页/批次上限、扫描计划。初轮硬上限 120 秒、传输 96 MiB、最大 128 任务和 16384 timeline 行；无 SLA/容量承诺。失败与清理状态保留。

取舍：使用现有 createServer 的公开 Interface 测量，不复制业务实现。数据库 EXPLAIN 只用于定位已观察长历史开销；保持一个小测量入口。性能分位数仅是本机顺序消费的经验样本。

## TODO

- [x] B01-01 可重复短测、分层/UTF-8/批次与分页检查、长历史扫描证据与修复候选。
- [x] B01-04 按实证修复workspace长历史扫描，保留晚提交/201task并追加per-task prefix回归。
- [x] B01-02 独立 review 绑定提交、证据复核和 owner 修复。
- [x] B01-03 由 Execution Lead 接收集成，核实 main 与 dashboard 来源。

完成条件：B01-01 需有原始 JSON、命令退出码、资源清理证明、限制和精确候选；不以生成脚本代替执行。B01-02 需实际独立 review；空模板不算通过。B01-03 分支与 main 分开记录。若发现产品修复可另行批准范围后交付，不偷换本轮测量目标。

风险：顺序调用、短样本和种子数据不能代表真实持续负载；共享本机 PG 的背景负载可能干扰耗时；LIMIT 行数不等于 SQL 扫描有界。全局 plans 索引由 Execution Lead 登记。

## B01 轻读投影后继（2026-10-06）

所属大task [FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)，co-lead mika。唯一权威WT变更为task-read-projections，branch codex/task-read-projections，base fd1322f9c0c1d085d5e343e39f6216b20d26c264；旧owner已停写且claim已released。旧B01-01/02/03/04与raw保持历史完成，不代表本片已批准。遵循[根Module规则](../../AGENTS.md#modular-design)，精确[Interface与有界验证](../../docs/evidence/b01/task-projections/interface.md)。

- [x] **B01-05** 核旧owner停止/原子领取、权威迁移请求、小Interface和直接消费者影响。
- [x] **B01-06** eventPage与list共享轻投影，保留snapshot/写锁/auth/cursor；真实专库等价、解码字节/查询数与局部strict取证。
- [ ] **B01-07** 固定target/source/raw独立review、修复复审和Lead受控main接收；第三reader仅证据后决策，不默认领取。
