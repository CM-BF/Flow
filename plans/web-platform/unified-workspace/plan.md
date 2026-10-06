# WPF-M02 Web 统一工作入口（M02 消费子项）

创建/更新：2026-10-06。状态：`accepted`，等待当前W01整改形成稳定可审查提交后独立实施。父计划：[WPF-001](../plan.md)；对应主线M02公共工作入口。当前计划唯一owner d01_owner / gpt-6-astra ultra；拟复用workspace_panels_owner，开工前正式交付独立worktree/branch/base和唯一status路径，不并发写当前W01。

## 输入与边界

主线可消费分支 `origin/codex/m2-workspace`，完整HEAD `e888862570cba3c59789053e68df7d5720650c36`，base `e845eb069c594989117fadf380335650efef27a2`；owner树 `Flow-worktrees/m2-workspace` 已只读核验clean。输入文档 `docs/architecture/m2-workspace.md`，类型 `packages/contracts/src/workspace.ts`。必须使用完整接口系列0046db3/0b76639/405529d/e888862或主线已集成完整HEAD，不能只pick405漏types；共享contracts/client/server/CLI和根lock由原Lead单owner维护，本Web子项不修改。

后端证据为真实PG/中心HTTP5项（含10个fixture-runner任务）、CLI14/client3；不等于Web浏览器通过或10个真实模型。M02的workspace是跨任务投影，不是文件系统/PTY，不等待BR-01能力请求才能接入。

## 最小UI方案（root工程提案，非用户逐字要求）

最左竖栏增加“工作总览”入口并保留chat tabs；主体连续跨任务记录，每条保留task title/id、时间/状态来源，避免每事件巨卡。顶部attention可直接Approve/Reject/取消，不要求钻进TaskThread；无事项有明确空态。选择任务打开既有chat tab；选引用以该task上下文懒读右panel，不串当前chat详情。模块独立，不继续往App堆feed逻辑；保留后续内置plugin迁移接缝。

## 协议消费与验收

- `workspace({after?,before?,limit?},signal?)` entries升序，nextCursor/previousCursor/watermark分别使用；按cursor去重，覆盖迟到提交、前后分页与409 workspace_cursor_reset重快照。reset解释锚点变化，不静默遗漏。
- 正读历史时新entries缓冲为“有新进展”，点击才移动；加载更早记录维持可见条目锚点。hasMore/projectionPending表示继续catch-up，需退避/断网停止，不能忙循环或认作全部已投影。
- tasks/attention最多100并有Truncated，不以数组length作全局总数；`queryTasks`分页和精确totalSize提供完整索引。TaskIndex只有TaskSummary，溢出waiting没有pendingDecision，若需原地操作显式show获取当前决定，先核对中心行为。
- decide/cancel/detail复用公共FlowClient；decision按taskId+decisionId绑定，409仅刷新权威态和说明失效，不自动换新decisionId重发。未展开detail请求0，缓存键/异步generation隔离不同task/连接。
- Abort仅停止本地读取不等价取消已受理中心任务；连接切换/卸载清理observer，无ghost更新。断线、加载、空、失败分别可辨并能恢复。
- 场景：10任务混合running/waiting/uncertain/terminal；总览内决定；中间历史增量；加载较早；取消后旧decision409；100+截断及完整分页；双主题390px/键盘/reduced-motion；真实中心联调与HTTP fixture证据分开。

## 前置调查补充（实现前约束）

panels owner按固定e888862读取architecture/types/client/server：历史before页的nextCursor不得覆盖前向deliveredCursor；watermark不是已消费cursor，两个方向状态分开。传AbortSignal会覆盖FlowClient默认15秒timeout，Web需组合本地取消与有界超时。分页tasks/attention是当前最多100快照，缺席不推断已完成；queryTasks totalSize仅当前页事务精确，不假定所有页固定快照，过滤切换重置generation/cursor。

阅读可访问性采用普通语义list/article/heading与显式加载较早即可；不要只加role=feed便声称完整WAI feed。若选完整feed，则article标签、posinset/setsize、aria-busy与PageUp/Down必须配套。实时区域不整段aria-live重读，仅新增条数简短status。锚点策略在浏览器默认overflow-anchor和手工补偿间明确选择并实测，避免双位移；测试变高正文、390px换行、prepend/resize/restore后可见entryId与offset保持。

## TODO

- [ ] **WPF-M02-01** 核验完整M02输入与稳定W01基线，正式派发新worktree/branch及唯一owner/status。
- [ ] **WPF-M02-02** 独立模块实现连续feed/attention/完整任务索引及既有chat/panels接缝。
- [ ] **WPF-M02-03** 运行局部消费/浏览器行为与真实中心联调，覆盖分页/冲突/锚点/100+边界。
- [ ] **WPF-M02-04** clean-code、独立review、双主题截图及Lead集成清单，登记后续plugin/perf改善。

## 决定、风险与来源

已确认：后端已可消费，当前W01整改闭环后优先该可执行子项，WPF-P01 plugin与性能继续队列，不取消持续目标。待验证：溢出attention原地操作、reset锚点恢复、流式记录内存/DOM预算；有证据再优化，不假定无限容量。来源为主线M02交接与root研究#7，见[研究台账](../../../docs/evidence/web-platform/research.md)。当前无实现、无测试结果，不把后端通过移植为Web通过。
