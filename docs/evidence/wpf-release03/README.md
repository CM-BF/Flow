当前源码修复固定 `9927bb071494ec16a9d8091a6ba5edb4ea72c18a`：真实聊天区 Files 定位与完整all12raw中的成功A复用；待独立源审/新app-only gate，未执行新检查。原all事实与全部失败原始材料如下。

# RELEASE03 固定组合验证（A通过，B定位器失败）

固定target `c18bd6630cbdbb431460688a0f6bea9248f4151f` / 实际HEADba7dea，backend af51 + formal artifact d629，16:47一次all已完成：attachment-only与mixed真实history两项PASS，B真实App plain Send通过后Files双按钮定位歧义失败。完整兼容未通过，未生成/import SVC绿报告，0provider；[原样结果与12raw hash](all-result-164711.json)。本次12,326ms，累计20,309/180,000ms、余159,691ms。DB/worker/Chrome清理errors=[]，窗口已交回。

原362失败、A2 NOT_RUN、A3资源中断均保留；A3不是成功证明。本次完整A必须经独立raw核验与fresh app-only gate后才能复用，不能凭historyPassed布尔自动续跑/发布。只读[root标签修复审查](source-review-c18bd-root.json)不是整组兼容批准。

## 初始432b输入与后继

旧A的后台/公开 client/contracts 使用本树 `362af3bac77541e5a60979326bcf4d4b8c947915`，不借其他树的工作区包。正式前端 descriptor、sourceHead506、获审来源9eec 与 releaseId 见 [artifact-input](artifact-input.json)。既有 84005 工具和362源码逐字一致，来源见 [fixed-input-sources](fixed-input-sources.json)；本片只调用 verify/import，不 prepare/build，不写 release pointer。后继新source从外部已登记af51路径实际加载factory，本树client/contracts仍362；其精确闭包/实际HEAD与历史输入分开，见当前backend输入接口。

## 两脚本职责

[fixture](../../../apps/web/test/web-current-preview.fixture.ts) 隐藏实际 createServer、精确静态 manifest host、流式 HTTP 代理、公开 runner 原生事件模拟。合成 runner 只 report session/context-observation/completed，不调用 provider 或 SDK。先分别执行附件-only/mixed history；沿已审修复的语义要求 v2 materials 为 unknown/metadata-unavailable、material digest 为 null。362已知缺陷不修不隐藏。

[browser](../../../apps/web/test/web-current-preview.browser.ts) 是拥有资源的监督进程和受控子进程入口。实际 App 旅程先 plain v1 省略字段，再 Files v2 Send/Queue 丢成功ACK与原key/body恢复、新草稿保持、实际协商及两主题截图。默认队列扫描保留，但此小矩阵不声称覆盖全部队列promotion/provider行为。

父进程先登记 attempt，再导入产品；拥有随机标记DB及 child/Chrome两个独立过程组。Chrome由父进程先spawn并记录PID再等待DevTools端口，避免launch Promise迟到失去所有权。工作阶段保留20秒清理，TERM后3秒仅KILL自身过程组，检查退出和DB marker，DROP不使用FORCE。CREATE结果未知/marker不符时保留专库事实，不猜测删除。硬截止保存未确认清理，未完成budget禁止重跑。

## 准入与资源

本次唯一A准入已消费完；后续运行仍需 manager/root 新明确准入提供 `FLOW_RELEASE03_GATE`，其JSON必须含 allowRun、mode（history、app或all）、准确backend/artifactId、唯一简单run名、过期时间、totalMs及minimumFreeBytes。脚本要求累计<=180000ms、每轮>=20000ms清理，mode=history单次至多60000ms（含20000ms清理），start>=1GiB+32MiB、stop<=1GiB+16MiB；mode=all保留start128MiB/stop64MiB附加余量。monitor失败也停工作。监视先于business import/CREATE启动，关键await后fresh checkpoint防止已stop后继续spawn；worker import/factory/listen/manifest await亦核abort。250ms轮询不是硬配额，无法排除其他进程/OS并发。Lead此前同factory专库12,360,727B是实测数据库大小，不是PG/WAL物理增量上限；32MiB给A-only一个受监督的增量窗口，不能源级证明瞬间peak。A不生成Chrome profile、不build/clone/install，retained证据仍总8MiB，剩余约1GiB用于未知并发/清理；fresh资源准入仍必要。

实际运行沿此命令形式（本次gate原样保留在[history-gate](history-gate-152729.json)，后续不得复用）：`TSX_DISABLE_CACHE=1 FLOW_RELEASE03_GATE=<manager-owned-admission> /opt/homebrew/opt/node@24/bin/node --import tsx apps/web/test/web-current-preview.browser.ts`。没有install、build、复制源码/依赖步骤。

原始报告保留在本evidence的runs/<唯一run>。保留证据总量<=8MiB（含两脚本对应run日志/原始HTTP/JSON/截图），过程日志另限1MiB，HTTP累计2MiB/1000records/单JSON128KiB。Chrome临时profile只在自有scratch，作为运行物理资源受余量观察，清理后不作为保留证据；不是8MiB峰值保证。只借第三方realpath只读；17links已停止写入且claim收窄回4。[链接结果](dependency-link-result.json)、[收窄回执](dependency-narrow-receipt.json)。

## 失败与通过

最新调度首先采用mode=history：A两项逐项保留raw后清理，B明确NOT_RUN；任何A失败即使mode=all也禁止请求Chrome。A全绿但mode=history仍封存停止，不能自动续跑B。任何 history、App、来源、asset、非预期console/network、预算或cleanup失败均阻止完整 SVC report/import。原始history结果和App独立事实仍分别保留。四observations从wire/DOM结果计算；报告工具本身不证明业务兼容。只有全部检查和cleanup成功后，在自有目录生成并验证原SVC格式，绝不写个人发布指针或升级个人服务。history未修即使App通过仍不得发布。

注册runner的临时token在wire持久化前删除（原响应hash保留），Authorization不记录；临时owner/runner token只在进程内与自有待删除Chrome profile中使用。报告不引用用户凭据、个人目录或用户tab。

## 15:07 历史未运行事实

[source-review-432b](source-review-432b.json)为root只读源码批准，不是运行/发布批准。[history-admission-not-run](history-admission-not-run.json)为manager15:07:01Z原样观察：free1,058,885,632B<start1,107,296,256B，claim/source/17links通过但gate=null。没有启动PG/HTTP/Chrome，业务累计0；不重采重试，窗口交回Lead，等待未来明确fresh准入。

## 15:27 唯一A运行与失败隔离

[管理fresh准入](history-admission-152729.json)、[本人live claim](history-owner-live-1527.json)、[完整结果索引](history-result-152729.json)。两项均按真实factory/client/HTTP执行，并各自保留上下文与wire，不因第一项失败跳过第二项。attachment-only的事件HTTP500；mixed的事件HTTP200但历史只标记知识sources，不能代表完整v2材料。A失败按固定入口停止，B/原key App retry/Queue均NOT_RUN，不能给正式前端与362整组背书。原raw不改，不追加自动重跑。

当前候选新增app-only，不重复同输入已绿A；必须独立raw审查/freshgate，参见当前接口。原dbaa无B-only与003792闭包均为历史，不是当前准入示例。
