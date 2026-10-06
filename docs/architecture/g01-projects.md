# G01 项目计划图：首纵向片段

这是已授权的独立 domain 片段，不是完整调度引擎。持久 personal Workspace 兼容当前单 owner 身份；没有多租户认证声明。所有项目入口由中心 owner preHandler 保护，runner 拒绝。模块 Interface 为 `registerProjectRoutes(app,pool)` / `migrateProjects(pool)`；主入口、共享 export/client/CLI 由 Lead 接线。

## 数据和版本

Workspace 持久存在。Project 有 revision，初始空图 revision=1。每条已提交命令新增不可变 graph revision，包含 reason、actor=owner、节点的固定快照；当前项目指针原子推进。历史 graph 查询仍从 flow.tasks 读取其关联任务的当前状态，明确 task 状态不是 graph revision 快照。

Node 可 taskId=null，先规划再显式绑定已有任务；绑定后不静默换任务。当前同一 task 只能绑定一个节点（包含不同项目），由数据库唯一约束防并发双归属。图节点 title 是规划标签，不改 Flow task title/prompt/status。删除节点只改变计划，不代表取消其 task；取消传播和绑定计划版本到执行结果属于后续。

命令全带 expectedRevision、reason、Idempotency-Key。修改目标还带 expectedNodeVersion；添加/移动子节点引用父版本；依赖引用每个目标节点版本。项目 CAS 是整体并发门槛，节点/父版本防止调用者拿新项目 revision 配旧节点信息。Node version 仅在自身字段/绑定/父引用/依赖变化时增加，不把任意兄弟变化算作节点修改。

## 原子并发与约束

事务先按项目锁定当前 project 行，再比较 revision，读取该 revision 的图，应用单个命令，检查父子树与显式依赖图各自无环，保存下一 revision 并推进 pointer。相反依赖 A→B / B→A 并发使用同一 expectedRevision 时，至多一条成功；另一条刷新后若形成环仍拒绝。不同项目不使用共享图锁。幂等键锁只作用于该 operation/key，延续现有 center command 模块。

父子树与依赖边含义分开；首片段不推导隐式调度依赖。删除有子节点或被依赖的节点拒绝；调用者先用新版本显式调整引用。节点不得引用别的项目节点。200 节点 / 2000 依赖边的硬上限保证事务内验证有界。

## HTTP 合同

- GET `/api/workspaces`。
- POST `/api/projects`：workspaceId=personal、title；Idempotency-Key 必需。
- GET `/api/projects?workspaceId=personal&after=<id>&limit=<1..100>`：按 id 升序游标，非冻结列表。
- GET `/api/projects/:id?revision=<positive integer>`：默认当前；明确 revision 则取不可变历史。
- POST `/api/projects/:id/commands`：add-node、update-node、bind-task、reparent-node、set-dependencies、remove-node。每次成功返回 snapshot、changedNodeId、replayed。

参数错误 400，身份 401/403，不存在 404，幂等输入不匹配/旧版本/图约束冲突 409。幂等重报返回原始接受结果，不在重报时偷偷改成当前最新 snapshot；最新状态使用 GET。

## 后续仍 open

依赖 gating、计划变更对运行中任务的失效决策、取消传播、调度提交、预算、上下文继承、跨空间隔离和项目权限。首片段的计划边不会暂停或启动任何已有任务，也不将新图 revision 当作旧执行结果已通过验收。
