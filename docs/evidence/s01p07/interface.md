# S01P07 最小接口与验证范围

设计输入：固定 main `22a0806bc2465e11096949618113833f31766b19`，Mika 已选 v2 领取机会方案。当前源码准备，0 checks / PG / provider；局部 non-PG 检查已授权，真实 PG 仍待独立窗口。

## 职责

| Module | 单一职责与接缝 |
| --- | --- |
| contracts/runner-claim | 有限严格 v2 请求、自身份和响应身份；区分 empty、missing、assigned、unavailable，拒绝错 key/runner |
| server/runners | 既有强 runner 锁和 transaction；v1/v2 复用文件内分配内核，保留 SQL、profile、goal、resume session 过滤 |
| server/runner-claim-receipts | 在调用者已持 runner 强锁/事务内读写 compact nonnull receipt；不缓存 null，不存 prompt/旧 lease |
| client + server/index | 原 bearer 认证和 transport；薄 identity/claim/status 接口，无隐式 retry |
| runner/admission-journal | 持久 runnerId + opportunity UUID；accept(expectedKey) 原子记 assignment 和下一 key；沿原 sync/rename/dirsync |
| runner/runtime | 默认新协议；一次 admission 请求、同 key 查询/重发；所有新方法进入 authenticatedClient/pending drain；不替 adapter 决定副作用是否可重跑 |

## Wire 与错误语义

建议精确 protocol `flow.runner-claim.v2`。`GET /api/runner/identity` 返回 `{protocol, runnerId}`，由现 runner bearer guard 验证并在事务内复核未 revoked。`POST /api/runner/claim-opportunity` 及 `POST /api/runner/claim-opportunity/status` 接同一严格 `{protocol, runnerId, requestId: UUID}`；后者只读当前回执，不分配、不续租。旧 `/api/runner/claim` 空 body 与返回值保持。

所有响应回显 protocol/runnerId/requestId。claim 的 `empty` 只是该事务当前未分配，key 不关闭；status 的 `missing` 只是未见已提交 receipt，不能清 key。`assigned` 包含 exact `{taskId,attemptId,runnerId,ownerVersion}`、当前 assignment 与正 remainingLeaseMs；历史 receipt 不保存 assignment 正文或租约。`unavailable` 只返回同一 compact 身份与有限不可执行原因，不含可启动 assignment，也不换 key。

新 methods 不做网络 retry。runtime 下一次循环按持久同 key 恢复；所有 response codec/identity 错误当 unknown，保留机会。换 bearer 返回另一 runnerId 时拒绝本地日志绑定，不能仅凭 URL 或新凭据清旧 key。

## 事务与恢复不变量

1. runner 强锁后先查 receipt，再进入 capacity/draining 新分配门禁。同 runner/key 线性化；同事务创建 attempt、占 session、写 compact receipt。空回应不新增 commands 行。
2. 回读按 runner→task→attempt 锁序核 current attempt/version/status/completed/lease；剩余 lease 在本次 transaction 当前时间计算，查询不续租。仍需 execute 原首次 heartbeat/assertOwnership；不能用旧 lease 或 0 占位启动。
3. 新 journal v2 持久 runnerId/opportunityId/assignments。每次空轮只读取已持久 key，0 durable change。nonnull accept 先核 expected key，再同一次 durable change 保存 assignment+下一 key；完成只由有效 completed ACK 清对应 assignment。
4. v1 `inFlight` 或 assignment 非空仍 blocked，绝不升级解释；仅完全空的 v1 可绑定 runner 初始化 v2。v2 已持久 assignment 重启仍保守 blocked、不自动重跑 adapter。未知 key 可查询或安全同 key 重发；查到过期/终态/uncertain/stale receipt 保留原 key，不能静默换 key。
5. 正常 stop 停新请求与现 active；已发 claim 沿原发送时 timeout 排空，late assigned 只持久不执行。fatal auth/storage 抢占且传播原错误。维护仅禁止新分配；已受理回执和 heartbeat 可排空，revoke 拒所有 runner 接口。

## 必要行为检查（当前全部 NOT_RUN）

- contract/client：strict version/key/runner/state、错绑定拒绝、auth/JSON/signal/no retry；原 bearer credentials omit 不变。
- journal：12 次 empty 调用不额外 rename/sync；一次初始化与非空 handoff 原 durable 序列；错 key/runner、v1 unknown、重启 assignments 阻塞、存储错误原样。
- public runRunner + 私有 loopback：500ms 等待/及时补槽；COMMIT 丢 ACK 同 key 查询回原 attempt；stop late null/late assignment、超时/malformed、wrong_role/401 fatal、未知 native/outbox 不改。
- 独占 PG：同 key 并发至多一 attempt/session；rollback 无孤儿 receipt；empty 0 commands；历史 receipt 在 capacity/drain 前读、过期不续租/revoke 拒绝；v1 与 profile/goal/session 过滤直接消费者。

已由 v2 COMMITTED amend 追加并由 Lead 供应三旧 test literal：`apps/runner/src/runtime-shutdown.test.ts`、`apps/runner/src/runtime-capacity.test.ts`、`apps/runner/src/runner.test.ts`。固定基线 peer 都只识别旧 claim route；必须改真实 fixture，保留保护断言，不引入产品 fallback。当前18scope已含三项，现已适配公开 v2 peer；unknown 保护以无新key/无重复attempt或adapter为准，不禁止合法同key恢复请求。

协议默认切换是外部边界改变；测试与独立 review 后由 Lead 更新架构/registry 并受控 main 接收。没有容量/性能 SLO 结论，不复测旧 sealed S01。
