# SVC02 固定32c更新准备（0query）

操作owner assignment_review / gpt-6-astra，原工具作者runner_owner。沿用唯一 preview-refresh / codex/preview-refresh；新claim a5c0fc33-356c-434b-8508-67796d21d414 v1，3literal仍为 tools/personal-preview（实现只读、操作协调）、本plan、svc02证据。旧debcec已受控ff，工具对已审9aa790552cb8847d6feb8c8f90c870407a54e572零diff。

候选严格固定 **32c371d389a913f8dd71c3bd8b98dd0697411256**。本次只准备，不授权drain/stop/refresh/resume，不修改个人profile、runner身份或activeSteering，不刷新tabs；旧窗口已关闭。O10无native许可，未来真实验收不得与本次服务窗口并跑。

## 实际只读事实

[08:23:20–22 UTC快照](refresh-32-readonly-facts.json)中，main精确32c且clean；真实sourceAtStart仍b54de1dbb08e3ccc7d33a27295a318f2799e76ae。三自有组PID/PGID为center95468、runner1776、Web1974，cwd与启动身份匹配，61227/61228监听归属正确。recognized runner main仅1943，属于1776组。Vite可能跟随源码变化，未刷新或观察用户tab，不声称已完整部署32c。

全库2任务均succeeded，未完成attempt总数0、uncertain/排队任务0；queue仅1 promoted。唯一注册runner d22f4df2-8242-49f4-a1b4-77f8f08611ef nonrevoked/capacity1/accepting v6，持久operation=NULL；本机maintenance仍保留历史已resumed的22adf2ed操作，不能作为新窗口授权。单runner依据是本安装已知部署记录、正式身份、全库未完快照；不声称发现异地主机或自定义同token部署，理论可能性不升级为新用户确认。实际其他部署/身份unknown才停止并协调。

原profile7ed454e9-f1db-420c-ac7f-4aa53f3856c0，access none、activeSteering缺省，digest未改。配置仍sonnet5-5/0材料/0工具/2turn/$0.20/60秒，未读取SDK登录文件或探测provider。私有目录0700、四文件0600/同uid/非symlink，marker和runner凭据在本机比较匹配，operation.lock不存在，native目录inode保留。secret与私有文件哈希不进入Git；本机0600比较基线 `/tmp/flow-svc02-private-baseline-32-preparation.json`。

现库迁移1..23；固定32c工厂还挂载024 active-steering。024文件在旧源码已存在，不是本次新增文件；实际执行记录尚无24。该迁移只新建steering表/index/审计trigger，不回填旧任务或更改profile，也不令现有none profile获得steering。升级后要核旧1..23记录保留和恰好一条24；绝不为准备先跑迁移。

[主目录依赖解析](refresh-32-dependencies.json)覆盖server/runner两个manifest全部声明runtime依赖，全部实际落在main路径，无global/其他feature树回退；只resolve而未运行SDK，不等于证明所有动态子依赖或provider健康。没有安装。本次只读采样已退出，无轮询。

## 固定审查输入

复用SVC02工具9aa批准、R04/R03关闭/租期边界及此前b54部署事实。最新[集成记录](../i02/stream-profile-integration.json)34 source+3 raw实际bytes/SHA复核mismatch=[]，CHAT09 cd8594（本owner此前独立review）、Web App9dafff、薄client89931、CLI0d48逐字接收；2个O09直接消费者+root/Web类型原始记录已核，未重跑。此处不是新的领域批准，也不是native/UI验收。检查见[source checks](refresh-32-source-checks.json)及[manifest](refresh-32-manifest.json)。

## 新窗口拟执行顺序

GO须另授精确target/owner/时间窗口，Lead期间冻结主源码且排除其他部署/实验占用。所有步骤使用main的既有Node24 CLI与原 `/Users/citrine/.flow-personal`，不换配置/DB/端口：

1. 窗口开始fresh核source/依赖/marker/正式runner与profile、完整全库未完和队列、已有部署/自有组/监听。任何active或unknown先报告不stop。保存旧数据ID/逐行序列化摘要、列集合与迁移记录；本准备九类数据摘要只是有界基线，不能当全库备份，conversations.queue_checked_at明确排除。未来若新增列，按固定迁移解释差异，不能用旧列交集掩盖旧字段变化。
2. 已审maintenance bootstrap持久drain，保存新operation/version。正在工作可继续heartbeat/report；fresh复核全库active/uncertain与其他部署，不因准备快照0而直接停。存在未决任务则保持drain并报告。
3. 同runner无未完后，refresh精确32c：取得hold→退出PG事务→只TERM已核自有Web/runner/center组→用原身份/端口启动。禁强杀/扫端口/第二center/删除数据。工具每组5秒超时即unknown，不能将R04 main20秒保险当已确认退出。
4. 新服务ready仍maintenance，核新source/PID/PGID/监听/公开健康、旧DB marker/profile/config逐字节/native目录保留、旧数据与迁移保留；024只加新表不启用steering。provider not-probed，0主动任务、0模型、0tab操作。
5. 交GO固定回执并等待一条显式resume授权。随后仅一次fresh相同operation/source/全库/自有组核对→一次resume；失败不换参数重试。恢复可能启动合法队列，必须独立许可，不能将0快照当授权。

## 失败与保留

drain前异常保持旧服务；drain/hold后失败保持暂停/unknown，不自动回退或resume。迁移一旦提交不能自动倒退；旧源码回退须另评估schema兼容。保留原DB、身份、profile、native目录、state/operation，禁止手改维护字段/清锁/伪造PID。进程退出≠任务已取消/外部副作用撤回。未来的真实模型可用性、插件启用、child执行和steering试验均不在本窗口。
