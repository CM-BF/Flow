# C02：uncertain 核对和安全恢复

本设计属于恢复子系统接口变更，用户已经授权方向与实现。按 brainstorming 的架构路径分析取舍，设计写在本任务指定位置；已有授权覆盖普通实现和真实 PG/HTTP 验证，不重复请求设计批准。

## 选择与边界

选择：独立恢复 service 管理只读核对、观察、终止和显式 retry；通过 owner HTTP 鉴权调用，复用现有命令幂等事务和任务生命周期。

不选择复活旧 attempt：旧 owner 的外部动作无法撤回，复活会让迟到报告混入新结果。也不选择“到期即自动重试”：lease 只表达中心不再信任 ownership，不证明工具停止或没有副作用。恢复必须建立新 task/attempt，并保留原始任务、事件、产物与 provenance。

核对视图返回当前 task/attempt/runner/版本、lease、最后 durable event sequence、真实最后 accepted heartbeat/event 接收时间、折叠 evidence references 和 append-only 审计。旧数据未记录时间时返回 null，不从 lease 反算；stop/rejected heartbeat 与重复 event 不更新 accepted 时间。不会远程运行命令或自动访问操作者给出的外部证据链接。

观察 action 记录解释和证据，仅当任务仍 uncertain 且 expected attempt/version 相同；不完成 attempt、不释放 runner/session。终止 action 必须明确确认停止，并给出停止证明、已核对副作用的结论和证据；未知副作用不能解除。终态限 failed/cancelled，不能制造 succeeded 或 verification passed。中心只能审计操作者的确认，不能证明外部宿主机已经停止。

显式 retry 仅基于已完成的 reconciliation resolution，创建新 task 并持久保存 source task/attempt/audit；绝不继承 native session。同一 resolution 最多一个 successor，同 key 重报幂等，新 key 不能意外扇出。原本显式排队的 session 工作在安全释放后可按原 routing 领取；C02 不增加 native 自动恢复或跨机恢复承诺。

副作用 reviewed 不等于可原样重做：retry 必须携带 safety。只有 resolution 为 none-confirmed 时才允许 no-side-effects + 操作者证据沿用原指令；有已知副作用必须 revised-work + 明确剩余工作 + 证据，拒绝 trim 后相同原指令。server 将剩余工作与 source task/attempt/resolution/retry audit IDs、effectsEvidence 和 safetyEvidence 组合进实际新 task.prompt，注明 owner assertion；完整校验 16K 上限，超长拒绝，不截掉关键证据。中心不能语义证明新指令不会重复副作用，也不自动补偿，安全结论仍由操作者负责。

## 事务与审计

所有命令绑定原 attemptId/ownerVersion，并使用现有 idempotency key 与 canonical digest；同 key 同输入返回原结果，异输入 409。锁顺序与现有 runner report/claim 一致：runner → task → attempt → session，避免与撤销/报告交错发生 deadlock。只读查询使用 repeatable-read 事务保证同一视图。

独立 reconciliation audit 表记录 actor=已鉴权 owner、时间、请求、before/after、处置及 retry provenance。API 不提供修改/删除；数据库 trigger 拒绝 UPDATE/DELETE/TRUNCATE。该不可变性针对正常应用操作，不假定数据库超级用户无法修改 schema。002 migration 由原 migrate runner 调用，保留 v1 数据，新增时间戳不伪造历史。

终止在同一事务完成 audit、attempt 完成标记、task terminal/ownership fence 和 session 释放。旧原版本后续报告拒绝，包括原事件重报；历史内容仍可读。新任务创建/唤醒/provenance/audit 也必须原子提交。

## 验证

授权 seam 为真实 HTTP + 独立 PostgreSQL flow_c02。逐条 red→green：查询/身份拒绝；观察幂等与不释放；resolve 的状态/原版本/停止与副作用约束；释放容量/session、迟到事件拒绝；中心重启后审计/历史仍在；显式 retry 与新 attempt，副作用已发生但完成 ACK 丢失时拒绝裸重试/原指令并传递剩余工作上下文。安全事实分开断言，不把 cancel requested 当 stopped。公共字段以 Execution Lead 提供的 contracts 为唯一来源。

参考：[PostgreSQL 16 row locks](https://www.postgresql.org/docs/16/explicit-locking.html)、[trigger events](https://www.postgresql.org/docs/16/sql-createtrigger.html)。
