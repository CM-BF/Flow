# O01 首段：目标命令与实际输入绑定

已授权实施；首段 0 模型。已有 G01 项目命令负责节点/依赖 DAG，不复制图编辑器。Goal 关联单一 project 并保存不可变原始 goal/constraints/acceptance；每节点的实际任务 goal/constraints/acceptance/verification 单独版本化。语义相同的 define 不新增版本。G01 标题及兄弟修改不会改变该输入版本。

## Interface

`migrateGoals(pool)` 与 `registerGoalRoutes(app,pool,boss)`，在已有 owner preHandler 下挂载。共享生产入口由 Lead 接入。

- POST /api/goals，owner + Idempotency-Key，输入 projectId/originalGoal/constraints/acceptance。
- GET /api/goals/:id：当前图最多 200 节点、各自当前输入版本/最新执行元数据/已验交付资格及最近 50 条持久事实解释；不生成摘要、不写数据库。
- GET /api/goals/:id/inputs/:nodeId?version=：完整当前或历史实际输入按需读，不在轻读 snapshot 重复。
- POST /api/goals/:id/commands：define-input / execute / accept-delivery，owner + Idempotency-Key。每种有明确版本门槛，返回持久原始命令结果；GET 另取当前事实。
- GET /api/goals/:id/executions?nodeId=&after=&limit=：最多 100，保留旧输入和绑定。单个 execution 固定 goal 原始字段、node 输入、依赖内容摘要及 artifact 引用；真实 task prompt 使用这些实际输入。

Goal tools 接收可信 host 注入的固定 goalId、allowedNodeIds、allowedCommands 与 port。tool 输入不能指定 goalId/harness/token/任意 URL；schema strict。纯 handler 不等于模型已挂载，也不声称是沙箱；owner 凭据不传给工具内容或模型。

## 原子性与版本

每个 goal 命令先锁所属 project 行，和现有 G01 修改串行；同事务读取当前 DAG、校验自身 inputVersion 与依赖当前 accepted artifact 的完整精确引用。成功 execute 在同事务创建现有 Flow task、pg-boss 唤醒、immutable execution binding 和幂等结果。一个节点已有 queued/running/waiting/cancel_requested/uncertain execution 时拒绝新执行；显式后继必须指定 previousExecutionId，未知状态不自动重跑。新幂等键不能绕过该检查。

首段执行只允许 fixture；接受用户给定确定性 fixture 场景用于测试，不接受真实模型/外部副作用。verification 限现有 nonempty/contains；acceptance 的自然语言文字被保存并传入，不声称现有规则验证了全部语义。

交付接受仅在固定 execution 的中心 task succeeded 且最新 artifact 独立 verification passed 后进行。每个引用包含 nodeId/executionId/taskId/artifactId/artifactVersion/detailId；内容从 artifact lower store 读取并核 digest。执行的依赖版本与当前图依赖集合必须精确相同，且每个依赖自己的输入/依赖绑定仍有效。全局 project revision 仅审计出处；不以 revision 相等判定有效性。

修改 B 输入后 B 旧执行/交付过期而 C 仍有效；替换 A 当前交付后 B/C 的旧依赖引用不再匹配。旧记录不删除，已有 task 不自动取消，旧运行结果仍可留证但不可成为当前交付。已有 dependency cycles 由 G01 禁止，当前资格计算只递归当前最多 200 节点。

## 查询、解释与边界

所有快照在只读 repeatable-read 下读。当前投影只返回每节点当前定义版本、最近执行元数据与单一 accepted 引用；历史另分页。每次实际修改保存递增的固定事实解释及 input/execution/project revision 来源；普通 GET 不写解释、更不调用模型。图修改导致的资格变化直接显示明确失效原因，历史解释不冒充当前资格。完整自然语言总结留后续。

输出实际输入有 16,000 字符 task prompt 上限；过大依赖上下文显式拒绝，不能隐式截断改变输入。原始产物内容不嵌入轻读投影，执行时读取并绑定。取消、失联恢复沿已有 task/C02 公共入口；本段不创建另一恢复引擎。
