# SVC05H01 发布前只读准备

2026-10-06 18:01 UTC。候选 af51、当前个人后台362、当前开发main8fc三者分开；本轮没有drain/hold/refresh/resume/publish、无任务创建/重试/取消、无provider、无用户tab动作。

## 已获得的兼容结论

RELEASE03 实际 A all12（复用原证据）+ B 三项及独立Root审查明确通过，固定后台 `af51c621696230fbced12227670f014ca73bd8a1`、Web `5069586a9f17332de526e101eca3a4250cbc8d91`、artifact `d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88`。报告ID `599a5b170693d2fd154f02302545751afa8cd4222bccaa198ece807b81c28fe9`及四check文件本轮只读实算hash一致；未重跑。原362附件历史失败保留，不以新报告改写。

对362，候选只有store.ts三行生产差异和一份已审测试，无锁/manifest/SQL/其他产品差异。metadata提交不改变af51的固定Git对象或两源码；实际维护target必须仍取报告的完整af51，而非本记录新HEAD或moving main。

## 个人安装的实际快照

两次只读HTTP观察和一次独立只读PG快照，raw保留在本目录。后台记录仍362/clean；3owned PID/PGID为64904、65168、65219，身份running且61227/61228监听归属同；已知本地runner main仅同runner组。正式runner/token-hash比对及DB marker匹配，唯一runner accepting v15，维护operation a92a167b-c891-4a93-a4e5-d64cf29ce55a已resumed。数据库4 succeeded、0未完attempt、queue1 promoted，原会话2c507833-67fe-4d10-acf5-6c97eedd05bb revision1；迁移1..27。只是观察，不是停止许可或后续用户新工作不存在的保证。

config/claude文件0600，其SHA与SVC05最后接收相同，native固定配置未变。没有输出凭据/正文/SQL query文本。Web pointer仍version2/current caa1；pointer声明backend b1c是历史Web发布的固定报告身份，不能冒称当前后台仍b1c。两个retained共2,950,349B/20files逐文件hash匹配。

| artifact | 页面source | 个人安装中的报告backend | af51缺口 |
| --- | --- | --- | --- |
| 461a9732… | b1c2e398… | b1c、362 | 未找到af51报告 |
| caa1e938…（current） | 8d8ab520… | b1c、362 | 未找到af51报告 |
| d629631d…（外部保留候选） | 5069586a… | 已有af51的RELEASE03报告，尚未导入个人安装 | 报告已审；产物尚不在个人安装 |

扫描仅个人兼容目录（4份）及RELEASE03 authority内report.json；未广搜任意目录，不将“未找到”写成全机不存在。Lead已协调Web提供两旧descriptor/root进行准确复验。旧362/b1c报告不能改backendHead换签名顶替。

Web身份端点两次有界请求均在取得响应信息前抛错。初始脚本仅留下`OBSERVATION_UNCONFIRMED`，**没有捕获cause，不能归因为非JSON、超时或页面损坏**；第二份reason曾推测非JSON，该推测由第三份DB-only记录纠正。未再请求、未改服务。center health200是独立已取得事实；process/port正常也不能替代Web身份在线确认。正式窗口前应在有授权的最小只读观察中保留cause代码/HTTP状态，不能凭此次unknown继续发布。

## 原受管流程与确切前置

1. Web补齐461a/caa1与**af51**的四项报告并独审。实际操作前fresh检查全部retained集合、身份/用户任务/队列；有active自然等待、unknown停报，不能据本次零任务停止。
2. 固定工具执行位置。现 `loadPreviewConfiguration` 与 `currentSource` 验证config.repository为原Flow目录；不能直接从候选WT调用，也不能改config绕过。由Lead在clean条件下协调原工作目录临时固定af51且冻结到resume（main ref不回退），核普通运行依赖仍来自固定锁及已装实际路径。SVC06完整产物尚未验证，不把它作为捷径。
3. 新d629只在RELEASE03保留目录。现CLI提供`web prepare`与`import-compatibility`，**没有import-artifact**。不能将本次只读核验当复制许可。须由Lead明确选择：受控、原子、逐文件同hash接收既有d629产物；或用现prepare实际生成且再次确认完全相同descriptor。若重建digest不同，旧d629报告不适用。不得为准备盲构建/删旧产物；当前2个retained加1为上限3。
4. 在新的显式操作窗口中导入准确报告；原maintenance bootstrap→drain→active0→hold/refresh af51。工具在stop前核所有retained兼容；发布失败不自动回退/取消任务。保存原旧字段、marker/身份/config、SQL版本、owned进程、源/依赖和全部retained的完整checkpoint。
5. 满足门槛后按窗口一次显式resume。随后独立`web publish`用fresh expectedVersion2、expectedBackendHead af51、准确artifact与599a报告；新pointer预期v3，但以真实回执/观察为准。不主动reload旧tab。未知ACK先读状态，不换version盲发；不假称后台更新就是网页发布。

本轮scope足够：claim cd2d2e57 v2仅 `plans/svc05-history-compatibility`、`docs/evidence/svc05-history-compatibility`。两产品源码已交回，不恢复写权。后继若仅记录既有工具实际操作仍在该证据目录，无需抢工具writer；原Flow source切换与个人文件动作需Lead明确分配操作窗口。若需要新增artifact传输产品入口，则另给精确scope/独审，不能借metadata授权实施。

本地find-skills/clean-code/codebase-design按既有来源应用：只复用原维护与发布权威；读观察、报告验证、源固定、后台更新、网页pointer变更责任明确；未知failclosed、报告按tuple而非名称复用。未增加第二部署控制器或自动重试。
