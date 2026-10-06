# O12 — 目标会话与不可变解释历史

固定审查 target `60e495b5ea55e1cee12ae2a9deccb03afc7102f4`；生产逻辑最后变更 `9d1590fc0e4a3a3477a560120570d125813628f9`，最后提交只加强兄弟活动的公开旅程。base `52ebd2b1efe5ecbfab9d3c59b1da2ed1580dd52f`。作者 assignment_review / gpt-6-astra；[Interface](interface.md)、[质量与技能](quality.md)、[manifest](manifest.json)、[唯一状态](../../../plans/o12-goal-session/status.md)。无作者自审批准。

新增模块 `packages/interaction/src/goal` 管理一个 goal 的轻读和一个持久未决命令。中心仍负责授权、CAS、排程、有效输入/依赖、机械验证及显式接收。依赖方向是 renderer/host → goal session → FlowClient → 既有中心；已用 ObservationReads、公共schema/版本规则，不新造调度器。加入另一renderer只需调用同一controller并提供原子持久IntentStore；不复制状态规则。新history查询只读既有immutable表主键，未迁移数据库。

## 实际检查

Node24.20.0 / pnpm9.15.4 / Vitest4.0.18，随机专用PG数据库、动态loopback端口，所有测试只有合成内容。

- [history-red.txt](history-red.txt)：新路由未存在，2选2失败；[history-green.txt](history-green.txt) 2/2。
- [session-first.txt](session-first.txt)：4选2过2失败，保存ACK失败与detail实际字段不匹配；[session-green.txt](session-green.txt) 修后4/4。
- [lifecycle-red.txt](lifecycle-red.txt)：6选5过1失败，dispose过早；[lifecycle-green.txt](lifecycle-green.txt) 6/6。
- [observation-race-red.txt](observation-race-red.txt)：选1失败/6未选，晚状态覆盖相关新计划；修复随[checks-final.txt](checks-final.txt)验证。
- [checks-final.txt](checks-final.txt)：20/20（13新增+原O11七项），17.87s。随后[project-ack-red.txt](project-ack-red.txt)只选新增1失败/7未选；[receipt-final.txt](receipt-final.txt) 12/12（新增1，其余11重复），6.62s。全任务 **21个不同检查：14新+7旧**，不是单次21/21。
- 最后同一双客户端用例增加真实兄弟事件；[sibling-final.txt](sibling-final.txt) 选1过/3未选，4.73s，无新测试计数。[typecheck-delivery.txt](typecheck-delivery.txt) exit0；此前类型检查也保留。
- [final/history-cleanup.json](final/history-cleanup.json)、[receipt-final/session-cleanup.json](receipt-final/session-cleanup.json)、[sibling-final/session-cleanup.json](sibling-final/session-cleanup.json) 均自有server关闭、专库DROP后remaining=[]。旧O11七项afterAll也成功执行原DROP；此次未启用其可选JSON输出，不冒称有第三份同格式receipt。

## 公开旅程结果与测量口径

历史57条以 [20, 20, 17] 分页，期间B执行产生第58条；旧cursor仍固定throughVersion57，新列表看到58。列表只有reference/kind/time/source，没有text。A固定解释正文在中心重启后不变。并未读取全文历史后截断，也没有hash整份动态snapshot。历史不代表当前有效。

两公开客户端争用实际输入version与project CAS：落后一方明确rejected，只发送该次原命令，刷新计划后没有自动重发。丢ACK场景先真实提交，原key/body持久到临时文件；中心和controller重建后initialize不发命令，显式recover返回replayed且只有一份input v2/解释。存储写/清理失败及错误ACK都保留unknown；断连时持久化尚未返回也不会迟发。

最新[兄弟活动原始记录](sibling-final/two-client.json)：A材料只显式读一次；B两个真实公开runner事件批次之间，同一controller两次state GET分别 1218 / 1218 UTF-8未压缩JSON字节，总 2436B，重复材料0，planRef稳定，已展开A正文保留。这个数字仅该合成双节点响应，不是传输压缩、模型token、吞吐/SLO或产品总体性能。

Decision正文另读；disconnect后任务仍running，cancel ACK后为cancel_requested，只有peer实际completed(cancelled)才变终态。随后固定artifact验证id/kind/version及SHA256；归属来自同goal已观察binding（Detail DTO本身没有taskId）。机械passed后accepted仍null，未自动进行业务接收。原O11直接消费者另覆盖相关依赖/知识变更拒过期写、200节点分页、失联uncertain。

## 界限与复跑

IntentStore由宿主提供原子持久化和一个namespace单writer；不同公共客户端用不同store，中心处理冲突。不持久保存token。命令64KiB；2并发读+4排队；200计划节点/50选中状态/50解释引用/一个正文。caller显式刷新，没有轮询解释模型或后台dispatch。当前artifact展开需匹配已观察binding，完整历史产物导航另片；历史input/解释仍精确按version读。

0模型/0个人服务；没有native执行、UI/TUI、完整NL目标交付，也没有OS hardkill或断电证明。fixture事件是公开HTTP确定性peer，不是新原生adapter证明。公共 `@flow/interaction/goal` export 由F01独立审/组合，本分支模块测试经其公开函数入口及真实FlowClient，尚未替它声明package入口已main。

在此WT设PATH包含 `/opt/homebrew/opt/node@24/bin`：`FLOW_O12_EVIDENCE_DIR=/tmp/flow-o12-repeat-<unique> pnpm exec vitest run apps/server/src/goal-delivery/history.test.ts apps/server/src/goal-delivery/session.test.ts packages/interaction/src/goal/lifecycle.test.ts apps/server/src/goal-delivery/delivery.test.ts`，另 `pnpm exec tsc --noEmit`。复跑输出用独立目录，不覆盖固定原始记录。局部变更只选择相应测试；本交付不再重复已绿全集。
