# CHAT03 已配置执行目录与受理

状态：implemented-awaiting-review；创建2026-10-06；最近更新2026-10-06 04:08 UTC。Owner runner_owner / gpt-6-astra，worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-profiles`，branch `codex/execution-profiles`，base149f50eb8440ed56e49cbdddb83f37bd18d6caa0（集成候选，不是main能力）。

已批准的有界架构片段：runner按私有manifest与已知adapter policy发布脱敏、不可变execution profile；选择profile的新conversation与普通task经公共acceptTask验证后持久pin，claim仅该runner，adapter前比较本地profile。改变执行配置要求新runner identity，不热更新/预热。用户requested、runner配置、SDK实际effective分开；alias不是resolved型号，provider能力未查询。无profile旧路径兼容。

公开Interface：POST `/api/runner/execution-profile`（runner credential，天然同内容幂等）；GET `/api/execution-profiles`（owner，after/limit分页）；新增domain `execution-profiles.ts`。profile reference为id/runnerId/configDigest；config仅model/已知adapterpolicy/limits及opaque materialScopeDigest，绝不发送路径/凭据/正文。context内容版本与任意文件授权不属于本片段。

- [x] **CHAT03-01** 冻结小合同/设计/公开入口，尽早交Lead与外部U11消费。
- [x] **CHAT03-02** migration010、不可变目录/身份/幂等，公开HTTP受理校验与claim路由。
- [x] **CHAT03-03** 私有manifest生成/发布配置及运行前guard，普通启动入口确实应用profile。
- [x] **CHAT03-04** 0模型真实PG/HTTP两配置选路、错误pin/revoked/resume、幂等重启与SDK实际值分离；固定证据交独立review。

验收seam经派工确认：公开HTTP/真实PG、loadRunnerAdapters/loadRunnerConfiguration与公开HarnessAdapter.run/runRunner，模型只注入SDK。专用flow_chat03，动态端口，拒绝覆写既存DB且清理自己资源。局部影响测试含conversations/runner配置与claim直接消费者，不因metadata重复全套。

不修改claude.ts/runner.ts/公共exports/client/server index/rootlock，接线由Lead。canonical产品UI仍归[U11外部计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform/plan.md)，不是cap=false即可关闭U11；effort/queue/steer/voice/files/热配置等保持未实现。已授权设计直接推进，不重复审批。

[唯一状态](status.md)、[独立review](review.md)、[架构](../../docs/architecture/chat03-execution-profiles.md)、[证据](../../docs/evidence/chat03/README.md)。
