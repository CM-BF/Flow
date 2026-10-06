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

## 执行配置薄接口 2026-10-06 04:11 UTC

固定target94f50acf38213caacb2852d740c818b8480e3d15：executionProfiles分页只读与publishExecutionProfile runner声明两方法，复用统一HTTP鉴权/AbortSignal，不添加可用性推断。领域合同60b由唯一owner维护。原始execution-profile-client.txt为1/1，366ms；execution-profile-client-typecheck.txt通过。0模型、无PG领域验证或在线能力背书。已发Mika独立只读review，尚未批准。clean-code复核共享方法不复制业务，不暗重试发布，client只传输。

main8f1481现场核实已含X02/CHAT共享接线，原095/37ab独立approval仍各自限定；本新增target不继承。

2026-10-06 04:12 UTC：Mika上述94f独审APPROVED，受审三文件/source合同对固定94f零diff，不覆盖随后O02依赖。O02需要的直接依赖声明dac8c391只增加runner zod4.6.5及dev MCP SDK1.32.1 importer；均为现有lock已固定版本，offline lock-only无新下载/版本漂移，依赖功能由O02真实MCP零模型用例验证。R04已停写index且claim1714v2移出，F01 claim8470v7原子接回；接收已审R04完整3770以保持其停机hook。

## CHAT03生产挂载 2026-10-06 04:17 UTC

固定300f0035b4c754cd09a4e38680378d8fb81924cc：server/index三行，010在scheduler前await，runner/owner角色hook之后路由，保留R04。生产createServer直接消费者只选3/7（目录重启/选择选路/两轮配置生效分层），3/3通过3.12s，4未选；typecheck通过，原始profile-production-consumer.txt/profile-production-typecheck.txt。0模型，测试SDK注入不冒充provider验收。Root只读独立APPROVED，无finding/未重跑，source固定与working一致；consumer hash 0ef54c31a9cec4991e12fbf392d102153f9aed14f9f925f14014e81c1b143338 / tsc1185ecf11053eb49f76c61e0735805fedcc40c0559340400df8b4df87f0a295a。领域a28由Mika独审，范围分开。

## 真实两轮报告及零模型补证 2026-10-06 04:29 UTC

复用本地find-skills/webapp-testing/clean-code，明确ready locator而非networkidle。真实2query固定dd1b/de9源码，原检查弱UI断言及pending截图原样保留；补focused visible second assistant exact text，仅重放保存响应，不再付费。首次主题定位失败和侧栏遮挡截图保留，04:28重放显式关闭侧栏后桌面/390px深色已目视正文可读，0POST/pageErrors空。报告区分SDK请求空扩展数组与init实际3plugins/3skills、归一化modelUsage与原始wire、累计估算与未知增量；无需为metadata重跑产品套件。manifest更新覆盖所有证据。

Root新增独立APPROVED dac8c3910eee1828e7081a3d33e19a89a056f4d4：仅runner package/lock importer，zod4.6.5对应O02生产import、MCP1.32.1仅dev peer；未改resolved块或SDK版本。O02固定8/8+tsc支持使用，无重跑，不与Mika94f客户端审查混同。

## O03事务内复用seam 2026-10-06 04:33 UTC

固定dbb57268889b82efb74c330bbf268b13f01b6402：只提取tasks.commandInTransaction与goals.applyGoalCommand，原pool事务方法复用它们。调用方必须在同事务完整授权后进入，含replay路径；本helper本身不构成新授权。F01 claim v8按CHAT03单文件停写/amend后接入tasks.ts；O01旧goals claim已released。

原goal公开HTTP/PG9/9通过，13.86s（原专库若存在失败关闭，实际创建/清理）；仅直接消费者，没有全库或模型。首次tsc因该WT尚未链接新增O02依赖失败，原o03-shared-seams-typecheck.txt保留；frozen offline install无锁变化，最终o03-shared-seams-typecheck-final.txt通过。clean-code检查只将原行为放在小Interface后，不新造domain mutation/通用workflow；O03独立授权/锁竞争测试归其owner。

## Native SDK环境隔离 2026-10-06 04:34 UTC

固定26ddd8de9fde0d67e6e42bd81a583facc993a31a，仅claude.ts/test；原CHAT02 owner停写/amend后F01v9接收。固定SDK0.3.290 sdk.d.ts1645–1662明确env替换而非合并，未设置时继承宿主。新增明确系统/本机provider认证允许清单，排除Flow token、数据库凭据和无关环境；保留HOME/PATH与本机SDK合法认证入口，不读取或打印真实凭据。没有改模型、工具政策、native session或profile声明能力。

先公开adapter新用例红（options.env缺失），原sdk-environment-red.txt保留；修复后完整此模块26/26，403ms，typecheck通过。注入query仅观察options，并启动真实Node子进程传精确env验证合成marker隔离/合法provider变量保留、宿主环境未变、事件不泄漏。没有真实SDK/query/provider实验，因此不宣称实际登录可用性；启动器角色隔离另由SVC715ec独审。

## CHAT04薄client / 2026-10-06 04:45 UTC
沿find-skills本地codebase-design/clean-code既定范围；复用单一HTTP request，不自动retry/改key/pause或取消其他task。消费Mika固定ae9d7203c30bdf5ec6825cee0e6ce86231c34cb2 schema，六方法保留queueRevision、expectedTaskId、AbortSignal、receipt replay；readonly GET与command分明。测试先[red](queue-client-red.txt)（方法未实现）后[green](queue-client-green.txt)2/2（队列及原对话HTTP），[typecheck](queue-client-typecheck.txt)exit0。仅client接线，不替代54领域用例/生产扫描/Web队列UI/真实模型证明。每个方法短且只转送事实，无新state副本。

## O03公共client与CHAT04/O03生产挂载 / 2026-10-06 04:51 UTC
O03薄client固定dc9a9f1，8方法分owner与runner认证实例，fenced输入/固定version/key/signal原样传送；[1/1 HTTP](o03-client-checks-final.txt)、[tsc](o03-client-typecheck-final.txt)通过。初始测试input类型错误[保留](o03-client-typecheck.txt)。runner_owner独立只读APPROVED该3文件，未重跑；不含mount。

生产挂载011/012先于boss；queue startup一次+1秒串行scan，关闭前停止未来scan并等inflight，后续才boss/pool关闭。factory仅显式automaticQueueScan:false支持领域手动驱动测试，生产main未提供该关闭选项。默认模式[真PG11/11](queue-o03-production-checks-final.txt)包括9条O03公开授权与2条新队列startup/阻塞scan不重叠/close等待；新test原始typing失败[保留](queue-o03-production-typecheck.txt)，最终[tsc](queue-o03-production-typecheck-final.txt)通过。首轮[9/11](queue-o03-production-checks.txt)的2项失败源于作者观测只筛测试pool application_name，原owner独立test-only e63修为专库+Lock+精确SQL，最终保留真实race断言。

Mika发现定时扫描与手动领域测试竞争；已交原owner以显式factory选项隔离，54领域与默认生产生命周期分开检查，不删断言。WPF-QUEUE00兼容reader5acc独审已收到，须成套后main；当下未进入main/未改61228常驻服务。clean-code复核将生命周期局限createServer，复用现scan模块，无第二调度状态，无owner credential进runner MCP。

2026-10-06 04:57 UTC：实际组合接收CHAT04 fac202测试驱动开关+Web reader5acc+profile模块4f；[默认/手动factory分离定向1/1](queue-scan-control-checks.txt)验证显式false确被生产factory读取，关闭后下次默认启动恢复同等待项。此前11/11仍为对应旧测试版本，分别报告不混成一次套件。root与Web组合类型检查见queue-profile-combination-typecheck.txt / queue-profile-web-typecheck.txt；零额外模型。正式独审结论已写review，main合入与常驻服务升级分开。

2026-10-06 05:13:17 UTC：O05 client固定e28d547ed3b446a252595bd1960953382ffa4dd8，沿本地find-skills/codebase-design/clean-code，复用现request小Interface；真实HTTP1/1(38ms、suite218ms)+root typecheck。red因方法缺失为真实失败，未改领域。source+logs见graph-proposal-client-manifest.json，待独立review，无模型/PG调用。

## O05生产挂载 2026-10-06 05:19 UTC

固定208a928969c8e343ea09ecc06db80a6808bbbd74，三文件：014 await在scheduler前、owner鉴权后路由；真实公开client→PG生产入口；旧012/013迁移测试改为旧1..13行及applied_at完整不变、版本唯一，允许合法后继迁移。取得F01 claim v11追加旧迁移test后修改。先实证硬编码13红例，保留red。组合6领域+1迁移通过，新client初次仅JSON对象key顺序断言失败（保存7/8）；排序比较后1/1。类型检查发现缺显式workspaceId，补与server默认相同personal后finaltypecheck及同1client重新通过。8个不同用例最终均有绿证据，不称一次整套8/8。无模型、无103旧套重跑。独立manifest绑定当前源与所有失败/成功输出。clean-code同stack本地方法复用：保持薄接线，领域未手改，错误与auth沿原逻辑；迁移消费者不再耦合未来总数。

## SVC02薄client 05:22 UTC
固定caea11bbd5589d33e1cad8d73a328587323ad873，4方法仅读维护快照/历史、发送drain/resume，精确保留CAS/operationId/key/原文与AbortSignal；不把计数或重放回执当停机许可，不包含host hold接口。真实HTTP1/1与noEmit通过，缺方法初红保留；无PG/进程/模型调用。沿既有传输Interface与错误机制，未扩第二调度器。
