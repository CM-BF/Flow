# CHAT08 原生执行中修改指令

状态：in-progress。Owner runner_owner / gpt-6-astra。2026-10-06 07:21:16 UTC。基线42c1cc85cfbf9fa3ca3fdcbee57dc02394bff6d7；claim见status。GO已批准本有界纵向设计，不重复普通设计审批。

复用CHAT07领域、现SDK/query、runtime心跳和outbox；同一query/session/task/attempt允许有界多成功SDK result，中间结果不发布artifact/final/completed。新命令先durable received再yield原生UUID；首帧消费与success result覆盖分离。最终候选覆盖当前控制revision，无未决命令、输入buffer或已知SDK pending，再同TX seal/本地verifier事件/最终正文。proposal普通竞争可明确拒绝并继续当前query，传输未知冻结原bytes，不能重投native指令。

先flush普通outbox并冻结序号，再持久有proposalId的条件final batch。committed推进本地seq并关闭输入；not-committed不消费seq且允许处理赢下的command；unknown只能确认原proposal。取消/失联/timeout唤醒输入等待，未知不自动重试。一个query级deadline/budget，modelUsage按累计流去重，不逐result求和。maxTurns沿固定SDK参数，host result计数独立披露。

公共cap仍false，生产main不启用。0provider真实PG/HTTP/注入SDK验证，不动个人服务或凭据；实际provider/原生流/U11 UI另验。

| TODO ID | 交付与验收 | Owner | 依赖 |
| --- | --- | --- | --- |
| CHAT08-01 | 合法scope、三件套、条件final/runner mailbox DTO与ports | runner_owner | CHAT07已审latent main |
| CHAT08-02 | 消费/结果覆盖状态机与有界多result输入关闭 | runner_owner | 01 |
| CHAT08-03 | durable条件proposal、center同TX seal/final及竞争/unknown | runner_owner | 01 |
| CHAT08-04 | 实际runtime→注入SDK→PG纵向2/3result、ACK/取消/恢复/用量 | runner_owner | 02/03 |
| CHAT08-05 | 固定target/证据/独立review与shared接线 | runner_owner / Lead | 04 |
| CHAT08-06 | 实际provider/原生UI验收后才启用cap | 后继owner待派 | 已审纵向和独立预算 |

精确scope以claim13literal为准；025仅预留，若确需新增表先amend后写。shared client/export/mount/lock归Lead，不越界；不大拆runtime或重写agent loop。find-skills本地优先codebase-design/clean-code/tdd/brainstorming已读，本次Interface/HTTP/SDK注入seam已获GO批准。
