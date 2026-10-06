# P02 持久A2A出站检查

最终源码target **e2955d4bc33c458b6dbdd10f380f834557ba98fa**（含Lead共享生产入口9db3ce，pick为05a1308）。02:56 UTC **13/13 + typecheck通过**，17.85s。[最终原始JSON](production-checks.json)、[输出](production-checks.log)、[源码/证据hash](production-manifest.json)。

全部中心测试已删除手工迁移/路由注册，要求createServer内置挂载。新增一条真实server/main、runner/main、CLI/main独立进程旅程：空flow_p02自动迁移、动态端口、CLI注册a2a与submit --endpoint、CLI查询protocol/show、remote仅发送一次、lowerstore exact content、verification passed、cost unknown，以及两端SIGTERM exit0。其余9项runner进程场景仍以专用入口注入短heartbeat/request间隔。独立review尚未开始，不把作者检查当review批准。

以下为历史模块切片记录，入口尚未挂载的描述仅适用于其对应target；原JSON/hash未覆盖。

前一模块阶段源码target **4c2e037488dcd0847cfba5068b5a1621648237e9**；02:53 UTC联合12/12（15.60s）+typecheck通过。[最新原始JSON](timeout-checks.json)、[输出](timeout-checks.log)、[源码与证据hash](timeout-manifest.json)。新增中心ACK悬挂而heartbeat健康的超时回归先红后绿；有界请求等待后明确uncertain，远端send0、无重发。产品main入口仍待共享挂载验证。

以下保留11项首阶段的准确检查记录，原JSON/hash未覆盖。

源码target **572d6a095421074b2affe961cb78d82fd9e504ee**，基线72278b22ae81f551dc13d68da2fb45f2ef182038。中心/runtime实现1bb6c27，公开client endpointDigest修订6503253（Lead cdd215e）。2026-10-06 02:49 UTC：typecheck通过，11/11检查通过（13.45s）。[原始JSON](checks.json)、[原始输出](checks.log)、[源码及证据SHA256](manifest.json)。

持久权威是专用PostgreSQL flow_p02；中心监听动态端口；8个runtime场景启动独立Node进程，调用公开runProtocolRunner；外部对端使用固定@a2a-js/sdk1.3.0的真实HTTP/JsonRpcTransportHandler/DefaultRequestHandler。对端InMemoryTaskStore只做确定性夹具，不宣称远端持久产品。进程入口当前为test-process.ts；产品main挂载尚待Lead共享提交，不能把这个测试入口称为产品CLI启动验证。0模型、0云、未动4320。

| 实际场景 | 核对结果 |
| --- | --- |
| 并发begin/同命令重报 | 恰好一个maySend；binding不可改指另一remoteTaskId |
| 中心/runner重启且bound | 原attempt、原binding；只SendMessage一次，GetTask继续 |
| sending持久但begin ACK未到runner | 退出恢复uncertain，remote send为0，不盲重发 |
| 远端接受但SendMessage ACK未到runner | 退出恢复uncertain，remote send为1，不盲重发 |
| binding持久但ACK未到runner | 重启GetTask同remoteID，remote send仍1 |
| cancel收到非终态Task后重启 | 保持cancel_requested；CancelTask只发一次，直到GET确认canceled才报cancelled，0artifact |
| artifact已入库但ACK丢失 | 同稳定event重报，单artifact/version与单verification，无序号缺口 |
| remote completed且空text | execution succeeded与verification failed分别呈现；未知usage/cost仍null |
| heartbeat失败、有效租约变过期 | 停止远端Get；任务uncertain，恢复空、claim空，不自动重派或复活 |
| stale fence/非法runner权限 | 409/403；取消许可仍不等于实际停止 |

取消夹具明确通过官方handler子类返回working Task，检验Flow对尚未停止/异常对端ACK的防御性行为；不是对官方默认取消实现做无证据推断。初次测试发现官方默认handler在bus结束后立即写canceled，[保留失败记录](cancel-fixture-initial-failure.log)；修正夹具而非降低产品断言。重新阅读官方[Cancel Task](https://a2a-protocol.org/latest/specification/#315-cancel-task)确认应依据返回/查询的更新Task状态，SendMessage相关messageId不等于远端幂等。

复跑（会清空**仅flow_p02**的flow/pgboss schema，不可指向用户数据库）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/protocol-dispatch/dispatch.test.ts apps/runner/src/protocol-dispatch/runtime.test.ts
```

范围：A2A 1.0 JSONRPC Task-based远端，polling GetTask权威快照，inline text artifact进lowerstore后本地独立verifier及中心核验。ref→URL摘要固定身份，token仅本地配置；runtime与SDK限制单次请求/响应、artifact条数/字节。未验证真实公网、真实模型、MCP持久Task/elicitation、通用成本/全程预算、多进程共享同runner身份并发恢复、完整协议conformance；P01-06剩余要求保持open。input/auth-required与直接Message结果不冒充完成，进入uncertain待后续交互适配；远端停止不能由本地断连或取消ACK推断。
