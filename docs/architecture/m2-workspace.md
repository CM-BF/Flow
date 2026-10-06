# M02 公共工作入口接口（首段）

基线e845eb0，Node24/PostgreSQL16。接口由中心保存事实，Web外部分队消费；当前实现与用户主界面验收分开。

## 入口

- `FlowClient.workspace({after?,before?,limit?},signal?)` / `GET /api/workspace`：不带游标读取最新40条；after是向前增量，before是较早历史，二者互斥，limit=1..100。entries升序、nextCursor/previousCursor、watermark、hasMore/hasEarlier；超过水位的旧游标明确409 workspace_cursor_reset，客户端重新取快照。每条task仅id/title，entry只有正文或id/title reference，无详情/原prompt。
- tasks包含最新100条当前轻量状态（ownerVersion/pendingDecision），attention包含最近100条waiting/uncertain；各有Truncated标记。完整任务索引用queryTasks分页；这些上限不意味着全项目只有100项。状态与条目来自同一个只读repeatable-read快照。
- `FlowClient.queryTasks({limit?,cursor?,statuses?,contextId?,updatedAfter?},signal?)` / `GET /api/task-index`：按updatedAt/id降序，count在游标分页前计算，与该页同事务快照；cursor绑定过滤。当前personal模型contextId=taskId，未来独立conversation需受控变更，不冒充已实现外部binding。statuses为Flow内部状态。updatedAfter采用包含端点的>=语义，对齐A2A statusTimestampAfter，不由协议层做减毫秒补偿。
- 决策仍`client.decide(taskId,{decisionId,answer},key)`，取消仍`cancel(taskId,key)`；任何409应重新取workspace权威当前态并提示旧决策已失效，不自动换decisionId重送。详情仍显式`detail(id)`，未展开禁止请求。
- CLI `workspace --json` / `workspace --after N` 与中心同接口；`reconcile show|observe|resolve|retry <taskId> --input JSON-file --key stable-key`走C02共享schema，不允许盲retry。

## 游标与并发提交

源task/timeline事务各自提交；请求先投影最多200个新task和200条未投影timeline，再读取已提交展示记录。投影事务独占`flow-workspace-projection-v1`事务级advisory锁，在持锁时分配展示bigserial并提交；因此投影提交顺序与展示游标一致。业务writes不拿该全局锁，不把源序列或createdAt当提交水位。一个较早开始/较晚提交的源事件，在后续投影获得更大的展示游标，不被跳过；序号间隙无需补成连续。

依据：[PostgreSQL16 sequence行为](https://www.postgresql.org/docs/16/functions-sequence.html)、[事务级锁](https://www.postgresql.org/docs/16/explicit-locking.html)。真实两事务交错测试已验证A先写未commit、B后写先commit，observer推进B后仍读到晚commit A；四并发投影无重复source。

projectionPending表示本轮投影满批，客户端继续拉取；这是catch-up提示，不是后台已经全部处理。迁移version3独立于C02 version2，使用共同migration锁。

## 界面消费建议与明确边界

页面保持一个按cursor去重的连续工作记录，追加更新先排入“有新进展”，用户正在阅读历史时不改变滚动锚点；当前attention渲染原地决策。task页/官方Thread/右侧panels是可选下钻，不能成为跨任务决策必经。简单状态解释从记录生成，不每tool事件调用模型。外部分队负责真实浏览器/双主题/阅读位置与多任务用户体验验收。

首段5个PG/中心HTTP检查：持久轻量聚合和认证、晚提交源不漏、并发/前后分页、10个独立协议runner任务的待决策及取消后旧decision拒绝、授权排序/过滤/totalSize/cursor。CLI与client局部17项通过；这不是10个真实模型、完整UI或动态依赖通过。源投影每次GET的anti-join历史扫描仍需B01长历史p95/扫描量测量，先测后优化，不宣称生产性能。范围详情/字节块预算、原文context、动态计划与多项目隔离由完整矩阵继续跟踪。

任务索引只保证每次请求的RR快照与精确count。后续任务更新可改变下一页的排序位置，因此它不是跨请求冻结快照；UI不能把它的分页游标作为事件同步水位。统一事件衔接使用workspace durable feed。
