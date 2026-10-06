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

CHAT client/export frozen84117ca：真实HTTP传输5/5、typecheck，0模型；中心模块尚未可用。Web基线无O01上下文导致pick冲突，共享owner生成web-chat-transport.patch（基线bac6）仅同三文件聊天内容，manifest逐文件hash，外部受控应用而非另改client。两轮真实模型提案见chat-live-proposal.md，预算已条件批准，三端审查/main/实际配置未就绪；0调用。


## CHAT生产入口与X02消费者 2026-10-06 03:51 UTC

沿用同TypeScript/Fastify/pg/client/CLI任务的find-skills发现；再次读本地clean-code/codebase-design，将业务约束保留原领域module，薄消费者只负责传输/输入schema/稳定key。没有新依赖。CHAT完整挂载37ab367在createServer初始化007会话和009正文、鉴权hook后注册接口；初期1d4/e599只import/register未迁移的中间态未交外部当完整可用入口，最终37ab已补完整并typecheck。

X02接收已独审3d0cfc8完整领域，生产008位于projects/会话之后、正文009之前；插件client七方法与CLI register/list/show/versions/history/operation/change只使用owner HTTP。无install/enable等虚假命令，输出runtimeStatus仍unavailable。输入32KiB/公开schema，命令显式稳定key，CAS409保持exit3，不暗重试。领域实现未改；新增依赖/根锁变化均为零。

固定共享目标095497dc1719d10df8309fdf17d95539fc891e06：真实PG+公开CLI1条纵向行为与client4条共5/5，2.25s；typecheck通过。原始输出plugins-checks.txt/plugins-typecheck.txt。注册重报、配置更新、旧revision冲突、历史读取、project过滤、中心重启和无隐式task/包安装均断言；专库flow_plugin_cli_PID_TIME与临时输入、动态端口清理。没有重复X02全17或全库，0模型。

clean-code检查：错误不回显私密配置，CLI不把登记当安装，领域schema只有一个来源，thin methods保持统一鉴权/AbortSignal。CHAT02正式10模块测试由该owner保存（含首次HTTP teardown失败及修复后10/10）；共享入口独审另绑定37ab，不以CLI测试代替聊天完整验收。

完整模块接收后集成候选149f50eb8440ed56e49cbdddb83f37bd18d6caa0：只选真实adapter注入SDK两轮、typed pending→success/重报重启、unknown与长正文lazy三条直接消费者，3/3通过（明确另外19条未选，非22重跑），3.38s。原始chat-production-consumer.txt；正式createServer含007/008/009，不用测试旁路挂载。CHAT01领域相对独审d0f零diff，CHAT02 test修复fcbc另独审；0模型，Web新聊天尚未完成独审。

独立接线批准：Mika只读APPROVED 095497，五文件及raw hash已核，未重跑，无finding；Goal Owner只读APPROVED 37ab（1d4父版本→37ab的两文件组合），007/009 await位于serve前、owner auth后注册、pool异常清理与export准确，10/10原始stdout和共享source hash吻合。字段/限制与领域review分开，真实模型仍0。
