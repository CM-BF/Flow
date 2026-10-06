# C02 证据与质量记录

2026-10-06 01:58 UTC 开始；基线 e845eb069c594989117fadf380335650efef27a2，gpt-6-astra，独立 m2-reconciliation worktree。0 模型调用；本分支实现已检查，独立 review 尚未开始。

技能发现：按本地 find-skills，复用实际读取的 `/Users/citrine/.agents/skills/{brainstorming,codebase-design,tdd,clean-code}/SKILL.md`，并读 tdd 的 tests.md / mocking.md。现有本地技能覆盖本次架构/TDD/质量工作，无需安装。brainstorming 用于明确候选恢复语义和已授权设计，codebase-design 用于单一恢复 service，TDD 通过已授权 HTTP seam 逐条测试，clean-code 检查锁顺序、事务职责、命名、错误和资源清理。clean-code 固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，未重装。

数据库技术核对实际 PostgreSQL 16 官方 [trigger](https://www.postgresql.org/docs/16/sql-createtrigger.html) / [locking](https://www.postgresql.org/docs/16/explicit-locking.html) 文档。迁移添加未知为 null 的接收时间；不以 lease 推断历史 heartbeat。

质量停点 01:58 UTC：设计 self-review 已核对无自动重派、无成功伪造、所有权 fence、immutable audit 和新任务 provenance；共享 schema 由 Lead 单一维护，不创建第二套。

## TDD 工作段

- 02:00 UTC：查询首测先收到 404（red），实现 query + migration + accepted clocks 后 green；auth 与模拟 v1 schema 缺少 v2 新增项的保数据升级/重启检查通过。
- 02:03 UTC：观察首测 404 red→green；两个同 key 并发提交只产生一个 audit，同 key 异输入拒绝，uncertain 占用不释放。
- 02:04 UTC：resolve 404 red→green；释放 runner/session、ownerVersion fence、原事件重报和新迟到事件拒绝、原历史保留。
- 02:06 UTC：显式 retry 404 red→green，但 Goal Owner 方法审查识别 reviewed 副作用不能原样重做；此前宽松 retry 尚未提交。新增“外部写已成功而完成 ACK 缺失”用例确实收到 200 而预期 400（red），同步公共 safety contract 后收紧。该测试使用本地临时 ledger 文件，不调用真实模型或外部服务。
- 02:10 UTC：clean-code 工作段复核锁顺序、fence 与副作用语义，新增 recoverySubmission 将明确剩余工作和完整 owner assertion 上下文交给新 attempt，超长拒绝、无自动 native resume、同 resolution 最多一 successor。原样重复仅限明确 none-confirmed + safety evidence。正在补充完整边界验证。

## 最终检查

实现 target `97ab1e5bd169cda7ed7bf0bbdeddcda1414833f8`，公共契约由 Lead 提交 0046db3 / 0b76639（本分支等价 cherry-pick a5e312c / d74c4be）。[检查摘要](checks.json) 绑定实际被测源码；检查后源码未改变。

2026-10-06 02:11 UTC：`pnpm exec vitest run apps/server/src/reconciliation.test.ts` **12/12**，实际测试 24.834s、总计 25.10s；`pnpm typecheck`、`git diff --check` 通过。Node 24.20.0 / pnpm 9.15.4 / PostgreSQL 16.13；专属 flow_c02 + 动态 loopback HTTP。测试持有专属 advisory lock，按用例清理自身 schema，关闭服务器后删除本次创建的数据库；02:11:56 UTC 独立只读核对 flow_c02 不存在。未触碰 flow_i01、flow_c01 或 4320 服务。

| 行为 | 实际证据 |
| --- | --- |
| 核对视图 / 时钟 | 原 attempt/版本/租约/sequence、artifact reference；没有 accepted heartbeat/event 时为 null；模拟 v1 缺少新增字段升级与二次重启仍保留原 evidence |
| 身份 / 安全拒绝 | 无 token 401、runner 403；未知 effects、未停止、空 evidence、冒充 actor、成功终态输入 400；running、原 attempt/version 不符 409 |
| 观察 / 幂等 | 同 key 并发只产生一个 audit；异输入拒绝；uncertain 容量和 session 不释放；审计跨中心重启保存 |
| 安全终止 | failed/cancelled 处置与 audit、owner fence、attempt 完成、session 释放同事务；旧 owner 新事件和原事件重报均拒绝；历史 artifact/timeline 保留 |
| 显式恢复 | 不创建自动 retry；同 key 并发只建一个新 task，原 task/attempt/audit provenance；原 native session 不隐式继承；同 resolution 的新 key 拒绝扇出 |
| 已知副作用 | 本地临时 ledger 成功写入但中心没有完成记录；reviewed + 裸 retry、no-side-effects、原指令均拒绝；明确剩余验证工作才接受，新 HTTP claim 收到已知 effects / safety / 四类来源 IDs，ledger 未追加 |
| 原指令策略 / 长上下文 | none-confirmed + no-side-effects 的显式证据才允许原指令；组合上下文超 16K 拒绝，无新 task/audit 半成品，不截取关键事实 |
| 审计边界 | 101 条观察用 100+1 分页完整读取；DB UPDATE/DELETE/TRUNCATE audit 均 55000，provenance UPDATE/DELETE 也拒绝；冲突 resolution 并发只有一个成功 |
| 撤销 runner | 被撤销凭据不能报告；owner 仍可受审计处置并释放原 reservation |

最终 clean-code：02:11 UTC 核对 service Interface、SQL 锁顺序、transaction 边界、idempotency、命名、nullable clocks、error paths、资源生命周期和 public HTTP 行为。query/command 在同一恢复模块，HTTP 层只解析唯一共享 schema；没有新增依赖或并行共享 schema。修复 retry 副作用语义后实际重跑 12 条测试与类型检查，未保留宽松实现。

## 限制

- 停止/副作用/剩余工作安全性是 **owner assertion**。中心不登录宿主机、不停止进程、不验证外部证据 URL，也不能证明 revised prompt 语义安全或自动补偿。trim 相同指令拒绝只是明确的机械限制。
- 已知副作用场景是本地 fixture 文件与真实 center/PG/HTTP，未启动真实 harness/model，不能把它写成模型执行安全性证明。新 attempt 的 prompt 上下文可见性已实际验证。
- Retry 创建 fresh task，不恢复旧 attempt/native session，不自动重派。原本显式提交的 session task 仅在预约释放后恢复领取能力；无跨机承诺。
- Accepted clocks 只表示新事件落盘或成功续租；拒绝/stop/重报不伪造进展，旧历史未知仍 null。审计每页最多 100，引用最多最近 100，更多内容通过既有 events/detail 阅读。
- Trigger 保证正常数据库 DML 的 append-only；数据库管理者可修改 schema，不能声称防 DB 管理员篡改。
- 未执行全库 PG 集成，以免清理其他任务数据库；本 scope 的 12 条真实 HTTP/PG 和全库类型检查已完成。M02/P01 的整体集成与独立 review 由 Lead 负责。
