# RELEASE03 固定组合验证（源码准备）

当前完成固定源码草案与 17 个精确依赖链接，并按后继裁决增加先运行 A 两项历史的独立入口。已执行一次定向strict noEmit（1.84秒/exit0）；没有执行产品运行、PG、Chrome、build 或兼容旅程，不能作为发布通过证据。独审 NOT_STARTED。

## 固定输入

后台/公开 client/contracts 使用本树 `362af3bac77541e5a60979326bcf4d4b8c947915`，不借其他树的工作区包。正式前端 descriptor、sourceHead506、获审来源9eec 与 releaseId 见 [artifact-input](artifact-input.json)。既有 84005 工具和362源码逐字一致，来源见 [fixed-input-sources](fixed-input-sources.json)；本片只调用 verify/import，不 prepare/build，不写 release pointer。

## 两脚本职责

[fixture](../../../apps/web/test/web-current-preview.fixture.ts) 隐藏实际 createServer、精确静态 manifest host、流式 HTTP 代理、公开 runner 原生事件模拟。合成 runner 只 report session/context-observation/completed，不调用 provider 或 SDK。先分别执行附件-only/mixed history；沿已审修复的语义要求 v2 materials 为 unknown/metadata-unavailable、material digest 为 null。362已知缺陷不修不隐藏。

[browser](../../../apps/web/test/web-current-preview.browser.ts) 是拥有资源的监督进程和受控子进程入口。实际 App 旅程先 plain v1 省略字段，再 Files v2 Send/Queue 丢成功ACK与原key/body恢复、新草稿保持、实际协商及两主题截图。默认队列扫描保留，但此小矩阵不声称覆盖全部队列promotion/provider行为。

父进程先登记 attempt，再导入产品；拥有随机标记DB及 child/Chrome两个独立过程组。Chrome由父进程先spawn并记录PID再等待DevTools端口，避免launch Promise迟到失去所有权。工作阶段保留20秒清理，TERM后3秒仅KILL自身过程组，检查退出和DB marker，DROP不使用FORCE。CREATE结果未知/marker不符时保留专库事实，不猜测删除。硬截止保存未确认清理，未完成budget禁止重跑。

## 准入与资源

当前不可运行。未来 manager/root 明确准入后才能提供 `FLOW_RELEASE03_GATE`，其JSON必须含 allowRun、mode（history或all）、准确backend/artifactId、唯一简单run名、过期时间、totalMs及minimumFreeBytes。脚本要求累计<=180000ms、每轮>=20000ms清理，mode=history单次至多60000ms（含20000ms清理），start>=1GiB+32MiB、stop<=1GiB+16MiB；mode=all保留start128MiB/stop64MiB附加余量。monitor失败也停工作。监视先于business import/CREATE启动，关键await后fresh checkpoint防止已stop后继续spawn；worker import/factory/listen/manifest await亦核abort。250ms轮询不是硬配额，无法排除其他进程/OS并发。Lead此前同factory专库12,360,727B是实测数据库大小，不是PG/WAL物理增量上限；32MiB给A-only一个受监督的增量窗口，不能源级证明瞬间peak。A不生成Chrome profile、不build/clone/install，retained证据仍总8MiB，剩余约1GiB用于未知并发/清理；fresh资源准入仍必要。

未来命令形式（未运行）：`TSX_DISABLE_CACHE=1 FLOW_RELEASE03_GATE=<manager-owned-admission> /opt/homebrew/opt/node@24/bin/node --import tsx apps/web/test/web-current-preview.browser.ts`。没有install、build、复制源码/依赖步骤。

原始报告保留在本evidence的runs/<唯一run>。保留证据总量<=8MiB（含两脚本对应run日志/原始HTTP/JSON/截图），过程日志另限1MiB，HTTP累计2MiB/1000records/单JSON128KiB。Chrome临时profile只在自有scratch，作为运行物理资源受余量观察，清理后不作为保留证据；不是8MiB峰值保证。只借第三方realpath只读；17links已停止写入且claim收窄回4。[链接结果](dependency-link-result.json)、[收窄回执](dependency-narrow-receipt.json)。

## 失败与通过

最新调度首先采用mode=history：A两项逐项保留raw后清理，B明确NOT_RUN；任何A失败即使mode=all也禁止请求Chrome。A全绿但mode=history仍封存停止，不能自动续跑B。任何 history、App、来源、asset、非预期console/network、预算或cleanup失败均阻止完整 SVC report/import。原始history结果和App独立事实仍分别保留。四observations从wire/DOM结果计算；报告工具本身不证明业务兼容。只有全部检查和cleanup成功后，在自有目录生成并验证原SVC格式，绝不写个人发布指针或升级个人服务。history未修即使App通过仍不得发布。

注册runner的临时token在wire持久化前删除（原响应hash保留），Authorization不记录；临时owner/runner token只在进程内与自有待删除Chrome profile中使用。报告不引用用户凭据、个人目录或用户tab。
