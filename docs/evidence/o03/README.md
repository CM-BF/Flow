# O03 中心工具授权：作者检查

固定实现 `94e012ac44095ab3d4aca54df7951d0971f69dfa`；base `4e0289f29ffa48c6c49003837d4520f57c22b6b0`。Root 独立只读审查 APPROVED，0 findings；未重跑作者检查，见 [正式审查](independent-review.json)。0 模型、0 云调用。

本模块把 owner 创建的固定 goal/node/command 范围持久绑定到新建 planner task。Runner 使用当前有效 attempt 的已有凭据；grant 只是非秘密引用，不能单独授权。每次读取、命令及缓存重放均在同事务核验 runner、task、attempt、租期、grant 与撤销状态。复用既有 goal mutation 和 command helper，命令、审计、额度一起提交。撤销工具权限不等于停止 runner。

作者检查使用 Node v24.20.0 / Vitest 4.0.18、真实 PG、独立 UUID 数据库和动态端口。9/9，8.11s；TypeScript 通过。测试使用 createServer 的真实鉴权与现有 routes，显式调用本模块 migrate/register；**尚无生产入口挂载**。原始输出：[最终行为检查](checks-final.txt)、[类型检查](typecheck-final.txt)。

- Owner 持久受理/命令幂等；真实发布 readonly Claude profile 后 native 请求仍明确 409；runner 不能访问 owner API。
- 固定 runner/current attempt/ownerVersion/grant/node/command 检查；跨 goal、跨 runner、子任务借用 grant 均拒绝。
- 重启后精确重放；同 key 异内容拒绝；版本冲突回滚不扣额度；no-op 算一次新准入，replay 不再计数。
- 撤销后缓存命令也拒绝；过期、完成、runner 撤销拒绝。两项 race 用 PG 行锁确认命令正在等待，再让公开 revoke/cancel 完成；释放锁后 cached replay 被拒绝。
- 成功审计按 attempt/version/key/digest/result refs 持久化；分页上限 50、grant 上限 32。SQL 负例验证 scope/audit 不可改。
- define + execute 复用同事务 goal helper，创建可公开 claim 的 fixture child；child 不继承规划工具权限。没有运行 SDK/query 或 OS runner 进程。

可复跑：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/goal-tool-runs/authorization.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

需要本机既有测试 PG（55432），用例自建 `flow_o03_<uuid>` 数据库、动态 HTTP 端口并清理。本次收尾只读核对无剩余 O03 数据库，见 [清理记录](cleanup.json)。未停止其他服务。

失败保留：[首 tracer](red-admission.txt) 是缺模块导致测试装载失败，不能算已执行行为失败；[首次单例通过](green-admission.txt)。[扩展初次失败](progress-authorization.txt) 是测试错误假设队列立即可 claim，修为公开 claimReady 后 [8/8](green-authorization.txt)；最终新增 child 隔离检查为 9/9。[中间 tsc 失败](typecheck-progress.txt) 是测试 UUID 默认值类型过窄和 server 未声明 zod 直接类型依赖，已改明确 string 及 contract 导出类型。未删除失败记录或放宽业务断言。

限制：重启是同测试进程 close/recreate，不是 OS hard-kill。准入成功后再发生的撤销/取消不回滚已提交变更。snapshot 仍读取整个固定 goal；node allowlist 只约束 input/commands。只审计成功准入命令及独立撤销事实，不保留无限未认证/拒绝尝试。当前只支持 fixture；native profile/query/O02 host桥接、NL 自动拆图、生产挂载/公共 client 留后继，不把此片段标为完整 U11/O01。

[来源与输出散列](manifest.json)、[设计/clean-code](design.md)、[唯一状态](../../../plans/o03-goal-tool-authorization/status.md)。全部 7 个源码文件与 9 份原始输出/回执记录散列。
