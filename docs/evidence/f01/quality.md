# F01 工作段检查

2026-10-06 02:38 UTC，Lead / gpt-6-astra ultra。find-skills本地优先，复用已读codebase-design/clean-code/tdd；新protocol任务schema与runner ownership相互依赖存在环风险，领域owner将纯zod endpoint schema独立成protocol-task.ts，公共task直接复用而不复制。

集中harness/authoritative来源政策：fixture、Claude、A2A三种明确配置；A2A没有可信模型usage来源，不能默认归Claude。任务a2a必须endpointRef，禁止native resume/fixture混用。client保持薄传输，未知dispatch错误不重试，支持AbortSignal。outbox从中心确认lastSequence续接，验证非负安全整数；heartbeat新增服务器租期剩余量，既有native runtime仍用旧墙钟，R03风险未谎报已修。

4文件9/9通过，0.58秒；root typecheck通过。新增测试先因缺模块失败，记录为缺实现的red（不是功能回归已执行）。未全库/模型。P02中心真实HTTP/PG与native直接消费者待后续集成核验，不把本接口检查当远端执行完成。

## 共享接线交付记录 2026-10-06 03:02:23 UTC

被测/已审target：36aeaff12000d77ebd025859f999c69612fce653。以下为已经执行的工具运行记录整理，不冒充重新运行的原始stdout：

- `pnpm exec vitest run packages/client/src/client.test.ts`：4/4，0.178s；endpointDigest传输与其余认证/幂等/SSE检查。
- `pnpm exec vitest run apps/cli/src/projects.test.ts packages/client/src/client.test.ts`：5/5，1.35s；真实PG生产注册+CLI与四个HTTP client行为。
- `pnpm exec vitest run apps/server/src/projects/projects.test.ts apps/cli/src/projects.test.ts`：11/11，5.37s（G01十项4.253s、CLI一项0.519s）。真实独立flow_g01/flow_f01_PID_TIME均清理、动态端口。
- `pnpm typecheck`：通过。没有因metadata再跑全库测试。0模型。

CLI链路：个人workspace→创建project→版本命令增节点→同key重放→旧revision拒绝(exit3)→旧历史可读→中心重启后revision2仍在；计划节点不隐式创建执行task。P02实际server/main、runner/main、CLI全链由P02 owner单独执行并保存其report，不能用本记录代替。

Goal Owner独立只读接线APPROVED：9db3ce18e17ded201673bb3e514d5005cd68d866 / 71bff1f8a974fee7321c4d2cc5ee2dddde22abd3 / 36aeaff12000d77ebd025859f999c69612fce653；已读源码与测试，未重跑。只覆盖入口接线，G01 core6394、P02 coref942各自另有独立review。clean-code复核：领域schema复用、薄client不暗重试、显式稳定key、原P02初始化两P2由原owner修复，不能让共享approval掩盖模块问题。

## O01 public consumer接线 2026-10-06 03:32 UTC

接收O01固定6bb380b与a4e1348修复；早期cherry-pick历史导致11处add/add，全部使用原owner完整6bb版本，O01领域实现范围零diff，未手工重写。原始证据stdout的尾行/空白保持不改，diffcheck仅对非原始txt实施。共享client新增createGoal/readGoal/readGoalInput/commandGoal/goalExecutions；CLI薄层复用schema与显式稳定key，不生成隐式执行。

首次局部6/6（目标CLI1+项目CLI1+client4）2.09s；typecheck发现测试构造缺schema默认化后的workspaceId/taskId/parent，原错误保留。仅补明确测试字段，最终typecheck通过、受影响目标CLI1/1 1.10s。真实独立flow_goal_cli_PID_TIME DB/动态端口，重启保留原文、历史input读取、旧revision拒绝、幂等重放、无implicit任务。原始输出分列goals-*.txt，0模型，没有重跑O01完整模块/全库。

clean-code复核：领域事务不复制进client/CLI，JSON输入受schema约束，所有命令显式key/AbortSignal，无不明自动重试。尚不含自然语言规划或native tool挂载；CHAT01普通会话走独立模块，不等待编排。
