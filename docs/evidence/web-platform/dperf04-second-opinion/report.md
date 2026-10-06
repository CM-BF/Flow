# DPERF 摘要/按需详情第二意见（候选，未领取）

固定 main/origin 一次观察均为 `c837b5dccaea429b0112d1c7e0c752c41334204a`；之后只读此对象。先读管理树 dashboard-summary-readonly-design/report.md 与 sources.json（原观察 d4a2）。本报告沿其方向，补实现接口和真实依赖限制；不据此声称部署变快。0测试/实验/聚合真实repo/4320/服务/PG/browser/项目写入。

## 职责证据

- server.mjs:17–19,29 只有全量 snapshot 的 in-flight 合并；没有完成结果缓存。完整 `/api/snapshot` 及 CLI --json 保持原形状/语义，不改成摘要。
- aggregate.mjs:27–38 安全读 status及固定 fallback；41–71 将轻声明、review文件、Git/proof、document目录混在一起；74–88 全任务并行后再全任务 main proof。git-snapshot/proof 的现有并发限制、同target复用和语义均保留。
- human.mjs:37–60 依赖 task.current，排序/父子让位不继承child阻塞；task-links.mjs 的 sourceProblem/resolveTaskLinks 也依赖 current。不能把 source可读直接塞进完整Task.current或把无Git数据包装成 current=true。
- app.js:20–24 的绿色意味着现场范围核验，不等作者说APPROVED；124–133+213没有客户端in-flight/generation保护；154–189详情完全靠既有全量响应。
- aggregate:2 静态import ledger；ledger:1静态import pg。server与test/fixture经此链依赖pg；不能称当前源码无需第三方依赖。package.json仅声明pg，不声明Playwright。

## 一个小 Interface

1. `GET /api/summary` 返回显式 `kind:'summary', version:1, collectedAt, tasks, overview`。每task只含注册身份/来源位置、原status更新时间/文件mtime/读取时间与SHA256、source.mode/stale/errors、`sourceCurrent`、人类摘要/显式阶段/priority/blocker/decision、TODO完成/总数、短领取占位、明确父关系/co-lead声明。checks/review/main/HEAD/dirty若保留，统一放 `declared`，叫“作者记录”；不返回伪造git/proof/current绿色。全部任务均在摘要，含缺失/陈旧/unknown/history，不能仅top3。
   摘要只安全读status并parse；固定fallback可走原git show，但没有每task observeGit、compareImplementation、integrationProof、listDocuments。没有本轮proof就 `not-observed`。首片不保跨轮proof缓存，也不把旧proof时间替换为collectedAt。
2. **不悄改 current**：完整Task、旧aggregate、humanOverview和resolveTaskLinks的默认语义均不改。新read-model拥有显式的“声明来源投影”：读取同一安全status facts后，内部临时对象的current只供这两个现有纯函数作来源有效性筛选；该内部投影绝不作为完整Task输出或传入proof badges。summary DTO只暴露sourceCurrent及links.basis='status-source'，不暴露含混的current。这里的sourceCurrent是live status、无解析/登记声明冲突、未陈旧，不含Git核验；UI叫“状态来源已读 / Git待核验”。直接测试固定断言summary没有完整Task.current/proof绿色，且完整snapshot的current仍要求原Git/issue语义。这样复用原排序/父子算法，避免改其接口和复制算法。
3. `GET /api/task?task=<registered ID>` 只核该task+main，返回完整task事实、documents、各自 observedAt、status fingerprint、实际Git HEAD/dirty和proof；不对其它task跑proof。children列表来自summary原关系事实，详情不按单task子集重新推父关系。仅ID，不接受worktree/path。复用原proof、documents与注册读取边界。
   detail标记读取开始/结束及status hash；若前后status变动，声明一致性unknown，不把非原子读取称snapshot。客户端请求携带自己generation、记summary fingerprint；A→B/关闭后的A响应不应用，同ID旧响应也不覆盖新summary。新摘要变化使旧详情显示“旧核验/待重新核验”，不合并成fresh。刷新失败保旧数据及原时间+错误。
4. `GET /api/assignments` 独立读取现 assignmentSnapshot；不阻塞summary出首屏。初始领取状态明确unknown，完成后显示PG观察时间/来源匹配；active未登记claim、stale仍占用、role、完整scope仍可查。首片允许该独立响应保完整ledger数据、仅按需构造scope DOM，避免再造claim-detail协议。报告必须同时列summary字节及claims附加字节，不能只量小包声称所有负载消失。take/amend/release仍原PG原子CLI，不改数据库、claim权威或写入口。
   aggregate移除顶层静态ledger import，在默认只读观察函数中动态import；允许server/aggregate传入同一个只读assignment observer供临时fixture计数。生产默认唯一真实ledger；测试明确synthetic unavailable/available观测，不mock take授权或持久写。
5. server三个读接口各自仅in-flight合并，不TTL；app一个summary刷新flight、一个claim读取flight、一个selected-task详情请求。timer只可见时启动且不能叠请求，手动刷新有明确完成状态；detail/doc独立abort+generation。没有通用缓存框架、全局限流或大重构。

## 精确候选 scope（收敛为9，不再分叉）

管理建议的8条核心成立；第9条是既有task-links浏览器入口的必要路由适配。最终候选如下，DPERF04目录名待manager核重号：

1. apps/execution-dashboard/src/aggregate.mjs
2. apps/execution-dashboard/src/server.mjs
3. apps/execution-dashboard/src/read-model.mjs（新）
4. apps/execution-dashboard/public/app.js
5. apps/execution-dashboard/test/summary-detail.test.mjs（新）
6. apps/execution-dashboard/test/summary-detail.browser.mjs（新，仅自有fixture）
7. apps/execution-dashboard/test/task-links.browser.mjs
8. plans/wpf-dperf04-summary-detail（候选目录）
9. docs/evidence/wpf-dperf04（候选目录）

read-model承接共享轻status facts与版本化summary/声明投影；aggregate复用这些facts后添加现场Git/proof/docs，向server提供单task detail；read-model不反向import aggregate以免循环。只读assignment观察在aggregate默认边界动态import原ledger，server可注入只读fixture观察。生产仍原PG，不新增写入口。

第7条理由：task-links.browser.mjs:约37现拦/api/snapshot注入claims，首页改summary后该注入不再被消费，父子下钻/短claim与长owner详情测试会测错输入；必须将原断言保留并适配summary/assignments/detail，不通过删断言通过。其旧D08/DASHSUM证据不覆盖，新执行输出本片证据。

原browser-check.mjs与coordination-browser.mjs是绑定完整首页/真实registry的旧手工诊断，当前不运行、不声称已适配新摘要UI；旧/api/snapshot数据兼容仍用Node直接验证，新fixture-only脚本承担受影响的UI断言。若以后要求这两个旧手工入口继续验证新UI，另需明确scope；本片不运行它们来采真实registry/PG。

只读保护：human.mjs、task-links.mjs、registry.mjs（唯一Lead登记）、status.mjs、proof.mjs、git-snapshot.mjs、documents.mjs、coordination/**、public/index.html/styles.css/architecture*、原fixture、root依赖/lock。现有dialog/文本区域足够承载加载/错误/旧观察；额外路径须先amend。

## 有界验证建议（本轮未运行）

- Node24内置node:test，单process ≤30秒，临时2task+main小Git样本合计≤8MiB，cleanup包含在预算。通过实际导出Interface计数：summary无逐task Git/proof/doc枚举；detail只目标task+main；相同/不同target原proof语义不变；完整snapshot shape/字段与既有直接tests兼容。
- 必测source missing/frozen/stale/未来时间/坏字段、known父子与unknown targetId不归组、父不active不藏child、child blocker/decision独立；作者APPROVED不出现已核绿色；detail请求非法task不读任意路径；claims unknown不等未领取；跨请求fresh时间不重写旧证据。
- 新browser scope **必要**：DOM focus/原生dialog、A慢B快/同task刷新、隐藏timer、失败保原时间、按需证据/文档/全部任务与未登记claim可达、双theme390。建议单Chrome+随机fixtureHTTP累计≤60秒含≥15秒清理、输出≤8MiB；生产4320/PG不参与。新脚本覆盖受影响断言并原样说明来源；浏览器执行必须等fresh资源gate，当前不启动，不能为了它阻塞本次只读方案提交。
- 不安装/构建Web、不跑156tasks大benchmark。只比较同一个小样本summary/full bytes与实际调用数，单次耗时附样本来源，不能宣称p95或用户机器绝对收益。

## sparse/依赖与资源

只读checkout集合：apps/execution-dashboard全部tracked文件，加根AGENTS.md/.gitignore/package.json/pnpm-lock.yaml/pnpm-workspace.yaml、plans适用规则/索引及将来本片plan/evidence；不checkout全docs历史、产品Web/server、packages或node_modules。本人固定git tree核dashboard为37files/334502 blob bytes；管理同SHA核上述全部集合44files/667441B、4KiB取整761856B。数字是源码/分配估算，非物理新增量，不含Git index/目录、共同gitobject库、新证据或依赖。明显低于20MiB；由Lead唯一Gitowner串行sparse，worker不改sparse/config。

Node只读direct可做到零第三方加载：动态ledger + 注入只读assignment观察，复用内置fs/http/crypto/child_process与小Gitfixture；真正PG观测仍必须已有pg及其依赖，缺少时明确unknown，绝不假available。Browser另需已有Playwright+Chrome，其位置/版本/可用性由管理显式核，不能将它们算入<20MiB或安装掩盖依赖。新source/evidence预算建议源码≤20MiB、证据≤8MiB分别核算，不把所有运行写入混称checkout。

直接父D01、co-lead Web/root；可由w01单owner实现，不挂DPERF第三层。Recovery/可用预览优先。本轮沿已读本地find-skills、codebase-design、clean-code，应用来源/现场proof/claim/展示职责分离和接口测试；无安装/联网依赖发现。
