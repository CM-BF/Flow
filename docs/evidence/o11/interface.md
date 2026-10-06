# O11 Interface

`GET /api/goals/:id/delivery`，owner auth 复用中心；`registerGoalDeliveryRoutes(app,pool)` 供共享 factory 挂载。响应 `Cache-Control: no-store`；无迁移、无新池/后台任务。DTO `packages/contracts/src/goal-delivery.ts`。

- view=plan，limit1..50，after不透明cursor。goal/project/planRef、id/title/version/parent/dependencies、inputRef，最多200节点。planRef只纳 graph/node/input 身份，排除 execution/status/updatedAt/解释；cursor绑定goal/ref/lastNode，当前相关版本变化409 stale_goal_plan。无跨请求冻结保证。
- view=state，重复 `nodeIds` 参数1..50且唯一，只返回元数据、固定执行与产物引用、pendingDecision reference，不返任何 prompt/input/产物/解释正文。全图至多200节点元数据用于依赖链有效性，未知保持unknown。
- view=input，nodeId+version必填；读取immutable GoalDefinition，currentVersion/stale另标，删除节点后历史仍可读。
- view=goal，原始目标正文按需；view=decision，nodeId/taskId/decisionId严格匹配本goal执行后返<=2000字符原问题及当前pending/answer。decision引用不是通用detail ID；不在state塞问题正文。

400非法/跨goal游标，404未知goal/node/input/decision，409计划已变/超现有图元数据界限。不放宽旧执行/接受/decide权限；读取本身不授予写权限。发生 stale 不自动重试写。

单请求RR，最多200 current input/400 latest+accepted execution元数据、2000图edges，材料正文只指定view读取。currentDeliveries仅窄类型提取，函数体保持；不复制失效状态机。知识引用读取需有界，超128 unique source的既有规则保留。M02 feed可作为刷新提示，state无lossless event cursor。

测试seam已由Lead授权：真实中心公共HTTP+随机专用PG，受控runner事件/fixture，不测私有函数。比较实际UTF8 JSON字节/HTTP次数/材料正文重复传输；旧MCP已可固定input读取，本片不宣称tokens或整体性能提升。无 provider/个人服务/Web操作。
