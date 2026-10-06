# 工程看板按需核验后继：只读结构建议

本轮仅固定源码阅读，未请求4320、未聚合真实工作树、未跑测试/浏览器、未修改项目。固定源码身份见 sources.json。不是实施方案已领取或性能收益证明。

## 已知观察与源码解释

GO 2026-10-06T13:52:38.950Z 单次 GET /api/snapshot 200，156 tasks，1,879,706 bytes，8,545ms，no-store。只引用该一次实际部署观察；不当 p95、CPU、容量或当前复测。

server 的 pendingSnapshot 只合并正在进行的请求，完成后即清空。aggregate 每轮先排队每 worktree 四个 Git 命令，读取 status 与 plan/status/review 文档入口，完成每任务实现/审查核验，再完成全任务 main 集成核验，最后才返回首页。git-snapshot 已限制实际子进程并发4及当轮 main changes 复用，不能再声称完全无并发治理。没有跨轮完成快照复用。

public/app.js 首页摘要、所有工作线、收起的历史/其他活动 DOM、详情都来自同一完整响应。20秒可见页计时器无客户端 in-flight guard；手动按钮 disabled 并不阻止计时器发新请求。服务器当轮可能合并，但JSON传输/解析/render仍可能重复；对返回时序也未设置版本接受条件。这是源码风险，不是新复现的乱序事故。

## 小模块优先方案（未实施）

1. 保留旧完整 /api/snapshot 给现有消费者/诊断，首页改用有版本边界的摘要读取：现有 status 唯一事实源，保留全部任务的身份、owner、parent/co-lead、工作阶段、下一交付/阻塞/决定/更新时间、TODO计数、来源缺失/解析失败/stale。不要只取top3省事，过滤、历史、未知数仍须能解释。
2. 摘要读取不以全量 Git/review/main proof/listDocuments 为前置。来源事实与现场核验拆开：作者已声明review/main明确叫“作者记录”；没有本次proof时显示待核验，保留最后验证值也必须同时显示原观察时间/旧源HEAD及“非本次核验”。不能拿新snapshot.generatedAt刷新旧proof时间。
3. /api/task?task=<注册ID> 只对指定task按现有proof/documents安全边界读取；无任意worktree/path参数。先复用现有逻辑，不另造通用验证框架。详情响应标记请求ID/源status摘要/main及owner观察身份，客户端丢弃旧请求，不把A结果盖到B或把旧status替换新summary。不同时间的两份证据保持各自时间，变化/失败时unknown/重试，不假设Git/file原子快照。
4. 概览若仍展示Git HEAD/dirty，可用独立后台观察或按需观察，但初始必须是未知/历史时间标记；观察失败不能把作者声明变成现场。原 mainBadge/reviewBadge 的绿色需要重构为明确 proof 状态，不能summary直接灌入原approved/current模型。
5. claim读取独立新鲜PG观察，可先标unknown等待后续；首页快照不作claim仲裁。保留未登记active claim、lead/worker、是否source匹配、陈旧仍占用。task明细才展开scope；真正take仍走实时PG原子命令，缓存或页面按钮不会获得写权。
6. 首轮先采用单次请求合并+客户端refresh guard，响应只投递当前generation、隐藏页不刷新，详细请求AbortController；有数据时下一次刷新失败保留上次快照+原读取时间/错误。若加短TTL只缓存派生读结果，明确采集与返回时间，手动刷新语义固定，不能把cached旧proof伪装fresh。
7. 保持全部信息可达：摘要去掉长原文/scopes/metadata paths/doc links只影响首屏负载，详情入口仍能读取；收起区DOM可按展开构建。页面减少字节不等于原后台8.5秒消失，必须独立检查后台调用/字节。

## 有界验证建议

先选最小临时registry，注入可计数Git/proof/doc读取端口：摘要0详细proof/0文档目录枚举，详情只指定任务；existing Git concurrency仍受控。直接consumer检查来源缺失、空review、fresh/stale/unknown、作者approved但没有新proof、旧详情晚到、失败留旧时间、claimunknown不变未领取、文本转义/越界task/path。再固定同一临时输入比较响应字节与直接耗时，仅报这个样本，不新大型负载/通用遥测，也不要求GO重复工程测试。

任何跨轮Git proof缓存必须考虑dirty/untracked与main变化，不能仅HEAD键命中；本片首选去掉首页全量proof依赖而不是建立复杂invalidator。旧完整接口保留兼容性，用明确版本区分summary/detail，避免 silently changing 已有 /api/snapshot shape。

## 所属与优先级

属D01既有DPERF后继，直接大task/co-lead两层，不放第三层执行。低于产品连接恢复/可用预览，高于装饰；目前无新claim/owner实施，管理者登记候选。root只读clean-code段末检查：保持source read、现场proof、claim、client展示不同职责；优先复用边界，未写代码无修复声明。
