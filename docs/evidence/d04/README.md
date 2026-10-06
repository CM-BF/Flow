# D04 领取协调证据与使用

## 运行边界

复用 pg 8.23.1 / Node24，独立 `flow_coordination` 数据库、`flow_engineering` schema；不修改产品 flow 表/migrations、不增加第二种数据库。看板进度仍从各唯一 owner status 读取，账本只负责分配。当前本机合作式 CLI，没有 OS 写入隔离、远程身份认证或自动抢占。

配置 `FLOW_COORDINATION_DATABASE_URL` 为专用协调数据库连接，`FLOW_COORDINATION_REPO` 为 Flow Git 主仓库绝对路径；连接凭据不提交。管理员预先创建专用 DB，然后 `node apps/execution-dashboard/src/coordination/cli.mjs init`。看板进程需同一数据库环境配置。`list` 是只读；数据库未配置/不可用时 CLI 失败关闭，网页显示领取状态未知，不能视为空闲。

命令：`node apps/execution-dashboard/src/coordination/cli.mjs take /absolute/command.json`（amend/handoff/accept/release/touch 同形）。输出成功 JSON 后才算取得回执。连接 800ms、SQL 1000ms、客户端查询 1200ms 上限；串行多条命令总耗时另计。`committedAt` 是事务末数据库记录时间，只有 COMMIT 确认后输出；不是声称 WAL 精确提交时间。丢失响应重试同 requestId/规范化 payload，返回原 receipt；不同 payload 拒绝，未知结果不允许新写。

```json
{"requestId":"stable-request-id","actor":{"lead":"lead-name","worker":"worker-name"},"taskId":"EXAMPLE-01","role":"writer","worktree":"/absolute/Flow-worktrees/example","branch":"codex/example","scope":["apps/example/","plans/example-01/"]}
```

目录必须是该仓库真实 worktree，分支与现场一致。scope 为 literal 仓库相对路径，拒绝 glob、../、.git、symlink；按路径段冲突，foo 与 foobar 可独立领取。writer 对同任务/同worktree/父子scope冲突不能双成功；review role 不占写范围；integration scope 必须空，只表示应用已审提交，手工修冲突或新实现仍向 owner 协调范围。

`amend` 输入 claimId/version/actor/scope，事务内检查新范围，失败旧占用不变。迁移观察时间错误可同命令加 observedAt/correctionReason 留审计纠正；不改历史。

`handoff` 输入 claimId/version/actor/stoppedWriting:true/next:{lead,worker,worktree,branch}。旧 owner 先停写，handoff_pending 仍保留旧/新树与范围；接收方用新的 version 执行 accept 才能写。release 也须 stoppedWriting:true。review/修复期间继续占用；转交后旧 owner 不得继续修复。touch 明确复核当前版本，24小时陈旧只提示、绝不释放。每次继续新工作核对当前 claim version/state，历史 receipt 不能覆盖后续 release/handoff。

## 验证

- PostgreSQL 真双 Node process 同 task/父子 scope 争领仅一成功、不同范围均成功；丢响应相同请求原receipt、改payload拒绝、amend冲突不改旧记录、旧version拒绝release/handoff、停写确认、handoff占用、旧owner拒绝、陈旧不可抢、readonly review不阻塞。
- 未配置/拒绝连接返回 unknown；真实 TCP 黑洞接收连接不回PG握手时，HTTP snapshot 约1.06s返回原两任务进度与领取未知。只使用临时端口，不停止现有DB。
- [浏览器检查](browser-checks.json)：Chrome154，26权威来源/10真实PG占用；1440浅色和390深色、无水平溢出、明确全局M2标题、外部精确scope详情、协调DB失败仍返回进度。实际查看 [浅色](desktop-light.png)、[深色](narrow-dark.png)、[领取详情](claim-details-dark.png)。这是新版本动态端口检查；4320切换另记，不能冒充当前部署。
- 局部复跑：设置 `FLOW_COORDINATION_TEST_ADMIN` 为本机可创建临时库的PG连接，运行 `node --test apps/execution-dashboard/test/*.test.mjs`。测试创建独立 flow_claims_test_PID DB/临时worktree/动态端口并清理；0模型、0云、无产品全套测试。

## 迁移与质量

[迁移输入](migration-inputs.json)记录既有合法开工者，不能冒充新领取前已执行检查。[实际回执](migration-receipts.json)保留首次receipt和currentReceipt；[纠正记录](migration-corrections.json)保留首次脚本误用未来02:55观察时间的8项原值与受审计amend，已纠正为实际02:48:42读取时间，输入校验现拒绝未来时间。外部WPF原02:41观察时间保留，WorkspacePanels.tsx追加已包括。

clean-code/结构检查：账本集中事务、幂等与范围冲突；CLI不输出PG内部错误/凭据；页面只读textContent，进度不复制入DB；错误不变空闲，未过时重试不自动改owner。保留本机合作身份、全局工程低频锁、DB可用性和有限数据量限制；不称完整分布式调度/权限系统。

跨 task 部分范围移交允许：旧 owner 明确停写该范围 → 当前 version 的 amend 移除 → 新 owner take 成功后开工；期间新领取若冲突则重新协调，旧 owner 不恢复已交回写权。扩大原 claim 仍用原子 amend，整 claim handoff 保持 pending 占用。
